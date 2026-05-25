/**
 * Точка входа: инициализация всех модулей и привязка событий.
 * Загружается последним, после всех js/*.js модулей.
 */
(function () {
  var app = window.__app;
  var dom = app.dom;

  // Prev button
  if (dom.prevBtn) {
    dom.prevBtn.addEventListener("click", function () {
      if (app.currentIndex <= 0) return;
      app.collectAnswer(app.currentIndex);
      app.currentIndex -= 1;
      app.renderCurrentQuestion();
      app.saveProgress();
    });
  }

  // Next button
  if (dom.nextBtn) {
    dom.nextBtn.addEventListener("click", function () {
      if (app.currentIndex >= app.questions.length - 1) return;
      app.collectAnswer(app.currentIndex);
      app.currentIndex += 1;
      app.renderCurrentQuestion();
      app.saveProgress();
    });
  }

  // Submit button
  if (dom.submitBtn) {
    dom.submitBtn.addEventListener("click", function () { app.finishQuiz(false); });
  }

  // Back to select button
  if (dom.backToSelectBtn) {
    dom.backToSelectBtn.addEventListener("click", function () {
      if (app.started && !app.finished && !confirm("Прервать текущую сессию?")) return;
      localStorage.removeItem(app.getAutosaveKey());
      app.resetToSelection();
    });
  }

  // Font size buttons
  if (dom.fontIncBtn) {
    dom.fontIncBtn.addEventListener("click", function () {
      var current = parseFloat(getComputedStyle(document.body).fontSize);
      document.body.style.fontSize = Math.min(current + 1, 22) + "px";
    });
  }
  if (dom.fontDecBtn) {
    dom.fontDecBtn.addEventListener("click", function () {
      var current = parseFloat(getComputedStyle(document.body).fontSize);
      document.body.style.fontSize = Math.max(current - 1, 14) + "px";
    });
  }

  // Nav link lockdown
  dom.navLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (app.started && !app.finished) {
        event.preventDefault();
        alert("Завершите тест или вернитесь на вкладку теста. Навигация по странице заблокирована.");
      }
    });
  });

  // Initialization
  app.renderCompetencyLegend();
  app.initRoleNavigation();
  app.bindQuizContainerListener();
  var linkedTestType = app.getLinkedTestType();
  app.showStartScreen(linkedTestType);
  if (!app.restoreProgress(linkedTestType)) {
    app.showStartScreen(linkedTestType);
  }
})();
