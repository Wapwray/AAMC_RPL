const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const publicDir = path.join(__dirname, "..", "public");
const q3Page = fs.readFileSync(
  path.join(publicDir, "AAMC RPL 2026 Q3.html"),
  "utf8"
);
const mainPage = fs.readFileSync(
  path.join(publicDir, "AAMC RPL 2026.html"),
  "utf8"
);
const autoTesterPage = fs.readFileSync(
  path.join(publicDir, "AAMC RPL 2026 Q3 Auto Tester.html"),
  "utf8"
);
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");

test("Q3 loads the interview directly without the intermediate launcher", () => {
  assert.match(q3Page, /const WELCOME_VERSION = "V3\.5"/);
  assert.match(q3Page, /captureLaunchContext\(\);[\s\S]*?removeStudentDetailsFromVisibleUrl\(\);[\s\S]*?fetch\(sourceUrl/);
  assert.doesNotMatch(q3Page, /Open your RPL interview|Open the interview/);
  assert.doesNotMatch(q3Page, /renderAppLauncher|window\.open\(/);
  assert.doesNotMatch(q3Page, /src="rpl-q3-app-window\.js"/);
});

test("Q3 retains launch context per tab and removes student details from the visible URL", () => {
  assert.match(q3Page, /Object\.fromEntries\(url\.searchParams\.entries\(\)\)/);
  assert.match(q3Page, /sessionStorage\.setItem\(LAUNCH_CONTEXT_STORAGE_KEY/);
  assert.match(q3Page, /sessionStorage\.getItem\(LAUNCH_CONTEXT_STORAGE_KEY\)/);
  assert.match(q3Page, /window\.RPLLaunchParams = launchContext/);
  assert.match(q3Page, /window\.history\.replaceState\(window\.history\.state, document\.title, cleanUrl\)/);
  assert.match(mainPage, /launchParams\.fullName/);
  assert.match(mainPage, /launchParams\.contactId/);
  assert.match(mainPage, /document\.body\.dataset\.courseName/);
  assert.match(mainPage, /document\.body\?\.dataset\?\.courseName/);
});

test("question progress uses the asked-question position while source numbers remain authoritative elsewhere", () => {
  const headerFunction = mainPage.match(
    /const updateQuestionAttemptHeader = \(attemptCount = currentAttempts\) => \{([\s\S]*?)\n      \};/
  );
  assert.ok(headerFunction);
  assert.match(headerFunction[1], /const total = questions\.length/);
  assert.match(headerFunction[1], /currentIndex \+ 1/);
  assert.doesNotMatch(headerFunction[1], /allQuestions|getCurrentQuestionNumber/);
  assert.match(mainPage, /const getCurrentQuestionNumber = \(\) => getQuestionNumber\(questions\[currentIndex\], currentIndex\)/);
});

test("Q3 direct entry contains no aXcelerate integration", () => {
  assert.doesNotMatch(q3Page, /aXcelerate|axcelerate|rpl_ax_token|verify-login/i);
  assert.doesNotMatch(server, /aXcelerate|axcelerate|verify-login/i);
  assert.doesNotMatch(mainPage, /rpl-q3-app-window\.js/);
  assert.doesNotMatch(autoTesterPage, /rpl-q3-app-window\.js/);
});
