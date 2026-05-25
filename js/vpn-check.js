/**
 * Проверка VPN через ip-api.com.
 */
(function () {
  var app = window.__app;
  var dom = app.dom;

  app.detectVPN = function detectVPN(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open("GET", "https://ip-api.com/json/?fields=query,proxy,hosting", true);
    xhr.timeout = 5000;
    xhr.onload = function () {
      try {
        var data = JSON.parse(xhr.responseText);
        if (data.proxy === true || data.hosting === true) {
          callback(true);
        } else {
          callback(false);
        }
      } catch (e) {
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
  };

  app.showVpnWarning = function showVpnWarning() {
    if (dom.resultDeliveryStatus) {
      dom.resultDeliveryStatus.innerHTML = '<div class="vpn-warning"><b>Обнаружено использование VPN-сервиса</b>Результаты могут быть отправлены с задержкой. Если письмо не пришло в течение 10 минут, свяжитесь с администратором.</div>';
      dom.resultDeliveryStatus.classList.remove("hidden");
    }
  };
})();
