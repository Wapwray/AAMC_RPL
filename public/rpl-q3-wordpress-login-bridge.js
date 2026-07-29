(function attachRplQ3WordPressLoginBridge(globalScope) {
  "use strict";

  const AUTH_MODE_PARAMETER = "rpl_q3_auth";
  const RETURN_URL_PARAMETER = "rpl_q3_return";
  const TOKEN_HASH_PARAMETER = "rpl_ax_token";
  const ALLOWED_RETURN_ORIGIN =
    "https://aamc-rpl-live-ecgua6ceb4fkgfh0.australiaeast-01.azurewebsites.net";
  const ALLOWED_RETURN_PATH = "/AAMC RPL 2026 Q3.html";
  const POLL_INTERVAL_MS = 250;
  const MAX_WAIT_MS = 15 * 60 * 1000;

  const getBridgeRequest = (href) => {
    try {
      const pageUrl = new URL(href);
      if (pageUrl.searchParams.get(AUTH_MODE_PARAMETER) !== "1") return null;
      const returnValue = pageUrl.searchParams.get(RETURN_URL_PARAMETER);
      if (!returnValue) return null;
      const returnUrl = new URL(returnValue);
      if (
        returnUrl.origin !== ALLOWED_RETURN_ORIGIN ||
        decodeURIComponent(returnUrl.pathname) !== ALLOWED_RETURN_PATH
      ) {
        return {
          ok: false,
          message:
            "The RPL interview return address is not valid. Please reopen the interview link supplied by AAMC Training.",
        };
      }
      return { ok: true, returnUrl };
    } catch {
      return {
        ok: false,
        message:
          "The RPL interview return address is not valid. Please reopen the interview link supplied by AAMC Training.",
      };
    }
  };

  const buildReturnUrl = (returnUrl, accessToken) => {
    const target = new URL(returnUrl.toString());
    const hashParams = new URLSearchParams(target.hash.replace(/^#/, ""));
    hashParams.set(TOKEN_HASH_PARAMETER, String(accessToken || "").trim());
    target.hash = hashParams.toString();
    return target.toString();
  };

  const ensureStatusMessage = (message, isError = false) => {
    if (typeof document === "undefined") return;
    let element = document.getElementById("rpl-q3-auth-status");
    if (!element) {
      element = document.createElement("div");
      element.id = "rpl-q3-auth-status";
      element.setAttribute("role", "status");
      const loginStep = document.getElementById("userLogin_step");
      loginStep?.prepend(element);
    }
    element.textContent = message;
    element.classList.toggle("rpl-q3-auth-error", isError);
  };

  const applyLoginOnlyLayout = () => {
    if (typeof document === "undefined") return false;
    document.documentElement.classList.add("rpl-q3-auth-mode");
    if (!document.getElementById("rpl-q3-auth-mode-style")) {
      const style = document.createElement("style");
      style.id = "rpl-q3-auth-mode-style";
      style.textContent = `
        html.rpl-q3-auth-mode #enroller > .enroller-step:not(#userLogin_step),
        html.rpl-q3-auth-mode #userLogin_step .or-continue-with,
        html.rpl-q3-auth-mode #userLogin_step #contactForm,
        html.rpl-q3-auth-mode #userLogin_step .enroller-blurb-holder {
          display: none !important;
        }
        html.rpl-q3-auth-mode #userLogin_step {
          display: block !important;
          max-width: 820px;
          margin: 28px auto 80px;
        }
        html.rpl-q3-auth-mode #userLogin_step .userLogin_step_header_header {
          margin-bottom: 26px;
        }
        #rpl-q3-auth-status {
          margin: 0 0 18px;
          padding: 12px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          background: #f8fafc;
          color: #20374b;
          font-weight: 600;
        }
        #rpl-q3-auth-status.rpl-q3-auth-error {
          border-color: #f0a5a5;
          background: #fff5f5;
          color: #9b1c1c;
        }
      `;
      document.head.append(style);
    }

    const heading = document.querySelector(
      "#userLogin_step .userLogin_step_header_header"
    );
    if (heading) heading.textContent = "Begin your AI-assisted RPL interview";
    ensureStatusMessage(
      "Log in with the student account linked to this interview."
    );
    return Boolean(document.getElementById("userLogin_step"));
  };

  const getAuthenticatedStatus = () => {
    const status = globalScope.after_init_vars?.login_status;
    if (!status || status.logged_in !== true) return null;
    const accessToken = String(status.logged_in_token || "").trim();
    const contactId = String(status.logged_in_contact || "").trim();
    if (!accessToken || !contactId) return null;
    return { accessToken, contactId };
  };

  const start = () => {
    if (!globalScope.location) return false;
    const request = getBridgeRequest(globalScope.location.href);
    if (!request) return false;
    if (!request.ok) {
      applyLoginOnlyLayout();
      ensureStatusMessage(request.message, true);
      return true;
    }

    const startedAt = Date.now();
    const check = () => {
      applyLoginOnlyLayout();
      const authenticated = getAuthenticatedStatus();
      if (authenticated) {
        const target = buildReturnUrl(
          request.returnUrl,
          authenticated.accessToken
        );
        globalScope.location.replace(target);
        return;
      }
      if (Date.now() - startedAt >= MAX_WAIT_MS) {
        globalScope.clearInterval(intervalId);
        ensureStatusMessage(
          "Your login session could not be confirmed. Please refresh this page and try again.",
          true
        );
      }
    };

    const intervalId = globalScope.setInterval(check, POLL_INTERVAL_MS);
    check();
    return true;
  };

  const api = Object.freeze({
    AUTH_MODE_PARAMETER,
    RETURN_URL_PARAMETER,
    TOKEN_HASH_PARAMETER,
    ALLOWED_RETURN_ORIGIN,
    ALLOWED_RETURN_PATH,
    getBridgeRequest,
    buildReturnUrl,
    start,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.RplQ3WordPressLoginBridge = api;

  if (
    typeof document !== "undefined" &&
    typeof globalScope.setInterval === "function"
  ) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }
})(typeof window !== "undefined" ? window : globalThis);
