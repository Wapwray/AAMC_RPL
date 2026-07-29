(function attachRplQ3AxcelerateAuth(globalScope) {
  "use strict";

  const WORDPRESS_LOGIN_URL =
    "https://aamctraining.edu.au/rpl-pre-eligibility-test/";
  const AUTH_MODE_PARAMETER = "rpl_q3_auth";
  const RETURN_URL_PARAMETER = "rpl_q3_return";
  const TOKEN_HASH_PARAMETER = "rpl_ax_token";

  const cleanValue = (value) => String(value ?? "").trim();

  const normaliseContactId = (value) => {
    const cleaned = cleanValue(value);
    return /^\d+$/.test(cleaned) ? cleaned : "";
  };

  const getExpectedContactId = (href) => {
    try {
      return normaliseContactId(new URL(href).searchParams.get("contactId"));
    } catch {
      return "";
    }
  };

  const getTokenFromHash = (hashValue) => {
    const rawHash = cleanValue(hashValue).replace(/^#/, "");
    if (!rawHash) return "";
    const token = cleanValue(new URLSearchParams(rawHash).get(TOKEN_HASH_PARAMETER));
    if (!token || token.length > 8192 || /[\u0000-\u001f\u007f]/.test(token)) {
      return "";
    }
    return token;
  };

  const removeTokenHash = (href) => {
    const url = new URL(href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    hashParams.delete(TOKEN_HASH_PARAMETER);
    const remainingHash = hashParams.toString();
    url.hash = remainingHash ? `#${remainingHash}` : "";
    return url.toString();
  };

  const buildLoginBridgeUrl = (href) => {
    const returnUrl = new URL(removeTokenHash(href));
    const loginUrl = new URL(WORDPRESS_LOGIN_URL);
    loginUrl.searchParams.set(AUTH_MODE_PARAMETER, "1");
    loginUrl.searchParams.set(RETURN_URL_PARAMETER, returnUrl.toString());
    return loginUrl.toString();
  };

  const compareContactIds = (expectedContactId, authenticatedContactId) => {
    const expected = normaliseContactId(expectedContactId);
    const authenticated = normaliseContactId(authenticatedContactId);
    if (!expected) {
      return {
        ok: false,
        code: "missing_expected_contact",
        message:
          "The interview link does not contain a valid Contact ID. Please check the link you were provided.",
      };
    }
    if (!authenticated) {
      return {
        ok: false,
        code: "missing_authenticated_contact",
        message:
          "Your aXcelerate login could not be matched to a valid Contact ID. Please check your login details.",
      };
    }
    if (expected !== authenticated) {
      return {
        ok: false,
        code: "contact_mismatch",
        message:
          "The Contact ID for your aXcelerate login does not match this interview link. Please check your details and log in with the correct student account.",
      };
    }
    return { ok: true, code: "matched", message: "" };
  };

  const api = Object.freeze({
    WORDPRESS_LOGIN_URL,
    AUTH_MODE_PARAMETER,
    RETURN_URL_PARAMETER,
    TOKEN_HASH_PARAMETER,
    normaliseContactId,
    getExpectedContactId,
    getTokenFromHash,
    removeTokenHash,
    buildLoginBridgeUrl,
    compareContactIds,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.RplQ3AxcelerateAuth = api;
})(typeof window !== "undefined" ? window : globalThis);
