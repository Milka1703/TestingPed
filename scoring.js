window.COMPETENCY_LEVELS = [
  {
    id: "beginner",
    label: "Beginner (Новичок)",
    shortLabel: "Новичок",
    min: 0,
    max: 39,
    description: "Минимальные знания, требуется обучение с нуля. Не готов к самостоятельной работе.",
    cls: "level-beginner"
  },
  {
    id: "intern",
    label: "Intern (Стажёр)",
    shortLabel: "Стажёр",
    min: 40,
    max: 59,
    description: "Базовое понимание терминологии, есть пробелы в практике. Готов учиться под руководством.",
    cls: "level-intern"
  },
  {
    id: "middle",
    label: "Middle (Продвинутый)",
    shortLabel: "Продвинутый",
    min: 60,
    max: 84,
    description: "Уверенное знание теории, умеет применять на практике. Есть зоны роста.",
    cls: "level-middle"
  },
  {
    id: "architect",
    label: "Architect (Эксперт)",
    shortLabel: "Эксперт",
    min: 85,
    max: 100,
    description: "Глубокое понимание, способен проектировать решения, минимум ошибок.",
    cls: "level-architect"
  }
];

window.getCompetencyLevel = function getCompetencyLevel(scorePercent) {
  const score = Math.max(0, Math.min(100, Math.round(Number(scorePercent) || 0)));
  const level = window.COMPETENCY_LEVELS.find(function (item) {
    return score >= item.min && score <= item.max;
  }) || window.COMPETENCY_LEVELS[0];
  return Object.assign({ scorePercent: score }, level);
};

window.calculateTestScore = function calculateTestScore(questions, gradeFn) {
  const total = questions.length;
  let correct = 0;
  const byCategory = {};
  const questionLogs = questions.map(function (q, idx) {
    const grade = gradeFn(q, idx);
    const cat = q.category || "Без категории";
    byCategory[cat] = byCategory[cat] || { ok: 0, total: 0 };
    byCategory[cat].total += 1;
    if (grade.isCorrect) {
      correct += 1;
      byCategory[cat].ok += 1;
    }
    return Object.assign({ id: q.id, category: q.category, block: q.block, text: q.text, kind: q.kind }, grade);
  });
  const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
  const competency = window.getCompetencyLevel(scorePercent);
  return {
    correct: correct,
    total: total,
    scorePercent: scorePercent,
    competency: competency,
    byCategory: byCategory,
    questions: questionLogs
  };
};

window.formatSystemDateTime = function formatSystemDateTime(value) {
  if (value === null || value === undefined || value === "") return "";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("ru-RU", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
};

window.buildResultCsv = function buildResultCsv(payload) {
  const startedMs = typeof payload.sessionStartMs === "number"
    ? payload.sessionStartMs
    : (payload.startedAt ? Date.parse(payload.startedAt) : NaN);
  const completedMs = typeof payload.completedAtMs === "number"
    ? payload.completedAtMs
    : (payload.completedAt ? Date.parse(payload.completedAt) : NaN);

  const rows = [
    ["Поле", "Значение"],
    ["Тип теста", payload.testTitle || payload.testType || ""],
    ["Начало теста", window.formatSystemDateTime(startedMs)],
    ["Завершение теста", window.formatSystemDateTime(completedMs)],
    ["Правильных ответов", String(payload.correctAnswers)],
    ["Всего вопросов", String(payload.totalQuestions)],
    ["Балл (%)", String(payload.scorePercent)],
    ["Уровень", payload.competencyLabel || ""],
    ["Описание уровня", payload.competencyDescription || ""],
    []
  ];
  rows.push(["Категория", "Верно", "Всего", "Процент"]);
  (window.PILOT_TEST_CATEGORIES || Object.keys(payload.byCategory || {})).forEach(function (cat) {
    const row = (payload.byCategory || {})[cat] || { ok: 0, total: 0 };
    const pct = row.total > 0 ? Math.round((row.ok / row.total) * 100) : 0;
    rows.push([cat, String(row.ok), String(row.total), String(pct)]);
  });
  rows.push([]);
  rows.push(["ID", "Категория", "Блок", "Тип", "Верно", "Ответ", "Правильный ответ"]);
  (payload.questions || []).forEach(function (q) {
    rows.push([
      q.id || "",
      q.category || "",
      q.block || "",
      q.kind || "",
      q.isCorrect ? "да" : "нет",
      q.selectedOptionText || "",
      q.correctOptionText || ""
    ]);
  });
  return rows.map(function (row) {
    return row.map(function (cell) {
      return '"' + String(cell).replace(/"/g, '""') + '"';
    }).join(",");
  }).join("\n");
};
