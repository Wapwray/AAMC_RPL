const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const auth = require("../public/rpl-q3-axcelerate-auth.js");
const bridge = require("../public/rpl-q3-wordpress-login-bridge.js");

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

test("Q3 login bridge safely retains the interview link without exposing a token", () => {
  const interviewUrl =
    "https://aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net/" +
    "AAMC%20RPL%202026%20Q3.html?fullName=Chlo%C3%AB-Anne+Middleton&givenName=Chlo%C3%AB-Anne&contactId=123456";
  const loginUrl = new URL(auth.buildLoginBridgeUrl(interviewUrl));
  const encodedReturnState = loginUrl.searchParams.get("rpl_q3_return");

  assert.equal(loginUrl.origin, "https://aamctraining.edu.au");
  assert.equal(loginUrl.pathname, "/rpl-pre-eligibility-test/");
  assert.equal(loginUrl.searchParams.get("rpl_q3_auth"), "1");
  assert.match(encodedReturnState, /^v1\.[A-Za-z0-9_-]+$/);
  assert.equal(bridge.decodeReturnState(encodedReturnState), interviewUrl);
  assert.equal(loginUrl.hash, "");
});

test("Q3 launcher marks the return as an application window", () => {
  const interviewUrl =
    "https://aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net/" +
    "AAMC%20RPL%202026%20Q3.html?fullName=Billy+Broker&givenName=Billy&contactId=123456";
  const appWindowUrl = new URL(auth.buildAppWindowReturnUrl(interviewUrl));

  assert.equal(appWindowUrl.searchParams.get("rpl_app_window"), "1");
  assert.equal(auth.isAppWindowUrl(appWindowUrl.toString()), true);
  assert.equal(auth.isAppWindowUrl(interviewUrl), false);
  assert.equal(appWindowUrl.hash, "");
});

test("Q3 application popup is resizable, scrollable and sized to the screen", () => {
  const features = auth.buildPopupFeatures(1920, 1080);

  assert.match(features, /popup=yes/);
  assert.match(features, /width=1440/);
  assert.match(features, /height=1000/);
  assert.match(features, /resizable=yes/);
  assert.match(features, /scrollbars=yes/);
});

test("Q3 access token is accepted only from the URL hash", () => {
  assert.equal(
    auth.getTokenFromHash("#rpl_ax_token=header.payload.signature"),
    "header.payload.signature"
  );
  assert.equal(auth.getTokenFromHash(""), "");
  assert.equal(auth.getTokenFromHash("#other=value"), "");
  assert.doesNotMatch(
    auth.removeTokenHash(
      "https://example.test/interview?contactId=123456#rpl_ax_token=secret"
    ),
    /secret|rpl_ax_token/
  );
});

test("authenticated ContactID must match the interview ContactID", () => {
  assert.equal(auth.compareContactIds("123456", "123456").ok, true);
  const mismatch = auth.compareContactIds("123456", "654321");
  assert.equal(mismatch.ok, false);
  assert.equal(mismatch.code, "contact_mismatch");
  assert.match(mismatch.message, /does not match this interview link/i);
});

test("WordPress bridge permits only the production Q3 return address", () => {
  const validReturn =
    "https://aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net/" +
    "AAMC%20RPL%202026%20Q3.html?contactId=123456";
  const validRequest = bridge.getBridgeRequest(
    `https://aamctraining.edu.au/rpl-pre-eligibility-test/?rpl_q3_auth=1&` +
      `rpl_q3_return=${encodeURIComponent(validReturn)}`
  );
  assert.equal(validRequest.ok, true);

  const encodedRequest = bridge.getBridgeRequest(
    `https://aamctraining.edu.au/rpl-pre-eligibility-test/?rpl_q3_auth=1&` +
      `rpl_q3_return=${encodeURIComponent(auth.encodeReturnState(validReturn))}`
  );
  assert.equal(encodedRequest.ok, true);
  assert.equal(encodedRequest.returnUrl.toString(), validReturn);

  const invalidRequest = bridge.getBridgeRequest(
    "https://aamctraining.edu.au/rpl-pre-eligibility-test/?rpl_q3_auth=1&" +
      "rpl_q3_return=https%3A%2F%2Fevil.example%2Fsteal"
  );
  assert.equal(invalidRequest.ok, false);
});

test("aXcelerate pre-access gate is limited to the Q3 entry page", () => {
  assert.match(q3Page, /const WELCOME_VERSION = "V3\.1"/);
  assert.match(q3Page, /src="rpl-q3-axcelerate-auth\.js"/);
  assert.match(q3Page, /ensureAxcelerateAccess/);
  assert.match(q3Page, /renderLoginLauncher/);
  assert.match(q3Page, /window\.open\(/);
  assert.match(q3Page, /auth\.APP_WINDOW_NAME/);
  assert.match(q3Page, /auth\.APP_WINDOW_MESSAGE_TYPE/);
  assert.match(q3Page, /\/api\/axcelerate\/verify-login/);
  assert.doesNotMatch(
    q3Page,
    /window\.location\.replace\(auth\.buildLoginBridgeUrl/
  );
  assert.doesNotMatch(mainPage, /rpl-q3-axcelerate-auth\.js/);
  assert.doesNotMatch(autoTesterPage, /rpl-q3-axcelerate-auth\.js/);
});

test("server validates the short-lived token through the WordPress plugin", () => {
  assert.match(server, /app\.post\("\/api\/axcelerate\/verify-login"/);
  assert.match(server, /action:\s*"ax_validate_access_token"/);
  assert.match(server, /validation\?\.logged_in_contact/);
  assert.match(server, /Cache-Control", "no-store"/);
  assert.doesNotMatch(server, /console\.(?:log|error)\([^)]*accessToken/);
});
