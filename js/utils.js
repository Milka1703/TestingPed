/**
 * Утилиты общего назначения.
 * Все функции — чистые, без побочных эффектов.
 *
 */
(function () {
  var app = window.__app;

  app.formatTime = function formatTime(totalSec) {
    var m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    var s = String(totalSec % 60).padStart(2, "0");
    return m + ":" + s;
  };

  app.shuffle = function shuffle(arr) {
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  };

  app.normalizeText = function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ");
  };

  app.normalizeFullName = function normalizeFullName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  };

  app.escapeHtml = function escapeHtml(value) {
    return String(value || "")
      .replace(/\x26/g, '\x26amp;')
      .replace(/\x3c/g, '\x26lt;')
      .replace(/\x3e/g, '\x26gt;')
      .replace(/"/g, '\x26quot;')
      .replace(/'/g, '\x26#39;');
  };

  app.normalizeKeywordGroups = function normalizeKeywordGroups(keywords) {
    if (!Array.isArray(keywords) || !keywords.length) return [];
    return keywords.map(function (group) {
      var alternatives = Array.isArray(group) ? group : [group];
      return alternatives.map(function (kw) { return app.normalizeText(kw); }).filter(Boolean);
    }).filter(function (group) { return group.length > 0; });
  };

  app.formatKeywordsHint = function formatKeywordsHint(keywords) {
    var groups = app.normalizeKeywordGroups(keywords);
    if (!groups.length) return "";
    return groups.map(function (group) { return group.join(" / "); }).join("; ");
  };

  app.matchKeywordGroups = function matchKeywordGroups(answer, keywords) {
    var groups = app.normalizeKeywordGroups(keywords);
    if (!groups.length) return false;
    var answerNorm = app.normalizeText(answer);
    return groups.every(function (group) {
      return group.some(function (kw) { return answerNorm.includes(kw); });
    });
  };
})();
