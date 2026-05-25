/**
 * Рендеринг HTML вопроса.
 */
(function () {
  var app = window.__app;
  var escapeHtml = app.escapeHtml;

  app.renderQuestionHtml = function renderQuestionHtml(q, idx) {
    var d = "div";
    var mediaHtml = Array.isArray(q.media) && q.media.length
      ? "<" + d + ' class="question-media-grid">' + q.media.map(function (m) {
        return '<figure class="question-media-item"><figcaption>' + (m.label || "") + '</figcaption><img src="' + m.src + '" alt="' + (m.alt || "") + '"></figure>';
      }).join("") + "</" + d + ">"
      : "";
    var optionsHtml = "";
    if (q.kind === "matching" && Array.isArray(q.match) && q.match.length) {
      var rightItems = app.shuffle(q.match.map(function (pair) { return pair.right; }));
      optionsHtml = q.match.map(function (pair, pairIdx) {
        var selectOptions = ['<option value="">Выберите соответствие</option>']
          .concat(rightItems.map(function (item) { return '<option value="' + item + '">' + item + "</option>"; }))
          .join("");
        return '<div class="matching-row"><div class="matching-left">' + pair.left + '</div><div class="matching-arrow">→</div><select class="matching-select" data-match="1" data-question-index="' + idx + '" data-pair-index="' + pairIdx + '">' + selectOptions + "</select></div>";
      }).join("");
    } else if (q.kind === "open" && Array.isArray(q.options) && q.options.length) {
      optionsHtml = q.options.map(function (option, optionIdx) {
        return '<label class="option-label"><input type="radio" name="q-' + idx + '" value="' + optionIdx + '"><span>' + option + "</span></label>";
      }).join("");
    } else if (q.kind === "open") {
      optionsHtml = '<label class="open-answer-label"><span class="mini">Введите развернутый ответ:</span><textarea class="open-answer-input" data-open="1" data-question-index="' + idx + '" rows="4" placeholder="Введите ваш ответ..."></textarea></label>';
    } else if (q.kind === "fill_blank") {
      optionsHtml = '<label class="open-answer-label"><span class="mini">Впишите термин:</span><input class="fill-blank-input" data-fill="1" data-question-index="' + idx + '" type="text" placeholder="Введите ответ"></label>';
    } else if (q.kind === "sequence" && Array.isArray(q.sequence) && q.sequence.length) {
      var source = Array.isArray(q.options) && q.options.length ? q.options.slice() : q.sequence.slice();
      var pool = app.shuffle(source);
      optionsHtml = q.sequence.map(function (_, seqIdx) {
        var selectOptions = ['<option value="">Выберите элемент</option>']
          .concat(pool.map(function (item) { return '<option value="' + item + '">' + item + "</option>"; }))
          .join("");
        return '<div class="matching-row"><div class="matching-left">Позиция ' + (seqIdx + 1) + '</div><div class="matching-arrow">→</div><select class="matching-select" data-sequence="1" data-question-index="' + idx + '" data-seq-index="' + seqIdx + '">' + selectOptions + "</select></div>";
      }).join("");
    } else if (q.kind === "multi") {
      optionsHtml = q.options.map(function (option, optionIdx) {
        return '<label class="option-label"><input type="checkbox" name="q-' + idx + '" value="' + optionIdx + '"><span>' + option + "</span></label>";
      }).join("");
    } else {
      optionsHtml = q.options.map(function (option, optionIdx) {
        return '<label class="option-label"><input type="radio" name="q-' + idx + '" value="' + optionIdx + '"><span>' + option + "</span></label>";
      }).join("");
    }
    var kindPills = [
      q.kind === "matching" ? '<span class="pill kind-pill">Сопоставление</span>' : "",
      q.kind === "open" ? '<span class="pill kind-pill">Открытый ответ</span>' : "",
      q.kind === "fill_blank" ? '<span class="pill kind-pill">Заполнить поле</span>' : "",
      q.kind === "sequence" ? '<span class="pill kind-pill">Последовательность</span>' : "",
      q.kind === "multi" ? '<span class="pill kind-pill">Множественный выбор</span>' : ""
    ].filter(Boolean).join("<br>");
    var categoryLine = q.category ? '<span class="pill">' + escapeHtml(q.category) + "</span><br>" : "";
    return (
      "<" + d + ' class="question" data-question-index="' + idx + '">' +
      categoryLine + kindPills + (kindPills ? "<br>" : "") +
      "<b>" + escapeHtml(q.text) + "</b>" + mediaHtml +
      "<" + d + ' class="options">' + optionsHtml + "</" + d + "></" + d + ">"
    );
  };
})();
