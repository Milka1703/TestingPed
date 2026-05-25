/**
 * Контроллер теста: старт, завершение, рендеринг вопросов.
 */
(function () {
  var app = window.__app;
  var dom = app.dom;

  function pickSessionQuestions(typeId) {
    if (typeof window.selectPilotTest !== "function") {
      throw new Error("test-generator.js не подключён");
    }
    return window.selectPilotTest(typeId, app.baseQuestions);
  }

  app.renderCurrentQuestion = function renderCurrentQuestion() {
    var q = app.questions[app.currentIndex];
    if (!q || !dom.quizContainer) return;
    dom.quizContainer.innerHTML = app.renderQuestionHtml(q, app.currentIndex);
    app.applySavedAnswer(app.currentIndex);
    app.updateProgress();
    app.updateNavButtons();
  };

  app.collectAllAnswers = function collectAllAnswers() {
    var prev = app.currentIndex;
    for (var i = 0; i < app.questions.length; i += 1) {
      app.currentIndex = i;
      if (i === prev && dom.quizContainer && dom.quizContainer.innerHTML) {
        app.collectAnswer(i);
      } else if (app.questions[i].savedAnswer !== null && app.questions[i].savedAnswer !== undefined) {
        continue;
      }
    }
    app.currentIndex = prev;
  };

  app.startTest = function startTest(typeId, fullName) {
    var normalizedFullName = app.normalizeFullName(fullName);
    if (!normalizedFullName) {
      alert("Введите ФИО перед началом теста.");
      return;
    }
    if (!app.baseQuestions.length) {
      alert("Банк вопросов не загружен.");
      return;
    }
    var config = window.TEST_CONFIGS && window.TEST_CONFIGS[typeId];
    if (!config) {
      alert("Неизвестный тип теста.");
      return;
    }
    var sessionSource;
    try {
      sessionSource = pickSessionQuestions(typeId);
    } catch (err) {
      alert(err.message || "Не удалось сформировать тест");
      return;
    }
    if (sessionSource.length !== config.totalQuestions) {
      alert("Ожидалось " + config.totalQuestions + " вопросов, получено: " + sessionSource.length);
      return;
    }

    app.setSelectedTestType(typeId);
    app.participantFullName = normalizedFullName;
    app.testType = typeId;
    app.testConfig = config;
    app.finished = false;
    app.timerWarningShown = false;
    app.currentIndex = 0;
    app.sessionStartMs = Date.now();
    app.leftSec = config.timeLimitSec;

    app.questions = app.buildShuffledQuestions(sessionSource).map(function (q) {
      q.renderedAtMs = Date.now();
      q.lastChangedAtMs = null;
      q.changeCount = 0;
      return q;
    });

    if (dom.pilotTitle) dom.pilotTitle.textContent = config.title;
    if (dom.timerWarning) dom.timerWarning.classList.add("hidden");
    if (dom.resultBox) {
      dom.resultBox.className = "question hidden";
      dom.resultBox.innerHTML = "";
    }
    if (dom.quizActionsDone) dom.quizActionsDone.classList.add("hidden");
    if (dom.resultDeliveryStatus) dom.resultDeliveryStatus.classList.add("hidden");
    if (dom.logNote) dom.logNote.classList.add("hidden");

    if (dom.quizScreen) dom.quizScreen.setAttribute("data-test-type", typeId);
    app.showScreen("quiz-screen");
    app.setNavLocked(true);
    app.started = true;
    app.renderCurrentQuestion();
    app.startTimer();
    app.enableTabGuard();
    app.saveProgress();
  };

  app.finishQuiz = function finishQuiz(auto) {
    if (!app.started || app.finished) return;
    app.collectAnswer(app.currentIndex);
    app.collectAllAnswers();
    clearInterval(app.timerId);
    app.started = false;
    app.finished = true;
    app.disableTabGuard();
    app.setNavLocked(false);

    var score = typeof window.calculateTestScore === "function"
      ? window.calculateTestScore(app.questions, function (q) { return app.gradeAnswer(q); })
      : (function () {
        var g = app.questions.map(function (q) { return app.gradeAnswer(q); });
        var correct = g.filter(function (x) { return x.isCorrect; }).length;
        var total = app.questions.length;
        var scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
        return {
          correct: correct,
          total: total,
          scorePercent: scorePercent,
          competency: window.getCompetencyLevel ? window.getCompetencyLevel(scorePercent) : { label: "", description: "", cls: "" },
          byCategory: {},
          questions: g
        };
      })();

    var hasManualReview = score.questions.some(function (g) { return g.needsManualReview; });

    var completedAtMs = Date.now();
    app.resultPayload = {
      testType: app.testType,
      testTitle: app.testConfig ? app.testConfig.title : app.testType,
      participantFullName: app.participantFullName,
      participantEmail: app.participantEmail,
      recipientEmail: window.RESULT_RECIPIENT_EMAIL || "",
      sessionStartMs: app.sessionStartMs,
      startedAt: new Date(app.sessionStartMs).toISOString(),
      completedAtMs: completedAtMs,
      completedAt: new Date(completedAtMs).toISOString(),
      autoCompleted: auto,
      totalQuestions: score.total,
      correctAnswers: score.correct,
      scorePercent: score.scorePercent,
      competencyId: score.competency.id,
      competencyLabel: score.competency.label,
      competencyDescription: score.competency.description,
      competencyClass: score.competency.cls,
      byCategory: score.byCategory,
      questions: score.questions
    };
    localStorage.removeItem(app.getAutosaveKey());

    app.sendResultCsvByEmail(app.resultPayload);

    if (dom.quizContainer) dom.quizContainer.innerHTML = "";
    if (dom.prevBtn) dom.prevBtn.disabled = true;
    if (dom.nextBtn) dom.nextBtn.classList.add("hidden");
    if (dom.submitBtn) dom.submitBtn.classList.add("hidden");

    if (dom.resultBox) {
      var isCandidateTest = app.testType === "candidate_test";
      dom.resultBox.className = "question result-panel";
      if (isCandidateTest) {
        dom.resultBox.innerHTML =
          "<b>" + (app.testConfig ? app.testConfig.title : "Результат") + "</b><br>" +
          "<small>Участник: " + app.escapeHtml(app.participantFullName) + "</small><br>" +
          (auto ? "<small>Тест завершён автоматически по таймеру.</small><br>" : "") +
          app.renderCandidateResultHtml(score);
      } else {
        dom.resultBox.innerHTML =
          "<b>" + (app.testConfig ? app.testConfig.title : "Результат") + "</b><br>" +
          "<small>Участник: " + app.escapeHtml(app.participantFullName) + "</small><br>" +
          "<small>Email: " + app.escapeHtml(app.participantEmail) + "</small><br>" +
          (auto ? "<small>Тест завершён автоматически по таймеру.</small><br>" : "") +
          app.renderTeacherThanksHtml(score, hasManualReview);
      }
    }
    if (dom.quizActionsDone) dom.quizActionsDone.classList.remove("hidden");
    if (dom.logNote) dom.logNote.classList.toggle("hidden", app.isCandidateTest(app.testType));
    if (dom.timerEl) dom.timerEl.classList.remove("timer-urgent");
  };
})();
