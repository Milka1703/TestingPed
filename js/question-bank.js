/**
 * Формирование массива вопросов для теста (перемешивание, клонирование).
 */
(function () {
  var app = window.__app;

  app.buildShuffledQuestions = function buildShuffledQuestions(sourceQuestions) {
    return sourceQuestions.map(function (q, idx) {
      if (q.kind === "sequence" && Array.isArray(q.sequence) && q.sequence.length) {
        return {
          id: "Q" + (idx + 1),
          dimension: q.dimension || "Hard Skills",
          level: q.level || "basic",
          module: q.module || "core",
          kind: q.kind,
          match: Array.isArray(q.match) ? q.match : null,
          media: Array.isArray(q.media) ? q.media : null,
          acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : null,
          keywords: Array.isArray(q.keywords) ? q.keywords : null,
          sequence: q.sequence.slice(),
          category: q.category || null,
          block: q.block,
          text: q.text,
          options: Array.isArray(q.options) && q.options.length ? q.options.slice() : q.sequence.slice(),
          answer: -1,
          savedAnswer: null
        };
      }
      var answerIndexes = Array.isArray(q.answer) ? q.answer : [q.answer];
      var sourceOptions = Array.isArray(q.options) ? q.options : [];
      var optionObjects = sourceOptions.map(function (option, optionIdx) {
        return { option: option, isAnswer: answerIndexes.includes(optionIdx) };
      });
      var mixedOptions = app.shuffle(optionObjects);
      var mixedAnswer = q.kind === "multi"
        ? mixedOptions.map(function (o, mixedIdx) { return o.isAnswer ? mixedIdx : -1; }).filter(function (i) { return i >= 0; })
        : mixedOptions.findIndex(function (o) { return o.isAnswer; });
      return {
        id: "Q" + (idx + 1),
        dimension: q.dimension || "Hard Skills",
        level: q.level || "basic",
        module: q.module || "core",
        kind: q.kind || "single",
        match: Array.isArray(q.match) ? q.match : null,
        media: Array.isArray(q.media) ? q.media : null,
        acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : null,
        keywords: Array.isArray(q.keywords) ? q.keywords : null,
        sequence: Array.isArray(q.sequence) ? q.sequence.slice() : null,
        category: q.category || null,
        block: q.block,
        text: q.text,
        options: mixedOptions.map(function (o) { return o.option; }),
        answer: mixedAnswer,
        savedAnswer: null
      };
    });
  };
})();
