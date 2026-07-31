const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const appWindow = require("../public/rpl-q3-app-window.js");

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

test("Q3 launcher preserves student details in the application window URL", () => {
  const interviewUrl =
    "https://aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net/" +
    "AAMC%20RPL%202026%20Q3.html?fullName=Chlo%C3%AB-Anne+Middleton&givenName=Chlo%C3%AB-Anne&contactId=123456";
  const appWindowUrl = new URL(appWindow.buildAppWindowUrl(interviewUrl));

  assert.equal(appWindowUrl.searchParams.get("fullName"), "Chloë-Anne Middleton");
  assert.equal(appWindowUrl.searchParams.get("givenName"), "Chloë-Anne");
  assert.equal(appWindowUrl.searchParams.get("contactId"), "123456");
  assert.equal(appWindowUrl.searchParams.get("rpl_app_window"), "1");
  assert.equal(appWindow.isAppWindowUrl(appWindowUrl.toString()), true);
  assert.equal(appWindow.isAppWindowUrl(interviewUrl), false);
  assert.equal(appWindowUrl.hash, "");
});

test("Q3 application popup is resizable, scrollable and sized to the screen", () => {
  const features = appWindow.buildPopupFeatures(1920, 1080);

  assert.match(features, /popup=yes/);
  assert.match(features, /width=1440/);
  assert.match(features, /height=1000/);
  assert.match(features, /resizable=yes/);
  assert.match(features, /scrollbars=yes/);
});

test("Q3 uses the standalone application launcher without aXcelerate code", () => {
  assert.match(q3Page, /const WELCOME_VERSION = "V3\.4"/);
  assert.match(q3Page, /src="rpl-q3-app-window\.js"/);
  assert.match(q3Page, /renderAppLauncher/);
  assert.match(q3Page, /window\.open\(/);
  assert.match(q3Page, /appWindowRuntime\.APP_WINDOW_NAME/);
  assert.match(q3Page, /appWindowRuntime\.APP_WINDOW_MESSAGE_TYPE/);
  assert.doesNotMatch(q3Page, /aXcelerate|axcelerate|rpl_ax_token|verify-login/i);
  assert.doesNotMatch(server, /aXcelerate|axcelerate|verify-login/i);
  assert.doesNotMatch(mainPage, /rpl-q3-app-window\.js/);
  assert.doesNotMatch(autoTesterPage, /rpl-q3-app-window\.js/);
});
