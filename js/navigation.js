/**
 * Обработка навигации и старта теста.
 */
(function () {
  var app = window.__app;
  var dom = app.dom;

  function handleRoleSelection(event) {
    var button = event.target.closest("button");
    if (!button) return;

    var navTarget = button.getAttribute("data-nav-target");
    var typeId = button.getAttribute("data-test-type");

    // Only handle buttons with data-nav-target or data-test-type
    if (!navTarget && !typeId) return;

    if (navTarget) {
      event.preventDefault();
      app.showStartScreen(app.selectedTestType || app.getLinkedTestType());
      return;
    }

    if (!typeId) return;

    event.preventDefault();
    if (app.started) return;
    if (app.selectedTestType && app.selectedTestType !== typeId) return;

    var section = button.closest("section");
    var nameInput = section ? section.querySelector("[data-full-name]") : null;
    var emailInput = section ? section.querySelector("[data-email]") : null;
    var fullName = app.normalizeFullName(nameInput ? nameInput.value : app.participantFullName);
    var email = emailInput ? String(emailInput.value || "").trim() : app.participantEmail;

    if (!fullName) {
      alert("Введите ФИО перед началом теста.");
      if (nameInput) {
        nameInput.setAttribute("aria-invalid", "true");
        nameInput.focus();
      }
      return;
    }
    if (nameInput) nameInput.removeAttribute("aria-invalid");

    if (typeId === "teacher_test") {
      if (!email) {
        alert("Введите email перед началом теста.");
        if (emailInput) {
          emailInput.setAttribute("aria-invalid", "true");
          emailInput.focus();
        }
        return;
      }
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

    app.participantEmail = email;
    app.startTest(typeId, fullName);
  }

  app.initRoleNavigation = function initRoleNavigation() {
    var main = document.querySelector("main");
    if (!main) return;
    main.addEventListener("click", handleRoleSelection);
    main.addEventListener("input", function (event) {
      if (event.target.matches("[data-full-name]")) event.target.removeAttribute("aria-invalid");
      if (event.target.matches("[data-email]")) event.target.removeAttribute("aria-invalid");
    });
  };

  app.resetToSelection = function resetToSelection() {
    var nextType = app.selectedTestType || app.testType || app.getLinkedTestType();
    clearInterval(app.timerId);
    if (app.testType) localStorage.removeItem(app.getAutosaveKey());
    app.started = false;
    app.finished = false;
    app.testType = null;
    app.testConfig = null;
    app.participantFullName = "";
    app.questions = [];
    app.currentIndex = 0;
    app.timerWarningShown = false;
    app.disableTabGuard();
    app.setNavLocked(false);
    if (dom.quizContainer) dom.quizContainer.innerHTML = "";
    if (dom.resultBox) {
      dom.resultBox.className = "question hidden";
      dom.resultBox.innerHTML = "";
    }
    if (dom.quizActionsDone) dom.quizActionsDone.classList.add("hidden");
    if (dom.logNote) dom.logNote.classList.add("hidden");
    if (dom.timerWarning) dom.timerWarning.classList.add("hidden");
    if (dom.timerEl) {
      dom.timerEl.textContent = "25:00";
      dom.timerEl.classList.remove("timer-urgent");
    }
    if (dom.quizScreen) dom.quizScreen.removeAttribute("data-test-type");
    app.showStartScreen(nextType);
  };
})();
