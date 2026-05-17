(function () {
  const baseQuestions = Array.isArray(window.PILOT_QUESTIONS) ? window.PILOT_QUESTIONS : [];
  const AUTOSAVE_PREFIX = "it_competence_test_v2";

  const selectionScreen = document.getElementById("test-selection-screen");
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
  const logNote = document.getElementById("log-note");
  const fontIncBtn = document.getElementById("font-inc-btn");
  const fontDecBtn = document.getElementById("font-dec-btn");
  const navLinks = document.querySelectorAll("header nav a");

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
      .replace(/\s+/g, " ");
  }

  function showScreen(screen) {
    if (selectionScreen) selectionScreen.classList.toggle("hidden", screen !== "selection");
    if (quizScreen) quizScreen.classList.toggle("hidden", screen !== "quiz");
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
    const categoryLine = q.category ? '<span class="pill">' + q.category + "</span><br>" : "";
    return (
      "<" + d + ' class="question" data-question-index="' + idx + '">' +
      categoryLine + kindPills + (kindPills ? "<br>" : "") +
      "<b>" + q.text + "</b>" + mediaHtml +
      "<" + d + ' class="options">' + optionsHtml + "</" + d + "></" + d + ">"
    );
  }

  function bindQuestionControls(idx) {
    const controls = quizContainer.querySelectorAll("input[type='radio'], input[type='checkbox'], select[data-match='1'], select[data-sequence='1'], textarea[data-open='1'], input[data-fill='1']");
    controls.forEach(function (control) {
      const eventName = control.tagName === "TEXTAREA" || (control.tagName === "INPUT" && control.getAttribute("data-fill") === "1") ? "input" : "change";
      control.addEventListener(eventName, function () {
        collectAnswer(idx);
        const q = questions[idx];
        if (q) q.changeCount = (q.changeCount || 0) + 1;
        saveProgress();
      });
    });
  }

  function renderCurrentQuestion() {
    const q = questions[currentIndex];
    if (!q || !quizContainer) return;
    quizContainer.innerHTML = renderQuestionHtml(q, currentIndex);
    applySavedAnswer(currentIndex);
    bindQuestionControls(currentIndex);
    updateProgress();
    updateNavButtons();
  }

  function saveProgress() {
    if (!started || finished || !testType) return;
    collectAnswer(currentIndex);
    localStorage.setItem(getAutosaveKey(), JSON.stringify({
      testType: testType,
      leftSec: leftSec,
      currentIndex: currentIndex,
      sessionStartMs: sessionStartMs,
      timerWarningShown: timerWarningShown,
      questions: questions
    }));
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

  function startTest(typeId) {
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
    if (logNote) logNote.classList.add("hidden");

    showScreen("quiz");
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
        selectedOptionText = typeof saved === "string" ? saved : "";
        correctOptionText = "—";
        isCorrect = false;
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

    return { isCorrect: isCorrect, selectedOptionText: selectedOptionText, correctOptionText: correctOptionText };
  }

  function renderResultHtml(score) {
    const level = score.competency;
    const categoryDetails = (window.PILOT_TEST_CATEGORIES || Object.keys(score.byCategory)).map(function (cat) {
      const row = score.byCategory[cat] || { ok: 0, total: 0 };
      if (!row.total) return "";
      const p = Math.round((row.ok / row.total) * 100);
      return "<li><span class=\"cat-name\">" + cat + "</span>: " + row.ok + "/" + row.total + " (" + p + "%)</li>";
    }).filter(Boolean).join("");

    return (
      '<div class="result-summary ' + level.cls + '">' +
      '<div class="result-score-line"><span class="result-score-value">' + score.scorePercent + '%</span></div>' +
      '<p class="result-meta">Правильных ответов: <b>' + score.correct + "</b> из <b>" + score.total + "</b></p>" +
      '<div class="competency-badge ' + level.cls + '">' +
      "<b>" + level.label + "</b>" +
      '<p class="competency-desc">' + level.description + "</p>" +
      "</div>" +
      "</div>" +
      "<b>Разбивка по категориям:</b><ul class=\"result-categories\">" + categoryDetails + "</ul>"
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

    const completedAtMs = Date.now();
    resultPayload = {
      testType: testType,
      testTitle: testConfig ? testConfig.title : testType,
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

    if (quizContainer) quizContainer.innerHTML = "";
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.classList.add("hidden");
    if (submitBtn) submitBtn.classList.add("hidden");

    if (resultBox) {
      resultBox.className = "question result-panel";
      resultBox.innerHTML =
        "<b>" + (testConfig ? testConfig.title : "Результат") + "</b><br>" +
        (auto ? "<small>Тест завершён автоматически по таймеру.</small><br>" : "") +
        renderResultHtml(score);
    }
    if (quizActionsDone) quizActionsDone.classList.remove("hidden");
    if (exportPanel) exportPanel.classList.remove("hidden");
    if (logNote) logNote.classList.remove("hidden");
    if (timerEl) timerEl.classList.remove("timer-urgent");
  }

  function resetToSelection() {
    clearInterval(timerId);
    if (testType) localStorage.removeItem(getAutosaveKey());
    started = false;
    finished = false;
    testType = null;
    testConfig = null;
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
    showScreen("selection");
  }

  function restoreProgress() {
    const types = ["teacher_test", "candidate_test"];
    for (let i = 0; i < types.length; i += 1) {
      const key = AUTOSAVE_PREFIX + "_" + types[i];
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const saved = JSON.parse(raw);
        if (!saved || !Array.isArray(saved.questions) || !saved.questions.length) continue;
        testType = saved.testType || types[i];
        testConfig = window.TEST_CONFIGS[testType];
        questions = saved.questions;
        currentIndex = typeof saved.currentIndex === "number" ? saved.currentIndex : 0;
        leftSec = typeof saved.leftSec === "number" ? saved.leftSec : (testConfig ? testConfig.timeLimitSec : 1500);
        sessionStartMs = typeof saved.sessionStartMs === "number" ? saved.sessionStartMs : Date.now();
        timerWarningShown = !!saved.timerWarningShown;
        started = true;
        finished = false;
        if (pilotTitle && testConfig) pilotTitle.textContent = testConfig.title;
        if (timerWarning) timerWarning.classList.toggle("hidden", !timerWarningShown);
        showScreen("quiz");
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

  document.querySelectorAll("[data-test-type]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      if (started) return;
      startTest(btn.getAttribute("data-test-type"));
    });
  });

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
      resetToSelection();
      if (type) startTest(type);
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
      const csv = typeof window.buildResultCsv === "function"
        ? window.buildResultCsv(resultPayload)
        : "";
      downloadFile("test-result.csv", csv, "text/csv;charset=utf-8");
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
  showScreen("selection");
  if (!restoreProgress()) {
    showScreen("selection");
  }

})();
