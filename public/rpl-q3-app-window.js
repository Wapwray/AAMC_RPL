(function attachRplQ3AppWindow(globalScope) {
  "use strict";

  const APP_WINDOW_PARAMETER = "rpl_app_window";
  const APP_WINDOW_NAME = "AAMCRPLInterview";
  const APP_WINDOW_MESSAGE_TYPE = "rpl-q3-app-opened";

  const buildAppWindowUrl = (href) => {
    const url = new URL(href);
    url.searchParams.set(APP_WINDOW_PARAMETER, "1");
    url.hash = "";
    return url.toString();
  };

  const isAppWindowUrl = (href) => {
    try {
      return new URL(href).searchParams.get(APP_WINDOW_PARAMETER) === "1";
    } catch {
      return false;
    }
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

  const api = Object.freeze({
    APP_WINDOW_PARAMETER,
    APP_WINDOW_NAME,
    APP_WINDOW_MESSAGE_TYPE,
    buildAppWindowUrl,
    isAppWindowUrl,
    buildPopupFeatures,
  });

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  globalScope.RplQ3AppWindow = api;
})(typeof window !== "undefined" ? window : globalThis);
