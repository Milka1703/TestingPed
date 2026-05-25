/**
 * Отправка результата по email + скачивание файла.
 */
(function () {
  var app = window.__app;
  var dom = app.dom;

  function buildResultFilename(payload) {
    var date = new Date().toISOString().slice(0, 10);
    var name = app.normalizeFullName(payload.participantFullName)
      .replace(/[^a-zA-Zа-яА-ЯёЁ0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "participant";
    return "test-result-" + name + "-" + date + ".csv";
  }

  function buildResultCsv(payload) {
    return typeof window.buildResultCsv === "function"
      ? window.buildResultCsv(payload)
      : "";
  }

  function doSendEmail(endpoint, csv, payload) {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
          if (dom.resultDeliveryStatus) {
            dom.resultDeliveryStatus.textContent = "";
            dom.resultDeliveryStatus.classList.add("hidden");
          }
        });
      })
      .catch(function (err) {
        var serverMessage = err && err.message ? err.message : "";
        var message = serverMessage
          ? serverMessage
          : (payload.testType === "candidate_test"
            ? "Не удалось передать результат организатору. Сообщите администратору."
            : "Не удалось отправить CSV на почту. Скачайте результат вручную.");
        app.setDeliveryStatus(message, true);
      });
  }

  app.sendResultCsvByEmail = function sendResultCsvByEmail(payload) {
    var endpoint = window.RESULT_EMAIL_ENDPOINT;
    if (!endpoint) {
      console.warn("RESULT_EMAIL_ENDPOINT is not configured. CSV email sending is skipped.");
      return;
    }

    var csv = buildResultCsv(payload);
    if (!csv) {
      app.setDeliveryStatus("Не удалось сформировать CSV для отправки.", true);
      return;
    }

    // Проверка VPN — показываем предупреждение, но НЕ блокируем отправку
    app._vpnCheckResolved = false;
    app._vpnDetected = false;

    app.detectVPN(function (isVpn) {
      app._vpnDetected = isVpn;
      app._vpnCheckResolved = true;

      if (isVpn) {
        app.showVpnWarning();
      }

      doSendEmail(endpoint, csv, payload);
    });

    // Если проверка VPN затянулась, отправляем через 6 секунд в любом случае
    setTimeout(function () {
      if (!app._vpnCheckResolved) {
        app._vpnCheckResolved = true;
        app.showVpnWarning();
        doSendEmail(endpoint, csv, payload);
      }
    }, 6000);
  };

  app.downloadFile = function downloadFile(filename, content, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
})();
