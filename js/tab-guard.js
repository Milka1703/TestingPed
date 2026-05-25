/**
 * Защита от переключения вкладок.
 */
(function () {
  var app = window.__app;
  var dom = app.dom;

  function onVisibilityChange() {
    if (!app.started || app.finished) return;
    if (document.hidden && dom.tabGuardOverlay) dom.tabGuardOverlay.classList.remove("hidden");
    else if (dom.tabGuardOverlay) dom.tabGuardOverlay.classList.add("hidden");
  }

  function onWindowBlur() {
    if (!app.started || app.finished) return;
    if (dom.tabGuardOverlay) dom.tabGuardOverlay.classList.remove("hidden");
  }

  function onBeforeUnload(event) {
    if (!app.started || app.finished) return;
    event.preventDefault();
    event.returnValue = "";
  }

  app.enableTabGuard = function enableTabGuard() {
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
  };

  app.disableTabGuard = function disableTabGuard() {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("beforeunload", onBeforeUnload);
    if (dom.tabGuardOverlay) dom.tabGuardOverlay.classList.add("hidden");
  };
})();
