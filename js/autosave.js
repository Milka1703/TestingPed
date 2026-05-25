/**
 * Автосохранение и восстановление прогресса.
 */
(function () {
  var app = window.__app;
  var dom = app.dom;

  function getAutosaveKey() {
    return app.AUTOSAVE_PREFIX + "_" + (app.testType || "none");
  }

  app.saveProgress = function saveProgress() {
    if (!app.started || app.finished || !app.testType) return;
    if (app._saveTimeout) clearTimeout(app._saveTimeout);
    app._saveTimeout = setTimeout(function () {
      app._saveTimeout = null;
      app.collectAnswer(app.currentIndex);
      localStorage.setItem(getAutosaveKey(), JSON.stringify({
        testType: app.testType,
        participantFullName: app.participantFullName,
        participantEmail: app.participantEmail,
        leftSec: app.leftSec,
        currentIndex: app.currentIndex,
        sessionStartMs: app.sessionStartMs,
        timerWarningShown: app.timerWarningShown,
        questions: app.questions
      }));
    }, 300);
  };

  app.getAutosaveKey = getAutosaveKey;

  app.restoreProgress = function restoreProgress(typeId) {
    var types = typeId ? [typeId] : ["teacher_test", "candidate_test"];
    for (var i = 0; i < types.length; i += 1) {
      var key = app.AUTOSAVE_PREFIX + "_" + types[i];
      var raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        var saved = JSON.parse(raw);
        if (!saved || !Array.isArray(saved.questions) || !saved.questions.length) continue;
        app.testType = saved.testType || types[i];
        app.setSelectedTestType(app.testType);
        app.participantFullName = app.normalizeFullName(saved.participantFullName);
        app.participantEmail = typeof saved.participantEmail === "string" ? saved.participantEmail : "";
        app.testConfig = window.TEST_CONFIGS[app.testType];
        app.questions = saved.questions;
        app.currentIndex = typeof saved.currentIndex === "number" ? saved.currentIndex : 0;
        app.leftSec = typeof saved.leftSec === "number" ? saved.leftSec : (app.testConfig ? app.testConfig.timeLimitSec : 1500);
        app.sessionStartMs = typeof saved.sessionStartMs === "number" ? saved.sessionStartMs : Date.now();
        app.timerWarningShown = !!saved.timerWarningShown;
        app.started = true;
        app.finished = false;
        if (dom.quizScreen) dom.quizScreen.setAttribute("data-test-type", app.testType);
        if (dom.pilotTitle && app.testConfig) dom.pilotTitle.textContent = app.testConfig.title;
        if (dom.timerWarning) dom.timerWarning.classList.toggle("hidden", !app.timerWarningShown);
        app.showScreen("quiz-screen");
        app.setNavLocked(true);
        app.renderCurrentQuestion();
        app.startTimer();
        app.enableTabGuard();
        return true;
      } catch (e) {
        localStorage.removeItem(key);
      }
    }
    return false;
  };
})();
