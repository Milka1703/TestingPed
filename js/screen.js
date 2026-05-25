/**
 * Управление экранами и отображением.
 */
(function () {
  var app = window.__app;
  var dom = app.dom;

  app.showScreen = function showScreen(screenId) {
    var screens = [dom.homeScreen, dom.teacherScreen, dom.candidateScreen, dom.quizScreen];
    screens.forEach(function (screen) {
      if (screen) screen.classList.toggle("hidden", screen.id !== screenId);
    });
  };

  app.setSelectedTestType = function setSelectedTestType(typeId) {
    app.selectedTestType = typeId || null;
    if (app.selectedTestType) {
      document.body.dataset.testType = app.selectedTestType;
    } else {
      delete document.body.dataset.testType;
    }
  };

  app.isCandidateTest = function isCandidateTest(typeId) {
    return typeId === "candidate_test";
  };

  app.normalizeTestType = function normalizeTestType(value) {
    return app.TEST_TYPE_ALIASES[String(value || "").trim().toLowerCase()] || null;
  };

  app.getLinkedTestType = function getLinkedTestType() {
    var params = new URLSearchParams(window.location.search);
    return (
      app.normalizeTestType(params.get("test")) ||
      app.normalizeTestType(params.get("role")) ||
      app.normalizeTestType(window.location.hash.replace(/^#/, ""))
    );
  };

  app.getStartScreenId = function getStartScreenId(typeId) {
    return app.TEST_SCREEN_BY_TYPE[typeId] || "home-screen";
  };

  app.showStartScreen = function showStartScreen(typeId) {
    app.setSelectedTestType(typeId);
    app.showScreen(app.getStartScreenId(typeId));
  };

  app.setNavLocked = function setNavLocked(locked) {
    dom.navLinks.forEach(function (link) {
      if (locked) {
        link.setAttribute("data-locked", "1");
        link.style.pointerEvents = "none";
        link.style.opacity = "0.45";
      } else {
        link.removeAttribute("data-locked");
        link.style.pointerEvents = "";
        link.style.opacity = "";
      }
    });
  };

  app.updateTimerDisplay = function updateTimerDisplay() {
    if (!dom.timerEl) return;
    dom.timerEl.textContent = app.formatTime(Math.max(app.leftSec, 0));
    dom.timerEl.classList.toggle("timer-urgent", app.started && !app.finished && app.leftSec > 0 && app.leftSec <= 180);
    if (app.started && !app.finished && app.leftSec <= 180 && app.leftSec > 0 && !app.timerWarningShown) {
      app.timerWarningShown = true;
      if (dom.timerWarning) dom.timerWarning.classList.remove("hidden");
    }
  };

  app.updateProgress = function updateProgress() {
    if (!dom.quizProgress || !app.questions.length) return;
    dom.quizProgress.textContent = "Вопрос " + (app.currentIndex + 1) + " из " + app.questions.length;
  };

  app.updateNavButtons = function updateNavButtons() {
    if (dom.prevBtn) dom.prevBtn.disabled = app.currentIndex <= 0;
    if (dom.nextBtn) dom.nextBtn.classList.toggle("hidden", app.currentIndex >= app.questions.length - 1);
    if (dom.submitBtn) dom.submitBtn.classList.toggle("hidden", app.currentIndex < app.questions.length - 1);
  };

  app.setDeliveryStatus = function setDeliveryStatus(message, isError) {
    if (!dom.resultDeliveryStatus) return;
    dom.resultDeliveryStatus.textContent = message;
    dom.resultDeliveryStatus.classList.remove("hidden");
    dom.resultDeliveryStatus.classList.toggle("bad", !!isError);
  };
})();
