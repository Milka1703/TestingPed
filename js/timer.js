/**
 * Таймер теста.
 */
(function () {
  var app = window.__app;

  app.startTimer = function startTimer() {
    clearInterval(app.timerId);
    app.updateTimerDisplay();
    app.timerId = setInterval(function () {
      app.leftSec -= 1;
      app.updateTimerDisplay();
      app.saveProgress();
      if (app.leftSec <= 0) app.finishQuiz(true);
    }, 1000);
  };
})();
