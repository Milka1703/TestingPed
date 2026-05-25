window.PILOT_TEST_CATEGORIES = [
  "Работа с информацией",
  "Программирование",
  "Кодирование",
  "Компьютерные технологии",
  "ИБ",
  "Сетевые технологии",
  "Моделирование",
  "БД"
];

window.TEST_CONFIGS = {
  teacher_test: {
    id: "teacher_test",
    title: "Для действующих преподавателей",
    totalQuestions: 30,
    timeLimitSec: 25 * 60,
    minPerCategory: 2,
    maxPerCategory: 4,
    excludeTextInput: false
  },
  candidate_test: {
    id: "candidate_test",
    title: "Для кандидатов на собеседование",
    totalQuestions: 20,
    timeLimitSec: 15 * 60,
    minPerCategory: 2,
    maxPerCategory: 3,
    excludeTextInput: true
  }
};

window.BLOCK_TO_CATEGORY = {
  "Информация": "Работа с информацией",
  "Доступ к информации": "Работа с информацией",
  "Качество данных": "Работа с информацией",
  "Медиаграмотность": "Работа с информацией",
  "Критическое мышление": "Работа с информацией",
  "Интернет": "Работа с информацией",
  "Визуализация": "Работа с информацией",
  "Python": "Программирование",
  "Программирование": "Программирование",
  "Языки программирования": "Программирование",
  "HTML": "Программирование",
  "Алгоритмы": "Программирование",
  "Блок-схемы": "Программирование",
  "Веб": "Программирование",
  "Тестирование": "Программирование",
  "Кодировки": "Кодирование",
  "Кодирование": "Кодирование",
  "Медиа": "Кодирование",
  "Графика": "Кодирование",
  "Устройства хранения": "Компьютерные технологии",
  "Excel": "Компьютерные технологии",
  "Word": "Компьютерные технологии",
  "ПО": "Компьютерные технологии",
  "Windows": "Компьютерные технологии",
  "Аппаратное обеспечение": "Компьютерные технологии",
  "Информационная безопасность": "ИБ",
  "Безопасность": "ИБ",
  "HTTP": "Сетевые технологии",
  "Сети": "Сетевые технологии",
  "Моделирование": "Моделирование",
  "Моделирование процессов": "Моделирование",
  "BPMN": "Моделирование",
  "Бизнес-процессы": "Моделирование",
  "Базы данных": "БД",
  "SQL": "БД"
};

window.getQuestionCategory = function getQuestionCategory(question) {
  if (question && question.category) return question.category;
  return window.BLOCK_TO_CATEGORY[question.block] || null;
};

window.questionUniqueKey = function questionUniqueKey(question) {
  return String(question.block || "") + "::" + String(question.text || "");
};

window.clonePilotQuestion = function clonePilotQuestion(question) {
  return JSON.parse(JSON.stringify(question));
};

window.shufflePilot = function shufflePilot(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
};

window.generateCategoryCounts = function generateCategoryCounts(config) {
  const categories = window.PILOT_TEST_CATEGORIES;
  const counts = {};
  categories.forEach(function (category) {
    counts[category] = config.minPerCategory;
  });
  let remaining = config.totalQuestions - categories.length * config.minPerCategory;
  while (remaining > 0) {
    const eligible = categories.filter(function (category) {
      return counts[category] < config.maxPerCategory;
    });
    if (!eligible.length) break;
    const pick = eligible[Math.floor(Math.random() * eligible.length)];
    counts[pick] += 1;
    remaining -= 1;
  }
  return counts;
};

window.selectPilotTest = function selectPilotTest(testTypeId, sourceQuestions) {
  const config = window.TEST_CONFIGS[testTypeId];
  if (!config) {
    throw new Error("Неизвестный тип теста: " + testTypeId);
  }

  var bank = Array.isArray(sourceQuestions) ? sourceQuestions : (window.PILOT_QUESTIONS || []);

  // Фильтрация вопросов с текстовым вводом для candidate
  if (config.excludeTextInput) {
    bank = bank.filter(function (q) {
      // Исключаем fill_blank
      if (q.kind === "fill_blank") return false;
      // Исключаем open-вопросы без вариантов ответа (с ключевыми словами — текстовый ввод)
      if (q.kind === "open" && Array.isArray(q.keywords) && q.keywords.length) return false;
      return true;
    });
  }

  const counts = window.generateCategoryCounts(config);
  const pools = {};
  window.PILOT_TEST_CATEGORIES.forEach(function (category) {
    pools[category] = [];
  });

  bank.forEach(function (question) {
    const category = window.getQuestionCategory(question);
    if (category && pools[category]) {
      pools[category].push(question);
    }
  });

  const selected = [];
  const usedKeys = new Set();

  window.PILOT_TEST_CATEGORIES.forEach(function (category) {
    const need = counts[category];
    const pool = window.shufflePilot(pools[category]);
    let picked = 0;
    for (let i = 0; i < pool.length && picked < need; i += 1) {
      const key = window.questionUniqueKey(pool[i]);
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);
      const copy = window.clonePilotQuestion(pool[i]);
      copy.category = category;
      selected.push(copy);
      picked += 1;
    }
  });

  if (selected.length !== config.totalQuestions) {
    const missing = window.PILOT_TEST_CATEGORIES.filter(function (category) {
      const have = selected.filter(function (q) { return q.category === category; }).length;
      return have < counts[category];
    });
    throw new Error(
      "Не удалось набрать " + config.totalQuestions + " вопросов. Не хватает: " + missing.join(", ")
    );
  }

  return window.shufflePilot(selected);
};

window.selectPilotTest30 = function selectPilotTest30(sourceQuestions) {
  return window.selectPilotTest("teacher_test", sourceQuestions);
};
