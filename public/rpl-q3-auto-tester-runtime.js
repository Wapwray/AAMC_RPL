(() => {
  const REPORT_BASE = "https://aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net/RPL%20Report%20Generator%20-%20Assessor.html";
  const CONTINUE_SIGNAL = /next question button to continue|press the next button to continue/i;
  const SESSION_JSON_KEY = "rpl_auto_tester_uploaded_json";

  const state = {
    loaded: null,
    running: false,
    stopped: false,
    currentQuestion: null,
    nextAttemptIndex: 0,
    logLines: [],
  };

  const byId = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const waitFor = async (predicate, timeoutMs = 60000, intervalMs = 120) => {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      let ok = false;
      try { ok = Boolean(predicate()); } catch {}
      if (ok) return true;
      await wait(intervalMs);
    }
    return false;
  };

  const panelCss = `
    #autoTesterPanel {
      position: fixed;
      right: 16px;
      bottom: 16px;
      width: min(520px, calc(100vw - 32px));
      z-index: 99999;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      box-shadow: 0 16px 28px rgba(15, 23, 42, 0.2);
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      color: #0f172a;
    }
    #autoTesterPanelHeader {
      font-weight: 700;
      font-size: 14px;
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 12px 12px 0 0;
    }
    #autoTesterPanelBody {
      padding: 10px 12px 12px;
      display: grid;
      gap: 8px;
    }
    #autoTesterPanelBody .row {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    #autoTesterPanelBody button {
      border: 1px solid #94a3b8;
      background: #0b6ea9;
      color: #fff;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    #autoTesterStopBtn {
      background: #9f1239;
    }
    #autoTesterStartBtn:disabled,
    #autoTesterStopBtn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    #autoTesterStatus {
      font-size: 12px;
      color: #334155;
      min-height: 18px;
      white-space: pre-wrap;
    }
    #autoTesterLog {
      margin: 0;
      background: #0f172a;
      color: #dbeafe;
      border-radius: 8px;
      padding: 10px;
      min-height: 120px;
      max-height: 220px;
      overflow: auto;
      font-size: 11px;
      line-height: 1.4;
      white-space: pre-wrap;
    }
  `;

  const setStatus = (message) => {
    const el = byId("autoTesterStatus");
    if (el) el.textContent = message;
  };

  const addLog = (label, detail) => {
    const stamp = new Date().toLocaleTimeString();
    const text = detail === undefined
      ? label
      : `${label}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`;
    state.logLines.push(`[${stamp}] ${text}`);
    if (state.logLines.length > 400) state.logLines = state.logLines.slice(-400);
    const el = byId("autoTesterLog");
    if (el) {
      el.textContent = state.logLines.join("\n");
      el.scrollTop = el.scrollHeight;
    }
  };

  const normalizeString = (value) => String(value === undefined || value === null ? "" : value).trim();

  const getGivenNameFromFullName = (fullName) => {
    const parts = normalizeString(fullName).split(/\s+/).filter(Boolean);
    return parts[0] || "";
  };

  // Transcript attempts may be prefixed like "Attempt 1: ..." — strip the
  // prefix so only the answer text is submitted.
  const stripAttemptPrefix = (text) => {
    return normalizeString(text).replace(/^attempt\s*\d+\s*(?:\([^)]*\))?\s*[:\-\u2013\u2014.]?\s*/i, "").trim();
  };

  const parseTranscriptJson = (json) => {
    const candidate = json && typeof json === "object" ? (json.candidate || {}) : {};
    const fullName = normalizeString(candidate.fullName || json?.fullName || "");
    const givenName = normalizeString(candidate.givenName || json?.givenName || getGivenNameFromFullName(fullName));
    const contactId = normalizeString(candidate.contactId || json?.contactId || "");
    const industry = normalizeString(candidate.industry || json?.industry || "Lending");
    const jobTitle = normalizeString(candidate.jobTitle || json?.jobTitle || "Mortgage Broker");

    const questionMap = new Map();
    const questions = Array.isArray(json?.questions) ? json.questions : [];
    questions.forEach((question) => {
      const questionNumber = normalizeString(question?.questionNumber);
      if (!questionNumber) return;
      const attempts = Array.isArray(question?.attempts)
        ? question.attempts
            .map((attempt) => stripAttemptPrefix(attempt?.answer || attempt?.responseText || attempt?.response || ""))
            .filter(Boolean)
        : [];
      questionMap.set(questionNumber, attempts);
    });

    if (!fullName || !contactId || !questionMap.size) {
      throw new Error("JSON must include candidate fullName/contactId and at least one question with attempts.");
    }

    return {
      fullName,
      givenName: givenName || getGivenNameFromFullName(fullName),
      contactId,
      industry,
      jobTitle,
      questionMap,
    };
  };

  const getSessionStudentContext = () => {
    const info = window.RPLStudentInfo || {};
    const dataset = document.body?.dataset || {};
    const fullName = normalizeString(info.fullName || info.studentName || dataset.fullName || "") || (state.loaded?.fullName || "");
    const givenName = normalizeString(info.givenName || dataset.givenName || "") || getGivenNameFromFullName(fullName);
    const contactId = normalizeString(info.contactId || dataset.contactId || "") || (state.loaded?.contactId || "");
    return { fullName, givenName, contactId };
  };

  const getCurrentQuestionNumber = () => {
    const header = normalizeString(byId("headerTitle")?.textContent || "");
    const match = header.match(/Question\s+(\d+)/i);
    return match ? match[1] : "";
  };

  const getLastAiMessage = () => {
    const entries = Array.from(document.querySelectorAll("#chatHistory .chatEntry.ai"));
    const last = entries.length ? entries[entries.length - 1] : null;
    return normalizeString(last?.textContent || "");
  };

  const isCompletionVisible = () => {
    const completion = byId("completionScreen");
    return Boolean(completion && !completion.classList.contains("hidden"));
  };

  const ensureReportLink = () => {
    if (!isCompletionVisible() || !state.loaded) return;
    const completionBody = byId("completionBody");
    if (!completionBody) return;
    if (completionBody.querySelector("#autoTesterReportLink")) return;

    const { fullName, givenName, contactId } = getSessionStudentContext();
    if (!fullName || !contactId) return;
    const params = new URLSearchParams({
      fullName,
      givenName,
      contactId,
      assessorName: "Richard Wray",
      assessorEmail: "rwray@aamctraining.edu.au",
    });

    const wrap = document.createElement("div");
    wrap.style.marginTop = "12px";
    const anchor = document.createElement("a");
    anchor.id = "autoTesterReportLink";
    anchor.href = `${REPORT_BASE}?${params.toString()}`;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = `View Report - ${fullName}`;
    anchor.style.color = "#0b6ea9";
    anchor.style.fontWeight = "700";
    wrap.appendChild(anchor);
    completionBody.appendChild(wrap);
  };

  const setRunningUi = (isRunning) => {
    const startBtn = byId("autoTesterStartBtn");
    const stopBtn = byId("autoTesterStopBtn");
    const fileInput = byId("autoTesterFileInput");
    if (startBtn) startBtn.disabled = isRunning || !state.loaded;
    if (stopBtn) stopBtn.disabled = !isRunning;
    if (fileInput) fileInput.disabled = isRunning;
  };

  const isQuizVisible = () => {
    const quizCard = byId("quizCard");
    return Boolean(quizCard && !quizCard.classList.contains("hidden"));
  };

  // Automation must not begin until the user has completed the welcome and
  // Student Information pages themselves and pressed the Begin button.
  const waitForUserToPressBegin = async () => {
    if (isQuizVisible()) return;
    setStatus("Waiting for you to press Begin on the Student Information page...");
    addLog("Waiting", "Complete the welcome/Student Information pages and press Begin");
    while (!state.stopped) {
      if (isQuizVisible()) {
        addLog("Assessment", "Question screen detected - automation starting");
        return;
      }
      await wait(300);
    }
    throw new Error("Stopped while waiting for Begin.");
  };

  const submitAttempt = async (answerText) => {
    const answerInput = byId("answerInput");
    const evaluateBtn = byId("evaluateBtn");
    if (!answerInput || !evaluateBtn) {
      throw new Error("Answer input or Evaluate button not found.");
    }

    answerInput.value = answerText;
    answerInput.dispatchEvent(new Event("input", { bubbles: true }));

    const evaluateEnabled = await waitFor(() => !evaluateBtn.disabled, 120000);
    if (!evaluateEnabled) throw new Error("Evaluate button did not become enabled after setting answer.");

    const previousAiCount = document.querySelectorAll("#chatHistory .chatEntry.ai").length;
    evaluateBtn.click();
    addLog("Evaluate", { answerChars: answerText.length });

    const gotAi = await waitFor(() => {
      const thinkingHidden = byId("thinkingOverlay")?.classList.contains("hidden") !== false;
      const aiCount = document.querySelectorAll("#chatHistory .chatEntry.ai").length;
      return thinkingHidden && aiCount > previousAiCount;
    }, 180000);

    if (!gotAi) {
      throw new Error("No AI response received after Evaluate.");
    }

    const message = getLastAiMessage();
    if (!message) throw new Error("AI feedback was empty after Evaluate.");

    const shouldContinue = CONTINUE_SIGNAL.test(message);
    return { shouldContinue, message };
  };

  const goNextQuestion = async () => {
    const nextBtn = byId("nextBtn");
    if (!nextBtn) throw new Error("Next Question button not found.");

    const enabled = await waitFor(() => !nextBtn.disabled, 120000);
    if (!enabled) throw new Error("Next Question button did not become enabled.");

    const before = getCurrentQuestionNumber();
    nextBtn.click();
    addLog("Next", before ? `from question ${before}` : "clicked");

    const moved = await waitFor(() => {
      if (isCompletionVisible()) return true;
      const now = getCurrentQuestionNumber();
      return now && now !== before;
    }, 120000);

    if (!moved) {
      throw new Error("Next Question did not advance to a new question.");
    }
  };

  const runAutoTest = async () => {
    state.running = true;
    state.stopped = false;
    state.currentQuestion = null;
    state.nextAttemptIndex = 0;
    setRunningUi(true);

    await waitForUserToPressBegin();
    setStatus("Running transcript-driven attempts...");

    while (state.running && !state.stopped) {
      ensureReportLink();
      if (isCompletionVisible()) {
        addLog("Completed", "Assessment reached completion screen");
        break;
      }

      const questionNumber = getCurrentQuestionNumber();
      if (!questionNumber) {
        await wait(250);
        continue;
      }

      if (state.currentQuestion !== questionNumber) {
        state.currentQuestion = questionNumber;
        state.nextAttemptIndex = 0;
        addLog("Question", questionNumber);
      }

      const attempts = state.loaded.questionMap.get(questionNumber) || [];
      if (state.nextAttemptIndex >= attempts.length) {
        addLog("Attempt source", `No transcript attempt for Q${questionNumber}; moving next.`);
        await goNextQuestion();
        continue;
      }

      const answer = attempts[state.nextAttemptIndex];
      const attemptOrdinal = state.nextAttemptIndex + 1;
      addLog("Submitting", `Q${questionNumber} attempt ${attemptOrdinal}`);

      const result = await submitAttempt(answer);
      state.nextAttemptIndex += 1;

      if (result.shouldContinue) {
        addLog("System guidance", "Move to next question");
        await goNextQuestion();
        continue;
      }

      if (state.nextAttemptIndex >= attempts.length) {
        addLog("System guidance", `Not yet sufficient and no more transcript attempts for Q${questionNumber}; moving next.`);
        await goNextQuestion();
      }
    }

    state.running = false;
    setRunningUi(false);
    ensureReportLink();
    setStatus(state.stopped ? "Stopped." : "Completed. Report link added to final screen.");
  };

  const startAutoTestIfReady = async (sourceLabel = "manual") => {
    if (state.running || !state.loaded) return;
    state.autoStartPending = false;
    addLog("Auto tester", `Auto-starting from ${sourceLabel}`);
    try {
      await runAutoTest();
    } catch (error) {
      const message = error?.message || String(error);
      setStatus(`Auto test failed: ${message}`);
      addLog("Auto test failed", message);
      state.running = false;
      setRunningUi(false);
    }
  };

  const stopAutoTest = () => {
    state.stopped = true;
    state.running = false;
    setRunningUi(false);
    setStatus("Stopped.");
    addLog("Auto tester", "Stopped by user");
  };

  const loadJsonFromFile = async (file) => {
    const text = await file.text();
    const parsed = JSON.parse(text);
    state.loaded = parseTranscriptJson(parsed);
    const qCount = state.loaded.questionMap.size;
    setStatus(`Loaded ${state.loaded.fullName} (${state.loaded.contactId}) with ${qCount} question(s).`);
    addLog("JSON loaded", {
      fullName: state.loaded.fullName,
      contactId: state.loaded.contactId,
      questions: qCount,
    });
    setRunningUi(false);
  };

  const loadJsonFromText = (text, sourceLabel = "session") => {
    const parsed = JSON.parse(text);
    state.loaded = parseTranscriptJson(parsed);
    const qCount = state.loaded.questionMap.size;
    setStatus(`Loaded ${state.loaded.fullName} (${state.loaded.contactId}) with ${qCount} question(s).`);
    addLog("JSON loaded", {
      source: sourceLabel,
      fullName: state.loaded.fullName,
      contactId: state.loaded.contactId,
      questions: qCount,
    });
    setRunningUi(false);
  };

  const installPanel = () => {
    const style = document.createElement("style");
    style.textContent = panelCss;
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "autoTesterPanel";
    panel.innerHTML = `
      <div id="autoTesterPanelHeader">Q3 Auto Tester</div>
      <div id="autoTesterPanelBody">
        <div class="row">
          <input id="autoTesterFileInput" type="file" accept="application/json,.json" />
        </div>
        <div class="row">
          <button id="autoTesterStartBtn" type="button" disabled>Start Auto Test</button>
          <button id="autoTesterStopBtn" type="button" disabled>Stop</button>
        </div>
        <div id="autoTesterStatus">Choose a transcript .json file to begin.</div>
        <pre id="autoTesterLog">Ready.</pre>
      </div>
    `;
    document.body.appendChild(panel);
  };

  const wirePanel = () => {
    const fileInput = byId("autoTesterFileInput");
    const startBtn = byId("autoTesterStartBtn");
    const stopBtn = byId("autoTesterStopBtn");

    fileInput?.addEventListener("change", async (event) => {
      const file = event.target?.files?.[0];
      if (!file) return;
      try {
        await loadJsonFromFile(file);
      } catch (error) {
        const message = error?.message || String(error);
        setStatus(`Load failed: ${message}`);
        addLog("Load failed", message);
      }
    });

    startBtn?.addEventListener("click", async () => {
      if (state.running) return;
      if (!state.loaded) {
        setStatus("Choose a transcript .json file first.");
        return;
      }
      try {
        await runAutoTest();
      } catch (error) {
        const message = error?.message || String(error);
        setStatus(`Auto test failed: ${message}`);
        addLog("Auto test failed", message);
        state.running = false;
        setRunningUi(false);
      }
    });

    stopBtn?.addEventListener("click", () => stopAutoTest());
  };

  const init = () => {
    installPanel();
    wirePanel();
    setRunningUi(false);
    try {
      const bootTranscript = sessionStorage.getItem(SESSION_JSON_KEY);
      if (bootTranscript) {
        loadJsonFromText(bootTranscript, "answers table");
        setStatus("Loaded from answers table. Complete Welcome page and press Begin.");
        addLog("Auto tester", "Using the answer rows generated before opening the assessment.");
        addLog("Auto tester", "Auto-starting from answers table");
        window.setTimeout(() => startAutoTestIfReady("answers table"), 0);
      } else {
        setStatus("Ready. Select a JSON file to upload, then press Start Auto Test.");
        addLog("Auto tester", "Ready. Select a JSON file and press Start Auto Test.");
      }
    } catch (error) {
      const message = error?.message || String(error);
      setStatus(`Could not load the generated answers table: ${message}`);
      addLog("Startup load failed", message);
    }
    window.setInterval(ensureReportLink, 1000);
  };

  const shouldActivate = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("autoTester") === "1") return true;
    try {
      return Boolean(sessionStorage.getItem(SESSION_JSON_KEY));
    } catch {
      return false;
    }
  };

  if (shouldActivate()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
      init();
    }
  }
})();
