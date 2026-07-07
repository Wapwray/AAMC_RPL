(function initRplFinalReportGenerator(globalScope) {
  "use strict";

  const DEFAULT_QUALIFICATION = "FNS50322 Diploma of Finance and Mortgage Broking Management";

  const defaultLog = () => {};
  const defaultSetStatus = () => {};

  const isMissingFinalAiConfigError = (error) => /Missing required RPL_FINAL_\* environment variables/i.test(error?.message || String(error || ""));

  const getMissingFinalAiConfigWarning = () => "AI analysis warning: final AI model configuration is not available, so this report was generated from transcript source signals only.";

  const defaultBuildQuestionAnalysisPromptForBatch = (reportModule, batch, candidateMetadata) => {
    const questionSpecs = batch.map((item) => item.officialQuestionSpec || {
      questionNumber: item.questionNumber,
      section: item.section || "Not supplied in question bank",
      questionText: item.parsedQuestionBlock?.transcriptQuestionText || "",
      hints: item.parsedQuestionBlock?.transcriptHint || "",
      objective: item.parsedQuestionBlock?.transcriptObjective || "",
    });

    const parsedQuestionBlocks = batch.map((item) => item.parsedQuestionBlock || {
      questionNumber: item.questionNumber,
      transcriptQuestionText: item.officialQuestionSpec?.questionText || "",
      attempts: [],
      assessorBotMessages: [],
      rawBlockText: "",
    });

    return reportModule.buildQuestionAnalysisPrompt({
      candidateMetadata,
      questionSpecs,
      parsedQuestionBlocks,
    });
  };

  const create = ({
    reportModule,
    callTextModel,
    setStatus = defaultSetStatus,
    log = defaultLog,
    buildQuestionAnalysisPromptForBatch,
  }) => {
    if (!reportModule) {
      throw new Error("RplFinalReportGenerator requires reportModule.");
    }
    if (typeof callTextModel !== "function") {
      throw new Error("RplFinalReportGenerator requires callTextModel(prompt, options). ");
    }

    const buildPrompt = (batch, candidateMetadata) => {
      if (typeof buildQuestionAnalysisPromptForBatch === "function") {
        return buildQuestionAnalysisPromptForBatch(batch, candidateMetadata);
      }
      return defaultBuildQuestionAnalysisPromptForBatch(reportModule, batch, candidateMetadata);
    };

    const analysePreliminaryQuestionBatch = async (batch, candidateMetadata, batchNumber, totalBatches) => {
      const prompt = buildPrompt(batch, candidateMetadata);
      const estimatedTokens = Math.min(12000, Math.max(2400, 1200 + batch.length * 1200 + Math.ceil(prompt.length / 6)));
      setStatus(`Analysing report questions batch ${batchNumber} of ${totalBatches}...`);
      const responseText = await callTextModel(prompt, {
        mode: "final",
        temperature: 0.1,
        max_tokens: estimatedTokens,
      });
      const parsed = reportModule.parseQuestionAnalysisResponse(responseText);
      return Array.isArray(parsed.questions) ? parsed.questions : [];
    };

    const analysePreliminaryQuestions = async (manifest, candidateMetadata, reportOptions) => {
      const batches = reportModule.buildQuestionAnalysisBatches(manifest, reportOptions);
      const analyses = [];
      const warnings = [];

      for (let index = 0; index < batches.length; index += 1) {
        const batch = batches[index];
        try {
          analyses.push(...await analysePreliminaryQuestionBatch(batch, candidateMetadata, index + 1, batches.length));
        } catch (batchError) {
          log(`Batch ${index + 1} failed: ${batchError?.message || String(batchError)}`);
          if (isMissingFinalAiConfigError(batchError)) {
            warnings.push(getMissingFinalAiConfigWarning());
            log("RPL_FINAL_* is not configured; using transcript-source fallback report and skipping remaining AI analysis calls.");
            return { analyses, warnings };
          }

          if (batch.length <= 1) {
            warnings.push(`AI analysis warning: Question ${batch[0]?.questionNumber || index + 1} could not be analysed by the model and was classified from transcript source signals only.`);
            continue;
          }

          warnings.push(`AI analysis warning: batch ${index + 1} was retried as individual questions after the first attempt failed.`);
          for (let singleIndex = 0; singleIndex < batch.length; singleIndex += 1) {
            const singleQuestion = batch[singleIndex];
            try {
              analyses.push(...await analysePreliminaryQuestionBatch([singleQuestion], candidateMetadata, singleIndex + 1, batch.length));
            } catch (singleError) {
              log(`Question ${singleQuestion?.questionNumber || singleIndex + 1} failed: ${singleError?.message || String(singleError)}`);
              if (isMissingFinalAiConfigError(singleError)) {
                warnings.push(getMissingFinalAiConfigWarning());
                log("RPL_FINAL_* is not configured; using transcript-source fallback report and skipping remaining AI analysis calls.");
                return { analyses, warnings };
              }
              warnings.push(`AI analysis warning: Question ${singleQuestion?.questionNumber || singleIndex + 1} could not be analysed by the model and was classified from transcript source signals only.`);
            }
          }
        }
      }

      return { analyses, warnings };
    };

    const buildPreliminaryReviewReport = async ({
      fullTranscriptText,
      candidateMetadata,
      officialQuestionBank = [],
      reportOptions = {},
    }) => {
      const normalizedOptions = {
        outputMode: "html",
        includeTranscriptWarnings: false,
        qualificationDefault: DEFAULT_QUALIFICATION,
        reportDate: new Date().toLocaleString(),
        maxBatchChars: 16000,
        ...reportOptions,
      };

      const parsedQuestionBlocks = reportModule.parseTranscriptQuestions(fullTranscriptText);
      const manifest = reportModule.buildQuestionManifest(officialQuestionBank, parsedQuestionBlocks);
      const { analyses, warnings } = await analysePreliminaryQuestions(manifest, candidateMetadata, normalizedOptions);

      const model = reportModule.buildReportModel({
        fullTranscript: fullTranscriptText,
        candidateMetadata,
        officialQuestionBank,
        reportOptions: normalizedOptions,
        questionAnalyses: analyses,
      });

      model.warnings.push(...warnings);
      const html = reportModule.renderReportHtml(model);
      const validation = reportModule.validateReportHtmlCoverage(model, html);
      if (!validation.valid) {
        throw new Error(`Generated report coverage validation failed: expected ${validation.questionCount} question row(s), got ${validation.statusRows} status row(s) and ${validation.articleCount} article(s).`);
      }

      return { html, model, validation };
    };

    return {
      buildPreliminaryReviewReport,
    };
  };

  globalScope.RplFinalReportGenerator = {
    create,
  };
})(window);
