(function () {
  const baseQuestions = Array.isArray(window.PILOT_QUESTIONS) ? window.PILOT_QUESTIONS : [];
  const AUTOSAVE_PREFIX = "it_competence_test_v2";

  const homeScreen = document.getElementById("home-screen");
  const teacherScreen = document.getElementById("teacher-screen");
  const candidateScreen = document.getElementById("candidate-screen");
  const quizScreen = document.getElementById("quiz-screen");
  const quizContainer = document.getElementById("quiz-container");
  const resultBox = document.getElementById("quiz-result");
  const timerEl = document.getElementById("timer");
  const timerWarning = document.getElementById("timer-warning");
  const quizProgress = document.getElementById("quiz-progress");
  const tabGuardOverlay = document.getElementById("tab-guard-overlay");
  const pilotTitle = document.getElementById("pilot-title");
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const submitBtn = document.getElementById("submit-btn");
  const restartBtn = document.getElementById("restart-btn");
  const backToSelectBtn = document.getElementById("back-to-select-btn");
  const quizActionsDone = document.getElementById("quiz-actions-done");
  const exportPanel = document.getElementById("export-panel");
  const exportJsonBtn = document.getElementById("export-json-btn");
  const exportCsvBtn = document.getElementById("export-csv-btn");
  const resultDeliveryStatus = document.getElementById("result-delivery-status");
  const logNote = document.getElementById("log-note");
  const fontIncBtn = document.getElementById("font-inc-btn");
  const fontDecBtn = document.getElementById("font-dec-btn");
  const navLinks = document.querySelectorAll("header nav a");
  const TEST_SCREEN_BY_TYPE = {
    teacher_test: "teacher-screen",
    candidate_test: "candidate-screen"
  };
  const TEST_TYPE_ALIASES = {
    teacher: "teacher_test",
    teacher_test: "teacher_test",
    преподаватель: "teacher_test",
    candidate: "candidate_test",
    candidate_test: "candidate_test",
    кандидат: "candidate_test"
  };

  let selectedTestType = null;
  let testType = null;
  let testConfig = null;
  let questions = [];
  let currentIndex = 0;
  let leftSec = 0;
  let timerId = null;
  let started = false;
  let finished = false;
  let sessionStartMs = 0;
  let resultPayload = null;
  let timerWarningShown = false;
  let participantFullName = "";
  let participantEmail = "";

  function getAutosaveKey() {
    return AUTOSAVE_PREFIX + "_" + (testType || "none");
  }

  function formatTime(totalSec) {
    const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return m + ":" + s;
  }

  function shuffle(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ");
  }

  function normalizeKeywordGroups(keywords) {
    if (!Array.isArray(keywords) || !keywords.length) return [];
    return keywords.map(function (group) {
      const alternatives = Array.isArray(group) ? group : [group];
      return alternatives.map(function (kw) { return normalizeText(kw); }).filter(Boolean);
    }).filter(function (group) { return group.length > 0; });
  }

  function formatKeywordsHint(keywords) {
    const groups = normalizeKeywordGroups(keywords);
    if (!groups.length) return "";
    return groups.map(function (group) { return group.join(" / "); }).join("; ");
  }

  function matchKeywordGroups(answer, keywords) {
    const groups = normalizeKeywordGroups(keywords);
    if (!groups.length) return false;
    const answerNorm = normalizeText(answer);
    return groups.every(function (group) {
      return group.some(function (kw) { return answerNorm.includes(kw); });
    });
  }

  function normalizeFullName(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showScreen(screenId) {
    [homeScreen, teacherScreen, candidateScreen, quizScreen].forEach(function (screen) {
      if (screen) screen.classList.toggle("hidden", screen.id !== screenId);
    });
  }

  function normalizeTestType(value) {
    return TEST_TYPE_ALIASES[String(value || "").trim().toLowerCase()] || null;
  }

  function getLinkedTestType() {
    const params = new URLSearchParams(window.location.search);
    return (
      normalizeTestType(params.get("test")) ||
      normalizeTestType(params.get("role")) ||
      normalizeTestType(window.location.hash.replace(/^#/, ""))
    );
  }

  function getStartScreenId(typeId) {
    return TEST_SCREEN_BY_TYPE[typeId] || "home-screen";
  }

  function setSelectedTestType(typeId) {
    selectedTestType = typeId || null;
    if (selectedTestType) {
      document.body.dataset.testType = selectedTestType;
    } else {
      delete document.body.dataset.testType;
    }
  }

  function isCandidateTest(typeId) {
    return typeId === "candidate_test";
  }

  function updateExportPanel(typeId, showAfterFinish) {
    if (!exportPanel) return;
    if (isCandidateTest(typeId)) {
      exportPanel.classList.add("hidden");
      return;
    }
    if (showAfterFinish) exportPanel.classList.remove("hidden");
    else exportPanel.classList.add("hidden");
  }

  function showStartScreen(typeId) {
    setSelectedTestType(typeId);
    updateExportPanel(typeId, false);
    showScreen(getStartScreenId(typeId));
  }

  function handleRoleSelection(event) {
    const button = event.target.closest("button");
    if (!button) return;

    const navTarget = button.getAttribute("data-nav-target");
    if (navTarget) {
      event.preventDefault();
      showStartScreen(selectedTestType || getLinkedTestType());
      return;
    }

    const typeId = button.getAttribute("data-test-type") || selectedTestType;
    if (!typeId) return;

    event.preventDefault();
    if (started) return;
    if (selectedTestType && selectedTestType !== typeId) return;

    const section = button.closest("section");
    const nameInput = section ? section.querySelector("[data-full-name]") : null;
    const emailInput = section ? section.querySelector("[data-email]") : null;
    const fullName = normalizeFullName(nameInput ? nameInput.value : participantFullName);
    const email = emailInput ? String(emailInput.value || "").trim() : participantEmail;

    if (!fullName) {
      alert("Введите ФИО перед началом теста.");
      if (nameInput) {
        nameInput.setAttribute("aria-invalid", "true");
        nameInput.focus();
      }
      return;
    }
    if (nameInput) nameInput.removeAttribute("aria-invalid");

    // Для teacher проверяем email
    if (typeId === "teacher_test") {
      if (!email) {
        alert("Введите email перед началом теста.");
        if (emailInput) {
          emailInput.setAttribute("aria-invalid", "true");
          emailInput.focus();
        }
        return;
      }
      // Простейшая валидация email
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        alert("Введите корректный email.");
        if (emailInput) {
          emailInput.setAttribute("aria-invalid", "true");
          emailInput.focus();
        }
        return;
      }
      if (emailInput) emailInput.removeAttribute("aria-invalid");
    }

    participantEmail = email;
    startTest(typeId, fullName);
  }

  function initRoleNavigation() {
    const main = document.querySelector("main");
    if (!main) return;
    main.addEventListener("click", handleRoleSelection);
    main.addEventListener("input", function (event) {
      if (event.target.matches("[data-full-name]")) event.target.removeAttribute("aria-invalid");
      if (event.target.matches("[data-email]")) event.target.removeAttribute("aria-invalid");
    });
  }

  function setNavLocked(locked) {
    navLinks.forEach(function (link) {
      if (locked) {
        link.setAttribute("data-locked", "1");
        link.style.pointerEvents = "none";
        link.style.opacity = "0.45";
      } else {
        link.removeAttribute("data-locked");
        link.style.pointerEvents = "";
        link.style.opacity = "";
      }
    });
  }

  function updateTimerDisplay() {
    if (!timerEl) return;
    timerEl.textContent = formatTime(Math.max(leftSec, 0));
    timerEl.classList.toggle("timer-urgent", started && !finished && leftSec > 0 && leftSec <= 180);
    if (started && !finished && leftSec <= 180 && leftSec > 0 && !timerWarningShown) {
      timerWarningShown = true;
      if (timerWarning) timerWarning.classList.remove("hidden");
    }
  }

  function updateProgress() {
    if (!quizProgress || !questions.length) return;
    quizProgress.textContent = "Вопрос " + (currentIndex + 1) + " из " + questions.length;
  }

  function updateNavButtons() {
    if (prevBtn) prevBtn.disabled = currentIndex <= 0;
    if (nextBtn) nextBtn.classList.toggle("hidden", currentIndex >= questions.length - 1);
    if (submitBtn) submitBtn.classList.toggle("hidden", currentIndex < questions.length - 1);
  }

  function buildShuffledQuestions(sourceQuestions) {
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
      const answerIndexes = Array.isArray(q.answer) ? q.answer : [q.answer];
      const sourceOptions = Array.isArray(q.options) ? q.options : [];
      const optionObjects = sourceOptions.map(function (option, optionIdx) {
        return { option: option, isAnswer: answerIndexes.includes(optionIdx) };
      });
      const mixedOptions = shuffle(optionObjects);
      const mixedAnswer = q.kind === "multi"
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
  }

  function collectAnswer(idx) {
    const q = questions[idx];
    if (!q) return;
    if (q.kind === "matching" && Array.isArray(q.match)) {
      q.savedAnswer = q.match.map(function (_, pairIdx) {
        const select = document.querySelector('select[data-match="1"][data-question-index="' + idx + '"][data-pair-index="' + pairIdx + '"]');
        return select ? String(select.value || "") : "";
      });
    } else if (q.kind === "sequence" && Array.isArray(q.sequence)) {
      q.savedAnswer = q.sequence.map(function (_, seqIdx) {
        const select = document.querySelector('select[data-sequence="1"][data-question-index="' + idx + '"][data-seq-index="' + seqIdx + '"]');
        return select ? String(select.value || "") : "";
      });
    } else if (q.kind === "open") {
      const picked = document.querySelector('input[type="radio"][name="q-' + idx + '"]:checked');
      if (picked) {
        q.savedAnswer = Number(picked.value);
      } else {
        const textarea = document.querySelector('textarea[data-open="1"][data-question-index="' + idx + '"]');
        q.savedAnswer = textarea ? String(textarea.value || "") : "";
      }
    } else if (q.kind === "fill_blank") {
      const input = document.querySelector('input[data-fill="1"][data-question-index="' + idx + '"]');
      q.savedAnswer = input ? String(input.value || "") : "";
    } else if (q.kind === "multi") {
      const picked = Array.from(document.querySelectorAll('input[name="q-' + idx + '"]:checked'))
        .map(function (input) { return Number(input.value); })
        .filter(function (v) { return !Number.isNaN(v); })
        .sort(function (a, b) { return a - b; });
      q.savedAnswer = picked;
    } else {
      const picked = document.querySelector('input[type="radio"][name="q-' + idx + '"]:checked');
      q.savedAnswer = picked ? Number(picked.value) : -1;
    }
    const now = Date.now();
    if (q.savedAnswer !== null && q.savedAnswer !== undefined && q.savedAnswer !== "" && !(Array.isArray(q.savedAnswer) && !q.savedAnswer.length) && q.savedAnswer !== -1) {
      q.lastChangedAtMs = now;
    }
  }

  function applySavedAnswer(idx) {
    const q = questions[idx];
    if (!q || q.savedAnswer === null || q.savedAnswer === undefined) return;
    if (q.kind === "matching" && Array.isArray(q.savedAnswer)) {
      q.savedAnswer.forEach(function (val, pairIdx) {
        const select = document.querySelector('select[data-match="1"][data-question-index="' + idx + '"][data-pair-index="' + pairIdx + '"]');
        if (select) select.value = val;
      });
    } else if (q.kind === "sequence" && Array.isArray(q.savedAnswer)) {
      q.savedAnswer.forEach(function (val, seqIdx) {
        const select = document.querySelector('select[data-sequence="1"][data-question-index="' + idx + '"][data-seq-index="' + seqIdx + '"]');
        if (select) select.value = val;
      });
    } else if (q.kind === "open") {
      if (typeof q.savedAnswer === "number" && q.savedAnswer >= 0) {
        const radio = document.querySelector('input[name="q-' + idx + '"][value="' + q.savedAnswer + '"]');
        if (radio) radio.checked = true;
      } else if (typeof q.savedAnswer === "string") {
        const textarea = document.querySelector('textarea[data-open="1"][data-question-index="' + idx + '"]');
        if (textarea) textarea.value = q.savedAnswer;
      }
    } else if (q.kind === "fill_blank" && typeof q.savedAnswer === "string") {
      const input = document.querySelector('input[data-fill="1"][data-question-index="' + idx + '"]');
      if (input) input.value = q.savedAnswer;
    } else if (q.kind === "multi" && Array.isArray(q.savedAnswer)) {
      q.savedAnswer.forEach(function (val) {
        const checkbox = document.querySelector('input[type="checkbox"][name="q-' + idx + '"][value="' + val + '"]');
        if (checkbox) checkbox.checked = true;
      });
    } else if (typeof q.savedAnswer === "number" && q.savedAnswer >= 0) {
      const radio = document.querySelector('input[name="q-' + idx + '"][value="' + q.savedAnswer + '"]');
      if (radio) radio.checked = true;
    }
  }

  function renderQuestionHtml(q, idx) {
    const d = "div";
    const mediaHtml = Array.isArray(q.media) && q.media.length
      ? "<" + d + ' class="question-media-grid">' + q.media.map(function (m) {
        return '<figure class="question-media-item"><figcaption>' + (m.label || "") + '</figcaption><img src="' + m.src + '" alt="' + (m.alt || "") + '"></figure>';
      }).join("") + "</" + d + ">"
      : "";
    let optionsHtml = "";
    if (q.kind === "matching" && Array.isArray(q.match) && q.match.length) {
      const rightItems = shuffle(q.match.map(function (pair) { return pair.right; }));
      optionsHtml = q.match.map(function (pair, pairIdx) {
        const selectOptions = ['<option value="">Выберите соответствие</option>']
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
      const source = Array.isArray(q.options) && q.options.length ? q.options.slice() : q.sequence.slice();
      const pool = shuffle(source);
      optionsHtml = q.sequence.map(function (_, seqIdx) {
        const selectOptions = ['<option value="">Выберите элемент</option>']
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
    const kindPills = [
      q.kind === "matching" ? '<span class="pill kind-pill">Сопоставление</span>' : "",
      q.kind === "open" ? '<span class="pill kind-pill">Открытый ответ</span>' : "",
      q.kind === "fill_blank" ? '<span class="pill kind-pill">Заполнить поле</span>' : "",
      q.kind === "sequence" ? '<span class="pill kind-pill">Последовательность</span>' : "",
      q.kind === "multi" ? '<span class="pill kind-pill">Множественный выбор</span>' : ""
    ].filter(Boolean).join("<br>");
    const categoryLine = q.category ? '<span class="pill">' + escapeHtml(q.category) + "</span><br>" : "";
    return (
      "<" + d + ' class="question" data-question-index="' + idx + '">' +
      categoryLine + kindPills + (kindPills ? "<br>" : "") +
      "<b>" + escapeHtml(q.text) + "</b>" + mediaHtml +
      "<" + d + ' class="options">' + optionsHtml + "</" + d + "></" + d + ">"
    );
  }

  function onQuizContainerChange(event) {
    var target = event.target;
    var questionEl = target.closest(".question");
    if (!questionEl) return;
    var idx = parseInt(questionEl.getAttribute("data-question-index"), 10);
    if (isNaN(idx)) return;

    var isInput = target.matches('input[type="radio"], input[type="checkbox"]');
    var isSelect = target.matches("select");
    var isTextInput = target.matches('textarea[data-open="1"], input[data-fill="1"]');
    if (!isInput && !isSelect && !isTextInput) return;

    collectAnswer(idx);
    var q = questions[idx];
    if (q) q.changeCount = (q.changeCount || 0) + 1;
    saveProgress();
  }

  function bindQuizContainerListener() {
    if (quizContainer) {
      quizContainer.removeEventListener("change", onQuizContainerChange);
      quizContainer.removeEventListener("input", onQuizContainerChange);
      quizContainer.addEventListener("change", onQuizContainerChange);
      quizContainer.addEventListener("input", onQuizContainerChange);
    }
  }


  function renderCurrentQuestion() {
    const q = questions[currentIndex];
    if (!q || !quizContainer) return;
    quizContainer.innerHTML = renderQuestionHtml(q, currentIndex);
    applySavedAnswer(currentIndex);
    updateProgress();
    updateNavButtons();
  }

  var _saveTimeout = null;

  function saveProgress() {
    if (!started || finished || !testType) return;
    if (_saveTimeout) clearTimeout(_saveTimeout);
    _saveTimeout = setTimeout(function () {
      _saveTimeout = null;
      collectAnswer(currentIndex);
      localStorage.setItem(getAutosaveKey(), JSON.stringify({
        testType: testType,
        participantFullName: participantFullName,
        participantEmail: participantEmail,
        leftSec: leftSec,
        currentIndex: currentIndex,
        sessionStartMs: sessionStartMs,
        timerWarningShown: timerWarningShown,
        questions: questions
      }));
    }, 300);
  }

  function enableTabGuard() {
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("beforeunload", onBeforeUnload);
  }

  function disableTabGuard() {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("blur", onWindowBlur);
    window.removeEventListener("beforeunload", onBeforeUnload);
    if (tabGuardOverlay) tabGuardOverlay.classList.add("hidden");
  }

  function onVisibilityChange() {
    if (!started || finished) return;
    if (document.hidden && tabGuardOverlay) tabGuardOverlay.classList.remove("hidden");
    else if (tabGuardOverlay) tabGuardOverlay.classList.add("hidden");
  }

  function onWindowBlur() {
    if (!started || finished) return;
    if (tabGuardOverlay) tabGuardOverlay.classList.remove("hidden");
  }

  function onBeforeUnload(event) {
    if (!started || finished) return;
    event.preventDefault();
    event.returnValue = "";
  }

  function startTimer() {
    clearInterval(timerId);
    updateTimerDisplay();
    timerId = setInterval(function () {
      leftSec -= 1;
      updateTimerDisplay();
      saveProgress();
      if (leftSec <= 0) finishQuiz(true);
    }, 1000);
  }

  function pickSessionQuestions(typeId) {
    if (typeof window.selectPilotTest !== "function") {
      throw new Error("test-generator.js не подключён");
    }
    return window.selectPilotTest(typeId, baseQuestions);
  }

  function startTest(typeId, fullName) {
    const normalizedFullName = normalizeFullName(fullName);
    if (!normalizedFullName) {
      alert("Введите ФИО перед началом теста.");
      return;
    }
    if (!baseQuestions.length) {
      alert("Банк вопросов не загружен.");
      return;
    }
    const config = window.TEST_CONFIGS && window.TEST_CONFIGS[typeId];
    if (!config) {
      alert("Неизвестный тип теста.");
      return;
    }
    let sessionSource;
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

    setSelectedTestType(typeId);
    participantFullName = normalizedFullName;
    testType = typeId;
    testConfig = config;
    finished = false;
    timerWarningShown = false;
    currentIndex = 0;
    sessionStartMs = Date.now();
    leftSec = config.timeLimitSec;

    questions = buildShuffledQuestions(sessionSource).map(function (q) {
      q.renderedAtMs = Date.now();
      q.lastChangedAtMs = null;
      q.changeCount = 0;
      return q;
    });

    if (pilotTitle) pilotTitle.textContent = config.title;
    if (timerWarning) timerWarning.classList.add("hidden");
    if (resultBox) {
      resultBox.className = "question hidden";
      resultBox.innerHTML = "";
    }
    if (quizActionsDone) quizActionsDone.classList.add("hidden");
    if (exportPanel) exportPanel.classList.add("hidden");
    if (resultDeliveryStatus) resultDeliveryStatus.classList.add("hidden");
    if (logNote) logNote.classList.add("hidden");

    if (quizScreen) quizScreen.setAttribute("data-test-type", typeId);
    showScreen("quiz-screen");
    setNavLocked(true);
    started = true;
    renderCurrentQuestion();
    startTimer();
    enableTabGuard();
    saveProgress();
  }

  function gradeAnswer(q) {
    let isCorrect = false;
    let selectedOptionText = "";
    let correctOptionText = "";
    let needsManualReview = false;
    const saved = q.savedAnswer;

    if (q.kind === "matching" && Array.isArray(q.match)) {
      const selectedPairs = Array.isArray(saved) ? saved : [];
      const allFilled = selectedPairs.length === q.match.length && selectedPairs.every(function (val) { return String(val || "").length > 0; });
      isCorrect = allFilled && selectedPairs.every(function (val, pairIdx) { return val === q.match[pairIdx].right; });
      selectedOptionText = selectedPairs.map(function (val, pairIdx) { return q.match[pairIdx].left + " -> " + (val || "—"); }).join(" | ");
      correctOptionText = q.match.map(function (pair) { return pair.left + " -> " + pair.right; }).join(" | ");
    } else if (q.kind === "sequence" && Array.isArray(q.sequence)) {
      const selectedSequence = Array.isArray(saved) ? saved : [];
      const allFilled = selectedSequence.length === q.sequence.length && selectedSequence.every(function (val) { return String(val || "").length > 0; });
      isCorrect = allFilled && selectedSequence.every(function (val, seqIdx) { return val === q.sequence[seqIdx]; });
      selectedOptionText = selectedSequence.map(function (val, seqIdx) { return (seqIdx + 1) + ") " + (val || "—"); }).join(" | ");
      correctOptionText = q.sequence.map(function (item, seqIdx) { return (seqIdx + 1) + ") " + item; }).join(" | ");
    } else if (q.kind === "fill_blank") {
      needsManualReview = true;
      const userValue = typeof saved === "string" ? saved : "";
      selectedOptionText = userValue;
      const accepted = Array.isArray(q.acceptedAnswers) && q.acceptedAnswers.length
        ? q.acceptedAnswers
        : (q.answer >= 0 && q.options[q.answer] ? [q.options[q.answer]] : []);
      isCorrect = accepted.map(normalizeText).includes(normalizeText(userValue));
      correctOptionText = accepted.join(" / ");
    } else if (q.kind === "open") {
      if (typeof saved === "number" && saved >= 0) {
        isCorrect = saved === q.answer;
        selectedOptionText = q.options[saved] || "";
        correctOptionText = q.answer >= 0 ? q.options[q.answer] : "";
      } else if (Array.isArray(q.options) && q.options.length && q.answer >= 0) {
        const userValue = typeof saved === "string" ? saved : "";
        selectedOptionText = userValue;
        correctOptionText = q.options[q.answer] || "";
        isCorrect = normalizeText(userValue) === normalizeText(correctOptionText);
      } else {
        needsManualReview = true;
        selectedOptionText = typeof saved === "string" ? saved : "";
        const keywords = Array.isArray(q.keywords) ? q.keywords : null;
        const accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
        if (keywords && keywords.length) {
          correctOptionText = "Ключевые слова: " + formatKeywordsHint(keywords);
          isCorrect = matchKeywordGroups(selectedOptionText, keywords);
        } else {
          correctOptionText = accepted.length ? accepted.join(" / ") : "—";
          isCorrect = accepted.length ? accepted.map(normalizeText).includes(normalizeText(selectedOptionText)) : false;
        }
      }
    } else if (q.kind === "multi") {
      const checked = Array.isArray(saved) ? saved.slice().sort(function (a, b) { return a - b; }) : [];
      const correctIndexes = Array.isArray(q.answer) ? q.answer.slice().sort(function (a, b) { return a - b; }) : [];
      isCorrect = checked.length === correctIndexes.length && checked.every(function (v, i) { return v === correctIndexes[i]; });
      selectedOptionText = checked.length ? checked.map(function (v) { return q.options[v]; }).join(" | ") : "";
      correctOptionText = correctIndexes.length ? correctIndexes.map(function (v) { return q.options[v]; }).join(" | ") : "";
    } else {
      const picked = typeof saved === "number" ? saved : -1;
      isCorrect = picked >= 0 && picked === q.answer;
      selectedOptionText = picked >= 0 ? q.options[picked] : "";
      correctOptionText = q.answer >= 0 ? q.options[q.answer] : "";
    }

    return { isCorrect: isCorrect, selectedOptionText: selectedOptionText, correctOptionText: correctOptionText, needsManualReview: needsManualReview };
  }

  function renderTeacherResultHtml(score, hasManualReview) {
    const level = score.competency;
    const categoryDetails = (window.PILOT_TEST_CATEGORIES || Object.keys(score.byCategory)).map(function (cat) {
      const row = score.byCategory[cat] || { ok: 0, total: 0 };
      if (!row.total) return "";
      const p = Math.round((row.ok / row.total) * 100);
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
  }

  function renderTeacherThanksHtml(score, hasManualReview) {
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
      "<b>Разбивка по категориям:</b><ul class=\"result-categories\">" + (window.PILOT_TEST_CATEGORIES || Object.keys(score.byCategory)).map(function (cat) {
        const row = score.byCategory[cat] || { ok: 0, total: 0 };
        if (!row.total) return "";
        const p = Math.round((row.ok / row.total) * 100);
        return "<li><span class=\"cat-name\">" + cat + "</span>: " + row.ok + "/" + row.total + " (" + p + "%)</li>";
      }).filter(Boolean).join("") + "</ul>" +
      "</div>"
    );
  }


  function renderCandidateResultHtml(score) {
    return (
      '<div class="result-summary">' +
      "<h3>Спасибо за прохождение тестирования</h3>" +
      '<p class="result-meta">Ваш общий результат:</p>' +
      '<div class="result-score-line"><span class="result-score-value">' + score.scorePercent + "%</span></div>" +
      "</div>"
    );
  }

  function collectAllAnswers() {
    const prev = currentIndex;
    for (let i = 0; i < questions.length; i += 1) {
      currentIndex = i;
      if (i === prev && quizContainer && quizContainer.innerHTML) {
        collectAnswer(i);
      } else if (questions[i].savedAnswer !== null && questions[i].savedAnswer !== undefined) {
        continue;
      }
    }
    currentIndex = prev;
  }

  function finishQuiz(auto) {
    if (!started || finished) return;
    collectAnswer(currentIndex);
    collectAllAnswers();
    clearInterval(timerId);
    started = false;
    finished = true;
    disableTabGuard();
    setNavLocked(false);

    const score = typeof window.calculateTestScore === "function"
      ? window.calculateTestScore(questions, function (q) { return gradeAnswer(q); })
      : (function () {
        const g = questions.map(function (q) { return gradeAnswer(q); });
        const correct = g.filter(function (x) { return x.isCorrect; }).length;
        const total = questions.length;
        const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
        return {
          correct: correct,
          total: total,
          scorePercent: scorePercent,
          competency: window.getCompetencyLevel ? window.getCompetencyLevel(scorePercent) : { label: "", description: "", cls: "" },
          byCategory: {},
          questions: g
        };
      })();

    // Определяем, есть ли вопросы, требующие ручной проверки
    var hasManualReview = score.questions.some(function (g) { return g.needsManualReview; });

    const completedAtMs = Date.now();
    resultPayload = {
      testType: testType,
      testTitle: testConfig ? testConfig.title : testType,
      participantFullName: participantFullName,
      participantEmail: participantEmail,
      recipientEmail: window.RESULT_RECIPIENT_EMAIL || "",
      sessionStartMs: sessionStartMs,
      startedAt: new Date(sessionStartMs).toISOString(),
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
    localStorage.removeItem(getAutosaveKey());
    sendResultCsvByEmail(resultPayload);

    if (quizContainer) quizContainer.innerHTML = "";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.classList.add("hidden");
    if (submitBtn) submitBtn.classList.add("hidden");

    if (resultBox) {
      const isCandidateTest = testType === "candidate_test";
      resultBox.className = "question result-panel";
      if (isCandidateTest) {
        resultBox.innerHTML =
          "<b>" + (testConfig ? testConfig.title : "Результат") + "</b><br>" +
          "<small>Участник: " + escapeHtml(participantFullName) + "</small><br>" +
          (auto ? "<small>Тест завершён автоматически по таймеру.</small><br>" : "") +
          renderCandidateResultHtml(score);
      } else {
        resultBox.innerHTML =
          "<b>" + (testConfig ? testConfig.title : "Результат") + "</b><br>" +
          "<small>Участник: " + escapeHtml(participantFullName) + "</small><br>" +
          "<small>Email: " + escapeHtml(participantEmail) + "</small><br>" +
          (auto ? "<small>Тест завершён автоматически по таймеру.</small><br>" : "") +
          renderTeacherThanksHtml(score, hasManualReview);
      }
    }
    if (quizActionsDone) quizActionsDone.classList.remove("hidden");
    updateExportPanel(testType, !isCandidateTest(testType));
    if (logNote) logNote.classList.toggle("hidden", isCandidateTest(testType));
    if (timerEl) timerEl.classList.remove("timer-urgent");
  }

  function resetToSelection() {
    const nextType = selectedTestType || testType || getLinkedTestType();
    clearInterval(timerId);
    if (testType) localStorage.removeItem(getAutosaveKey());
    started = false;
    finished = false;
    testType = null;
    testConfig = null;
    participantFullName = "";
    questions = [];
    currentIndex = 0;
    timerWarningShown = false;
    disableTabGuard();
    setNavLocked(false);
    if (quizContainer) quizContainer.innerHTML = "";
    if (resultBox) {
      resultBox.className = "question hidden";
      resultBox.innerHTML = "";
    }
    if (quizActionsDone) quizActionsDone.classList.add("hidden");
    if (exportPanel) exportPanel.classList.add("hidden");
    if (logNote) logNote.classList.add("hidden");
    if (timerWarning) timerWarning.classList.add("hidden");
    if (timerEl) {
      timerEl.textContent = "25:00";
      timerEl.classList.remove("timer-urgent");
    }
    if (quizScreen) quizScreen.removeAttribute("data-test-type");
    showStartScreen(nextType);
  }

  function restoreProgress(typeId) {
    const types = typeId ? [typeId] : ["teacher_test", "candidate_test"];
    for (let i = 0; i < types.length; i += 1) {
      const key = AUTOSAVE_PREFIX + "_" + types[i];
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const saved = JSON.parse(raw);
        if (!saved || !Array.isArray(saved.questions) || !saved.questions.length) continue;
        testType = saved.testType || types[i];
        setSelectedTestType(testType);
        participantFullName = normalizeFullName(saved.participantFullName);
        participantEmail = typeof saved.participantEmail === "string" ? saved.participantEmail : "";
        testConfig = window.TEST_CONFIGS[testType];
        questions = saved.questions;
        currentIndex = typeof saved.currentIndex === "number" ? saved.currentIndex : 0;
        leftSec = typeof saved.leftSec === "number" ? saved.leftSec : (testConfig ? testConfig.timeLimitSec : 1500);
        sessionStartMs = typeof saved.sessionStartMs === "number" ? saved.sessionStartMs : Date.now();
        timerWarningShown = !!saved.timerWarningShown;
        started = true;
        finished = false;
        if (quizScreen) quizScreen.setAttribute("data-test-type", testType);
        if (pilotTitle && testConfig) pilotTitle.textContent = testConfig.title;
        if (timerWarning) timerWarning.classList.toggle("hidden", !timerWarningShown);
        showScreen("quiz-screen");
        setNavLocked(true);
        renderCurrentQuestion();
        startTimer();
        enableTabGuard();
        return true;
      } catch (e) {
        localStorage.removeItem(key);
      }
    }
    return false;
  }

  function buildResultFilename(payload) {
    const date = new Date().toISOString().slice(0, 10);
    const name = normalizeFullName(payload.participantFullName)
      .replace(/[^a-zA-Zа-яА-ЯёЁ0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "participant";
    return "test-result-" + name + "-" + date + ".csv";
  }

  function buildResultCsv(payload) {
    return typeof window.buildResultCsv === "function"
      ? window.buildResultCsv(payload)
      : "";
  }

  function setDeliveryStatus(message, isError) {
    if (!resultDeliveryStatus) return;
    resultDeliveryStatus.textContent = message;
    resultDeliveryStatus.classList.remove("hidden");
    resultDeliveryStatus.classList.toggle("bad", !!isError);
  }

  var _vpnCheckResolved = false;
  var _vpnDetected = false;

  function detectVPN(callback) {
    // Используем ip-api.com для обнаружения VPN/прокси (бесплатно, без ключа)
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://ip-api.com/json/?fields=query,proxy,hosting", true);
    xhr.timeout = 5000;
    xhr.onload = function () {
      try {
        var data = JSON.parse(xhr.responseText);
        // proxy=true или hosting=true указывает на VPN/прокси/датацентр
        if (data.proxy === true || data.hosting === true) {
          callback(true);
        } else {
          callback(false);
        }
      } catch (e) {
        // Если не удалось проверить — не блокируем
        callback(false);
      }
    };
    xhr.onerror = function () {
      callback(false);
    };
    xhr.ontimeout = function () {
      callback(false);
    };
    xhr.send();
  }

  function showVpnWarning() {
    if (resultDeliveryStatus) {
      resultDeliveryStatus.innerHTML = '<div class="vpn-warning"><b>Обнаружено использование VPN-сервиса</b>Отправка результатов недоступна. Пожалуйста, отключите VPN и повторите попытку, либо свяжитесь с администратором.</div>';
      resultDeliveryStatus.classList.remove("hidden");
    }
  }

  function sendResultCsvByEmail(payload) {
    const endpoint = window.RESULT_EMAIL_ENDPOINT;
    if (!endpoint) {
      console.warn("RESULT_EMAIL_ENDPOINT is not configured. CSV email sending is skipped.");
      return;
    }

    const csv = buildResultCsv(payload);
    if (!csv) {
      setDeliveryStatus("Не удалось сформировать CSV для отправки.", true);
      return;
    }

    // Проверка VPN перед отправкой
    detectVPN(function (isVpn) {
      _vpnDetected = isVpn;
      _vpnCheckResolved = true;

      if (isVpn) {
        showVpnWarning();
        return;
      }

      doSendEmail(endpoint, csv, payload);
    });

    // Если проверка VPN затянулась, отправляем через 6 секунд в любом случае
    setTimeout(function () {
      if (!_vpnCheckResolved) {
        _vpnCheckResolved = true;
        doSendEmail(endpoint, csv, payload);
      }
    }, 6000);
  }

  function doSendEmail(endpoint, csv, payload) {
    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        csvContent: csv,
        filename: buildResultFilename(payload),
        testType: payload.testType || "",
        testTitle: payload.testTitle || "",
        participantFullName: payload.participantFullName || "",
        participantEmail: payload.participantEmail || "",
        scorePercent: payload.scorePercent || 0,
        to: payload.recipientEmail || window.RESULT_RECIPIENT_EMAIL || ""
      })
    })
      .then(function (response) {
        return response.json().catch(function () {
          return { error: "HTTP " + response.status };
        }).then(function (data) {
          if (!response.ok) throw new Error(data.error || "HTTP " + response.status);
          if (resultDeliveryStatus) {
            resultDeliveryStatus.textContent = "";
            resultDeliveryStatus.classList.add("hidden");
          }
        });
      })
      .catch(function (err) {
        const serverMessage = err && err.message ? err.message : "";
        const message = serverMessage
          ? serverMessage
          : (payload.testType === "candidate_test"
            ? "Не удалось передать результат организатору. Сообщите администратору."
            : "Не удалось отправить CSV на почту. Скачайте результат вручную.");
        setDeliveryStatus(message, true);
      });
  }

  function downloadFile(filename, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", function () {
      if (currentIndex <= 0) return;
      collectAnswer(currentIndex);
      currentIndex -= 1;
      renderCurrentQuestion();
      saveProgress();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      if (currentIndex >= questions.length - 1) return;
      collectAnswer(currentIndex);
      currentIndex += 1;
      renderCurrentQuestion();
      saveProgress();
    });
  }

  if (submitBtn) submitBtn.addEventListener("click", function () { finishQuiz(false); });

  if (restartBtn) {
    restartBtn.addEventListener("click", function () {
      const type = testType;
      const fullName = participantFullName;
      resetToSelection();
      if (type && fullName) startTest(type, fullName);
    });
  }

  if (backToSelectBtn) backToSelectBtn.addEventListener("click", function () {
    if (started && !finished && !confirm("Прервать текущую сессию?")) return;
    localStorage.removeItem(getAutosaveKey());
    resetToSelection();
  });

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener("click", function () {
      if (!resultPayload) return;
      downloadFile("test-result.json", JSON.stringify(resultPayload, null, 2), "application/json;charset=utf-8");
    });
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", function () {
      if (!resultPayload) return;
      downloadFile(buildResultFilename(resultPayload), buildResultCsv(resultPayload), "text/csv;charset=utf-8");
    });
  }

  if (fontIncBtn) {
    fontIncBtn.addEventListener("click", function () {
      const current = parseFloat(getComputedStyle(document.body).fontSize);
      document.body.style.fontSize = Math.min(current + 1, 22) + "px";
    });
  }
  if (fontDecBtn) {
    fontDecBtn.addEventListener("click", function () {
      const current = parseFloat(getComputedStyle(document.body).fontSize);
      document.body.style.fontSize = Math.max(current - 1, 14) + "px";
    });
  }

  navLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      if (started && !finished) {
        event.preventDefault();
        alert("Завершите тест или вернитесь на вкладку теста. Навигация по странице заблокирована.");
      }
    });
  });

  function renderCompetencyLegend() {
    const container = document.getElementById("competency-levels-list");
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
  }

  renderCompetencyLegend();
  initRoleNavigation();
  bindQuizContainerListener();
  const linkedTestType = getLinkedTestType();
  showStartScreen(linkedTestType);
  if (!restoreProgress(linkedTestType)) {
    showStartScreen(linkedTestType);
  }

})();
