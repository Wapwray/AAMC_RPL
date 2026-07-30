(function attachRplQ3AxcelerateAuth(globalScope) {
  "use strict";

  const WORDPRESS_LOGIN_URL =
    "https://aamctraining.edu.au/rpl-pre-eligibility-test/";
  const AUTH_MODE_PARAMETER = "rpl_q3_auth";
  const RETURN_URL_PARAMETER = "rpl_q3_return";
  const TOKEN_HASH_PARAMETER = "rpl_ax_token";
  const APP_WINDOW_PARAMETER = "rpl_app_window";
  const APP_WINDOW_NAME = "AAMCRPLInterview";
  const APP_WINDOW_MESSAGE_TYPE = "rpl-q3-app-opened";
  const RETURN_STATE_PREFIX = "v1.";

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

  const buildAppWindowReturnUrl = (href) => {
    const url = new URL(removeTokenHash(href));
    url.searchParams.set(APP_WINDOW_PARAMETER, "1");
    return url.toString();
  };

  const isAppWindowUrl = (href) => {
    try {
      return new URL(href).searchParams.get(APP_WINDOW_PARAMETER) === "1";
    } catch {
      return false;
    }
  };

  const encodeReturnState = (value) => {
    const text = String(value || "");
    let base64 = "";
    if (typeof Buffer !== "undefined") {
      base64 = Buffer.from(text, "utf8").toString("base64");
    } else {
      const bytes = new TextEncoder().encode(text);
      let binary = "";
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      base64 = globalScope.btoa(binary);
    }
    return `${RETURN_STATE_PREFIX}${base64
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "")}`;
  };

  const buildPopupFeatures = (screenWidth, screenHeight) => {
    const availableWidth = Math.max(960, Number(screenWidth) || 1440);
    const availableHeight = Math.max(720, Number(screenHeight) || 900);
    const width = Math.min(1440, Math.max(1100, availableWidth - 80));
    const height = Math.min(1000, Math.max(760, availableHeight - 80));
    const left = Math.max(0, Math.round((availableWidth - width) / 2));
    const top = Math.max(0, Math.round((availableHeight - height) / 2));
    return [
      "popup=yes",
      `width=${width}`,
      `height=${height}`,
      `left=${left}`,
      `top=${top}`,
      "resizable=yes",
      "scrollbars=yes",
    ].join(",");
  };

  const buildLoginBridgeUrl = (href) => {
    const returnUrl = new URL(removeTokenHash(href));
    const loginUrl = new URL(WORDPRESS_LOGIN_URL);
    loginUrl.searchParams.set(AUTH_MODE_PARAMETER, "1");
    loginUrl.searchParams.set(
      RETURN_URL_PARAMETER,
      encodeReturnState(returnUrl.toString())
    );
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
    APP_WINDOW_PARAMETER,
    APP_WINDOW_NAME,
    APP_WINDOW_MESSAGE_TYPE,
    RETURN_STATE_PREFIX,
    normaliseContactId,
    getExpectedContactId,
    getTokenFromHash,
    removeTokenHash,
    buildAppWindowReturnUrl,
    isAppWindowUrl,
    buildPopupFeatures,
    encodeReturnState,
    buildLoginBridgeUrl,
    compareContactIds,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.RplQ3AxcelerateAuth = api;
})(typeof window !== "undefined" ? window : globalThis);
