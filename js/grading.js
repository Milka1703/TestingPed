/**
 * Оценка ответов (gradeAnswer).
 */
(function () {
  var app = window.__app;

  app.gradeAnswer = function gradeAnswer(q) {
    var isCorrect = false;
    var selectedOptionText = "";
    var correctOptionText = "";
    var needsManualReview = false;
    var saved = q.savedAnswer;

    if (q.kind === "matching" && Array.isArray(q.match)) {
      var selectedPairs = Array.isArray(saved) ? saved : [];
      var allFilled = selectedPairs.length === q.match.length && selectedPairs.every(function (val) { return String(val || "").length > 0; });
      isCorrect = allFilled && selectedPairs.every(function (val, pairIdx) { return val === q.match[pairIdx].right; });
      selectedOptionText = selectedPairs.map(function (val, pairIdx) { return q.match[pairIdx].left + " -> " + (val || "—"); }).join(" | ");
      correctOptionText = q.match.map(function (pair) { return pair.left + " -> " + pair.right; }).join(" | ");
    } else if (q.kind === "sequence" && Array.isArray(q.sequence)) {
      var selectedSequence = Array.isArray(saved) ? saved : [];
      var allFilled = selectedSequence.length === q.sequence.length && selectedSequence.every(function (val) { return String(val || "").length > 0; });
      isCorrect = allFilled && selectedSequence.every(function (val, seqIdx) { return val === q.sequence[seqIdx]; });
      selectedOptionText = selectedSequence.map(function (val, seqIdx) { return (seqIdx + 1) + ") " + (val || "—"); }).join(" | ");
      correctOptionText = q.sequence.map(function (item, seqIdx) { return (seqIdx + 1) + ") " + item; }).join(" | ");
    } else if (q.kind === "fill_blank") {
      needsManualReview = true;
      var userValue = typeof saved === "string" ? saved : "";
      selectedOptionText = userValue;
      var accepted = Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length
        ? q.acceptedAnswers
        : (q.answer >= 0 && q.options[q.answer] ? [q.options[q.answer]] : []);
      isCorrect = accepted.map(app.normalizeText).includes(app.normalizeText(userValue));
      correctOptionText = accepted.join(" / ");
    } else if (q.kind === "open") {
      if (typeof saved === "number" && saved >= 0) {
        isCorrect = saved === q.answer;
        selectedOptionText = q.options[saved] || "";
        correctOptionText = q.answer >= 0 ? q.options[q.answer] : "";
      } else if (Array.isArray(q.options) && q.options.length && q.answer >= 0) {
        var userValue = typeof saved === "string" ? saved : "";
        selectedOptionText = userValue;
        correctOptionText = q.options[q.answer] || "";
        isCorrect = app.normalizeText(userValue) === app.normalizeText(correctOptionText);
      } else {
        needsManualReview = true;
        selectedOptionText = typeof saved === "string" ? saved : "";
        var keywords = Array.isArray(q.keywords) ? q.keywords : null;
        var accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
        if (keywords && keywords.length) {
          correctOptionText = "Ключевые слова: " + app.formatKeywordsHint(keywords);
          isCorrect = app.matchKeywordGroups(selectedOptionText, keywords);
        } else {
          correctOptionText = accepted.length ? accepted.join(" / ") : "—";
          isCorrect = accepted.length ? accepted.map(app.normalizeText).includes(app.normalizeText(selectedOptionText)) : false;
        }
      }
    } else if (q.kind === "multi") {
      var checked = Array.isArray(saved) ? saved.slice().sort(function (a, b) { return a - b; }) : [];
      var correctIndexes = Array.isArray(q.answer) ? q.answer.slice().sort(function (a, b) { return a - b; }) : [];
      isCorrect = checked.length === correctIndexes.length && checked.every(function (v, i) { return v === correctIndexes[i]; });
      selectedOptionText = checked.length ? checked.map(function (v) { return q.options[v]; }).join(" | ") : "";
      correctOptionText = correctIndexes.length ? correctIndexes.map(function (v) { return q.options[v]; }).join(" | ") : "";
    } else {
      var picked = typeof saved === "number" ? saved : -1;
      isCorrect = picked >= 0 && picked === q.answer;
      selectedOptionText = picked >= 0 ? q.options[picked] : "";
      correctOptionText = q.answer >= 0 ? q.options[q.answer] : "";
    }

    return { isCorrect: isCorrect, selectedOptionText: selectedOptionText, correctOptionText: correctOptionText, needsManualReview: needsManualReview };
  };
})();
