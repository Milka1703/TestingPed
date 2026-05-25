/**
 * Сбор и восстановление ответов.
 * Использует делегирование событий (onQuizContainerChange).
 */
(function () {
  var app = window.__app;
  var dom = app.dom;

  app.collectAnswer = function collectAnswer(idx) {
    var q = app.questions[idx];
    if (!q) return;
    if (q.kind === "matching" && Array.isArray(q.match)) {
      q.savedAnswer = q.match.map(function (_, pairIdx) {
        var select = document.querySelector('select[data-match="1"][data-question-index="' + idx + '"][data-pair-index="' + pairIdx + '"]');
        return select ? String(select.value || "") : "";
      });
    } else if (q.kind === "sequence" && Array.isArray(q.sequence)) {
      q.savedAnswer = q.sequence.map(function (_, seqIdx) {
        var select = document.querySelector('select[data-sequence="1"][data-question-index="' + idx + '"][data-seq-index="' + seqIdx + '"]');
        return select ? String(select.value || "") : "";
      });
    } else if (q.kind === "open") {
      var picked = document.querySelector('input[type="radio"][name="q-' + idx + '"]:checked');
      if (picked) {
        q.savedAnswer = Number(picked.value);
      } else {
        var textarea = document.querySelector('textarea[data-open="1"][data-question-index="' + idx + '"]');
        q.savedAnswer = textarea ? String(textarea.value || "") : "";
      }
    } else if (q.kind === "fill_blank") {
      var input = document.querySelector('input[data-fill="1"][data-question-index="' + idx + '"]');
      q.savedAnswer = input ? String(input.value || "") : "";
    } else if (q.kind === "multi") {
      var picked = Array.from(document.querySelectorAll('input[name="q-' + idx + '"]:checked'))
        .map(function (input) { return Number(input.value); })
        .filter(function (v) { return !Number.isNaN(v); })
        .sort(function (a, b) { return a - b; });
      q.savedAnswer = picked;
    } else {
      var picked = document.querySelector('input[type="radio"][name="q-' + idx + '"]:checked');
      q.savedAnswer = picked ? Number(picked.value) : -1;
    }
    var now = Date.now();
    if (q.savedAnswer !== null && q.savedAnswer !== undefined && q.savedAnswer !== "" && !(Array.isArray(q.savedAnswer) && !q.savedAnswer.length) && q.savedAnswer !== -1) {
      q.lastChangedAtMs = now;
    }
  };

  app.applySavedAnswer = function applySavedAnswer(idx) {
    var q = app.questions[idx];
    if (!q || q.savedAnswer === null || q.savedAnswer === undefined) return;
    if (q.kind === "matching" && Array.isArray(q.savedAnswer)) {
      q.savedAnswer.forEach(function (val, pairIdx) {
        var select = document.querySelector('select[data-match="1"][data-question-index="' + idx + '"][data-pair-index="' + pairIdx + '"]');
        if (select) select.value = val;
      });
    } else if (q.kind === "sequence" && Array.isArray(q.savedAnswer)) {
      q.savedAnswer.forEach(function (val, seqIdx) {
        var select = document.querySelector('select[data-sequence="1"][data-question-index="' + idx + '"][data-seq-index="' + seqIdx + '"]');
        if (select) select.value = val;
      });
    } else if (q.kind === "open") {
      if (typeof q.savedAnswer === "number" && q.savedAnswer >= 0) {
        var radio = document.querySelector('input[name="q-' + idx + '"][value="' + q.savedAnswer + '"]');
        if (radio) radio.checked = true;
      } else if (typeof q.savedAnswer === "string") {
        var textarea = document.querySelector('textarea[data-open="1"][data-question-index="' + idx + '"]');
        if (textarea) textarea.value = q.savedAnswer;
      }
    } else if (q.kind === "fill_blank" && typeof q.savedAnswer === "string") {
      var input = document.querySelector('input[data-fill="1"][data-question-index="' + idx + '"]');
      if (input) input.value = q.savedAnswer;
    } else if (q.kind === "multi" && Array.isArray(q.savedAnswer)) {
      q.savedAnswer.forEach(function (val) {
        var checkbox = document.querySelector('input[type="checkbox"][name="q-' + idx + '"][value="' + val + '"]');
        if (checkbox) checkbox.checked = true;
      });
    } else if (typeof q.savedAnswer === "number" && q.savedAnswer >= 0) {
      var radio = document.querySelector('input[name="q-' + idx + '"][value="' + q.savedAnswer + '"]');
      if (radio) radio.checked = true;
    }
  };

  app.onQuizContainerChange = function onQuizContainerChange(event) {
    var target = event.target;
    var questionEl = target.closest(".question");
    if (!questionEl) return;
    var idx = parseInt(questionEl.getAttribute("data-question-index"), 10);
    if (isNaN(idx)) return;

    var isInput = target.matches('input[type="radio"], input[type="checkbox"]');
    var isSelect = target.matches("select");
    var isTextInput = target.matches('textarea[data-open="1"], input[data-fill="1"]');
    if (!isInput && !isSelect && !isTextInput) return;

    app.collectAnswer(idx);
    var q = app.questions[idx];
    if (q) q.changeCount = (q.changeCount || 0) + 1;
    app.saveProgress();
  };

  app.bindQuizContainerListener = function bindQuizContainerListener() {
    if (dom.quizContainer) {
      dom.quizContainer.removeEventListener("change", app.onQuizContainerChange);
      dom.quizContainer.removeEventListener("input", app.onQuizContainerChange);
      dom.quizContainer.addEventListener("change", app.onQuizContainerChange);
      dom.quizContainer.addEventListener("input", app.onQuizContainerChange);
    }
  };
})();
