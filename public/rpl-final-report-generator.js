(function initRplFinalReportGenerator(globalScope) {
  "use strict";

  const DEFAULT_QUALIFICATION = "FNS50322 Diploma of Finance and Mortgage Broking Management";

  const defaultLog = () => {};
  const defaultSetStatus = () => {};

  const cleanValue = (value) => String(value ?? "").trim();

  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

  const firstValue = (item, keys) => {
    for (const key of keys) {
      const value = item?.[key];
      const cleaned = cleanValue(value);
      if (cleaned) return cleaned;
    }
    return "";
  };

  const joinObjectiveFields = (item) => {
    const objectiveParts = [
      cleanValue(item?.field_3),
      cleanValue(item?.field_4),
    ].filter(Boolean);

    if (objectiveParts.length) {
      return objectiveParts.join("\n\n");
    }

    return firstValue(item, ["objective", "Objective", "ObjectiveHtml", "objectiveHtml"]);
  };

  const getNumericPrefix = (value) => {
    const text = cleanValue(value);
    const match = text.match(/\d+/);
    if (!match) return null;
    const numeric = Number(match[0]);
    return Number.isFinite(numeric) ? numeric : null;
  };

  const renderRichField = (value) => {
    const raw = String(value ?? "").trim();
    if (!raw) return "N/A";

    // If DOM APIs are unavailable for any reason, safely escape.
    if (typeof DOMParser === "undefined") {
      return escapeHtml(raw).replace(/\r?\n/g, "<br>");
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, "text/html");
    doc.querySelectorAll("script,style,iframe,object,embed,link,meta").forEach((node) => node.remove());

    doc.body.querySelectorAll("*").forEach((element) => {
      [...element.attributes].forEach((attribute) => {
        const attrName = attribute.name.toLowerCase();
        if (attrName.startsWith("on")) {
          element.removeAttribute(attribute.name);
        }
      });
    });

    const html = doc.body.innerHTML.trim();
    if (!html) return "N/A";
    return html;
  };

  const normalizeAssessorQuestionList = (rawPayload, baseQuestionCount = 0) => {
    let payload = rawPayload;

    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload);
      } catch {
        payload = null;
      }
    }

    if (!payload) return [];

    let list = [];
    if (Array.isArray(payload)) {
      list = payload;
    } else if (Array.isArray(payload.questions)) {
      list = payload.questions;
    } else if (Array.isArray(payload.value)) {
      list = payload.value;
    } else if (Array.isArray(payload.items)) {
      list = payload.items;
    } else if (Array.isArray(payload.data?.questions)) {
      list = payload.data.questions;
    } else if (Array.isArray(payload.listitems)) {
      list = payload.listitems;
    } else if (typeof payload.listitems === "string") {
      try {
        const parsedListItems = JSON.parse(payload.listitems);
        if (Array.isArray(parsedListItems)) list = parsedListItems;
      } catch {
        list = [];
      }
    }

    const preNormalized = list
      .map((item) => {
        const titleValue = firstValue(item, ["Title", "title"]);
        const titleNumber = getNumericPrefix(titleValue);
        const section = firstValue(item, ["field_1", "section", "Section", "category", "Category", "topic", "Topic"]) || "Assessor";
        const questionText = firstValue(item, ["field_2", "questionText", "question_text", "question", "Question", "Question Details", "title", "Title"]);
        const hints = firstValue(item, ["hints", "hint", "Hints", "Hint", "HintsHtml", "hintsHtml"]);
        const objective = joinObjectiveFields(item);
        if (!questionText) return null;
        return {
          titleValue,
          titleNumber,
          section,
          questionText,
          hints: hints || "N/A",
          objective: objective || "N/A",
        };
      })
      .filter(Boolean);

    preNormalized.sort((a, b) => {
      const aNum = Number.isFinite(a.titleNumber) ? a.titleNumber : Number.MAX_SAFE_INTEGER;
      const bNum = Number.isFinite(b.titleNumber) ? b.titleNumber : Number.MAX_SAFE_INTEGER;
      if (aNum !== bNum) return aNum - bNum;
      return String(a.titleValue || "").localeCompare(String(b.titleValue || ""));
    });

    const normalized = preNormalized.map((item, index) => {
      // Use Title as the assessor offset when numeric; otherwise keep continuous numbering.
      const derivedNumber = Number.isFinite(item.titleNumber)
        ? baseQuestionCount + item.titleNumber
        : baseQuestionCount + index + 1;

      return {
        qNumber: String(derivedNumber),
        section: item.section,
        questionText: item.questionText,
        hints: item.hints,
        objective: item.objective,
      };
    });

    return normalized;
  };

  const mergeCandidateMetadataIntoModel = (model, candidateMetadata) => {
    const metadata = model?.metadata;
    if (!metadata || !candidateMetadata) return;

    const candidateName = cleanValue(candidateMetadata.candidateName || candidateMetadata.fullName);
    const contactId = cleanValue(candidateMetadata.contactId);
    const qualification = cleanValue(candidateMetadata.qualification);
    const interviewDate = cleanValue(candidateMetadata.interviewDate);
    const industry = cleanValue(candidateMetadata.industry);
    const jobTitle = cleanValue(candidateMetadata.jobTitle);

    if (candidateName) metadata.candidateName = candidateName;
    if (contactId) metadata.contactId = contactId;
    if (qualification) metadata.qualification = qualification;
    if (interviewDate) metadata.interviewDate = interviewDate;
    if (industry) metadata.industry = industry;
    if (jobTitle) metadata.jobTitle = jobTitle;
  };

  const buildAssessorQuestionsSectionHtml = (assessorQuestions) => {
    if (!Array.isArray(assessorQuestions) || !assessorQuestions.length) return "";

    const rows = assessorQuestions.map((item) => {
      // Sanitize all inputs to prevent XSS
      const qNumber = escapeHtml(item.qNumber || "");
      const section = escapeHtml(item.section || "");
      const questionText = renderRichField(item.questionText || "");
      const hints = renderRichField(item.hints || "N/A");
      const objective = renderRichField(item.objective || "N/A");
      
      return `
        <article class="question-card" data-assessor-question-number="${qNumber}">
          <h3>Assessor Question ${qNumber} - ${section}</h3>
          <section>
            <h4>Question asked</h4>
            <div class="response-box">${questionText}</div>
          </section>
          <section>
            <h4>Hints</h4>
            <div class="response-box">${hints}</div>
          </section>
          <section>
            <h4>Objective</h4>
            <div class="response-box">${objective}</div>
          </section>
          <section>
            <h4>Assessor evaluation</h4>
            <div class="field-value">to be completed by assessor</div>
          </section>
          <section>
            <h4>Assessor notes</h4>
            <div class="field-value">to be completed by assessor</div>
          </section>
        </article>`;
    }).join("\n");

    return `
      <section class="question-review-section" aria-labelledby="assessorQuestionsTitle">
        <h2 id="assessorQuestionsTitle">Assessor Questions</h2>
        ${rows}
      </section>`;
  };

  const injectAssessorQuestionsIntoHtml = (html, assessorQuestions) => {
    const sectionHtml = buildAssessorQuestionsSectionHtml(assessorQuestions);
    if (!sectionHtml) return html;

    // Insert assessor questions before limitations so limitations/confirmation/sign-off stay after assessor questions.
    if (/<section\s+class="limitations"/i.test(html)) {
      return html.replace(/<section\s+class="limitations"/i, `${sectionHtml}\n\n      <section class="limitations"`);
    }

    if (/<\/main>/i.test(html)) {
      return html.replace(/<\/main>/i, `${sectionHtml}\n    </main>`);
    }
    return `${html}\n${sectionHtml}`;
  };

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
    fetchAssessorQuestions,
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
      jsonTranscript,
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

      let model;
      if (jsonTranscript !== undefined && jsonTranscript !== null && jsonTranscript !== "") {
        model = reportModule.buildReportModelFromJsonTranscript(jsonTranscript, officialQuestionBank);
      } else {
        const parsedQuestionBlocks = reportModule.parseTranscriptQuestions(fullTranscriptText);
        const manifest = reportModule.buildQuestionManifest(officialQuestionBank, parsedQuestionBlocks);
        const { analyses, warnings } = await analysePreliminaryQuestions(manifest, candidateMetadata, normalizedOptions);
        model = reportModule.buildReportModel({
          fullTranscript: fullTranscriptText,
          candidateMetadata,
          officialQuestionBank,
          reportOptions: normalizedOptions,
          questionAnalyses: analyses,
        });
        model.warnings.push(...warnings);
      }

      mergeCandidateMetadataIntoModel(model, candidateMetadata);

      let assessorQuestions = [];
      if (typeof fetchAssessorQuestions === "function") {
        try {
          const rawAssessorQuestions = await fetchAssessorQuestions({
            candidateMetadata: model?.metadata || candidateMetadata || {},
            model,
          });
          assessorQuestions = normalizeAssessorQuestionList(rawAssessorQuestions, Array.isArray(model?.questions) ? model.questions.length : 0);
        } catch (error) {
          log(`Assessor questions fetch failed: ${error?.message || String(error)}`);
        }
      }

      const baseHtml = reportModule.renderReportHtml(model);
      const html = injectAssessorQuestionsIntoHtml(baseHtml, assessorQuestions);
      const validation = reportModule.validateReportHtmlCoverage(model, baseHtml);
      if (!validation.valid) {
        throw new Error(`Generated report coverage validation failed: expected ${validation.questionCount} question row(s), got ${validation.statusRows} status row(s) and ${validation.articleCount} article(s).`);
      }

      return { html, model, validation, assessorQuestions };
    };

    return {
      buildPreliminaryReviewReport,
    };
  };

  globalScope.RplFinalReportGenerator = {
    create,
  };
})(window);
