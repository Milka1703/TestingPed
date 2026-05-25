/**
 * Рендеринг экранов результатов.
 */
(function () {
  var app = window.__app;
  var escapeHtml = app.escapeHtml;

  app.renderTeacherResultHtml = function renderTeacherResultHtml(score, hasManualReview) {
    var level = score.competency;
    var categoryDetails = (window.PILOT_TEST_CATEGORIES || Object.keys(score.byCategory)).map(function (cat) {
      var row = score.byCategory[cat] || { ok: 0, total: 0 };
      if (!row.total) return "";
      var p = Math.round((row.ok / row.total) * 100);
      return "<li><span class=\"cat-name\">" + cat + "</span>: " + row.ok + "/" + row.total + " (" + p + "%)</li>";
    }).filter(Boolean).join("");

    var manualReviewHtml = "";
    if (hasManualReview) {
      manualReviewHtml = '<div class="manual-review-warning"><b>Внимание!</b> Часть вопросов требует ручной проверки администратором. Итоговый результат может быть скорректирован.</div>';
    }

    return (
      '<div class="result-summary ' + level.cls + '">' +
      '<div class="result-score-line"><span class="result-score-value">' + score.scorePercent + '%</span></div>' +
      '<p class="result-meta">Правильных ответов: <b>' + score.correct + "</b> из <b>" + score.total + "</b></p>" +
      '<div class="competency-badge ' + level.cls + '">' +
      "<b>" + level.label + "</b>" +
      '<p class="competency-desc">' + level.description + "</p>" +
      "</div>" +
      "</div>" +
      manualReviewHtml +
      "<b>Разбивка по категориям:</b><ul class=\"result-categories\">" + categoryDetails + "</ul>"
    );
  };

  app.renderTeacherThanksHtml = function renderTeacherThanksHtml(score, hasManualReview) {
    var manualReviewHtml = "";
    if (hasManualReview) {
      manualReviewHtml = '<div class="manual-review-warning"><b>Внимание!</b> В тесте присутствуют вопросы, проверяемые вручную администратором. Итоговый результат может быть скорректирован.</div>';
    }

    return (
      '<div class="result-summary teacher-thanks">' +
      '<div class="thanks-icon">✓</div>' +
      "<h3>Спасибо за прохождение тестирования!</h3>" +
      '<p>Сертификат поступит на указанную вами электронную почту.</p>' +
      '<div class="result-score-line"><span class="result-score-value">' + score.scorePercent + '%</span></div>' +
      '<p class="result-meta">Правильных ответов: <b>' + score.correct + "</b> из <b>" + score.total + "</b></p>" +
      "</div>" +
      manualReviewHtml +
      '<div id="teacher-detailed-results" class="hidden">' +
      '<div class="result-summary ' + score.competency.cls + '">' +
      '<div class="competency-badge ' + score.competency.cls + '">' +
      "<b>" + score.competency.label + "</b>" +
      '<p class="competency-desc">' + score.competency.description + "</p>" +
      "</div>" +
      "</div>" +
      "</div>" +
      "<b>Разбивка по категориям:</b><ul class=\"result-categories\">" + (window.PILOT_TEST_CATEGORIES || Object.keys(score.byCategory)).map(function (cat) {
        var row = score.byCategory[cat] || { ok: 0, total: 0 };
        if (!row.total) return "";
        var p = Math.round((row.ok / row.total) * 100);
        return "<li><span class=\"cat-name\">" + cat + "</span>: " + row.ok + "/" + row.total + " (" + p + "%)</li>";
      }).filter(Boolean).join("") + "</ul>" +
      "</div>"
    );
  };

  app.renderCandidateResultHtml = function renderCandidateResultHtml(score) {
    return (
      '<div class="result-summary">' +
      "<h3>Спасибо за прохождение тестирования</h3>" +
      '<p class="result-meta">Ваш общий результат:</p>' +
      '<div class="result-score-line"><span class="result-score-value">' + score.scorePercent + "%</span></div>" +
      "</div>"
    );
  };

  app.renderCompetencyLegend = function renderCompetencyLegend() {
    var container = document.getElementById("competency-levels-list");
    if (!container || !window.COMPETENCY_LEVELS) return;
    container.innerHTML = window.COMPETENCY_LEVELS.map(function (level) {
      return (
        '<article class="competency-level-card ' + level.cls + '">' +
        '<span class="competency-level-range">' + level.min + "–" + level.max + "%</span>" +
        "<h3>" + level.label + "</h3>" +
        "<p>" + level.description + "</p>" +
        "</article>"
      );
    }).join("");
  };
})();
