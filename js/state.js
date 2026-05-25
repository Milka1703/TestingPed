/**
 * Состояние приложения (app state).
 * Все модули читают/пишут через window.__app.
 * IIFE — изолированное замыкание, никаких глобальных переменных.
 */
(function () {
  var AUTOSAVE_PREFIX = "it_competence_test_v2";

  // DOM-элементы (кэшируются один раз)
  var dom = {
    homeScreen: document.getElementById("home-screen"),
    teacherScreen: document.getElementById("teacher-screen"),
    candidateScreen: document.getElementById("candidate-screen"),
    quizScreen: document.getElementById("quiz-screen"),
    quizContainer: document.getElementById("quiz-container"),
    resultBox: document.getElementById("quiz-result"),
    timerEl: document.getElementById("timer"),
    timerWarning: document.getElementById("timer-warning"),
    quizProgress: document.getElementById("quiz-progress"),
    tabGuardOverlay: document.getElementById("tab-guard-overlay"),
    pilotTitle: document.getElementById("pilot-title"),
    prevBtn: document.getElementById("prev-btn"),
    nextBtn: document.getElementById("next-btn"),
    submitBtn: document.getElementById("submit-btn"),
    backToSelectBtn: document.getElementById("back-to-select-btn"),
    quizActionsDone: document.getElementById("quiz-actions-done"),
    resultDeliveryStatus: document.getElementById("result-delivery-status"),
    logNote: document.getElementById("log-note"),
    fontIncBtn: document.getElementById("font-inc-btn"),
    fontDecBtn: document.getElementById("font-dec-btn"),
    navLinks: document.querySelectorAll("header nav a")
  };

  var baseQuestions = Array.isArray(window.PILOT_QUESTIONS) ? window.PILOT_QUESTIONS : [];

  // Константы
  var TEST_SCREEN_BY_TYPE = {
    teacher_test: "teacher-screen",
    candidate_test: "candidate-screen"
  };
  var TEST_TYPE_ALIASES = {
    teacher: "teacher_test",
    teacher_test: "teacher_test",
    преподаватель: "teacher_test",
    candidate: "candidate_test",
    candidate_test: "candidate_test",
    кандидат: "candidate_test"
  };

  // Состояние сессии
  var app = {
    AUTOSAVE_PREFIX: AUTOSAVE_PREFIX,
    baseQuestions: baseQuestions,
    dom: dom,
    TEST_SCREEN_BY_TYPE: TEST_SCREEN_BY_TYPE,
    TEST_TYPE_ALIASES: TEST_TYPE_ALIASES,

    selectedTestType: null,
    testType: null,
    testConfig: null,
    questions: [],
    currentIndex: 0,
    leftSec: 0,
    timerId: null,
    started: false,
    finished: false,
    sessionStartMs: 0,
    resultPayload: null,
    timerWarningShown: false,
    participantFullName: "",
    participantEmail: "",

    _saveTimeout: null,
    _vpnCheckResolved: false,
    _vpnDetected: false
  };

  window.__app = app;
})();
