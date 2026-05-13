(function () {
  var form = document.getElementById("giorgio-contact-form");
  if (!form || !(form instanceof HTMLFormElement)) return;

  var out = form.querySelector(".wpcf7-response-output");
  var qEl = document.getElementById("gh-captcha-q");
  var n1El = document.getElementById("gh-n1");
  var n2El = document.getElementById("gh-n2");
  var tsEl = document.getElementById("gh-form-opened-ts");
  var ansEl = document.getElementById("gh-captcha-ans");

  function randInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function setupCaptcha() {
    if (!qEl || !n1El || !n2El || !tsEl) return;
    var a = randInt(2, 12);
    var b = randInt(2, 12);
    n1El.value = String(a);
    n2El.value = String(b);
    tsEl.value = String(Date.now());
    qEl.textContent = "¿Cuánto es " + a + " + " + b + "? (anti-spam)";
    if (ansEl) {
      ansEl.value = "";
    }
  }

  setupCaptcha();

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    form.classList.remove("sent", "failed", "invalid");
    form.classList.add("submitting");
    if (out) {
      out.textContent = "";
      out.setAttribute("aria-hidden", "true");
    }

    var fd = new FormData(form);
    var body = new URLSearchParams();
    body.set("name", String(fd.get("name") || ""));
    body.set("email", String(fd.get("email") || ""));
    body.set("subject", String(fd.get("subject") || ""));
    body.set("message", String(fd.get("message") || ""));
    body.set("company_site", String(fd.get("company_site") || ""));
    body.set("gh_n1", String(fd.get("gh_n1") || ""));
    body.set("gh_n2", String(fd.get("gh_n2") || ""));
    body.set("captcha_answer", String(fd.get("captcha_answer") || ""));
    body.set("form_opened_ts", String(fd.get("form_opened_ts") || ""));

    fetch("/api/contact", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
      body: body,
    })
      .then(function (r) {
        return r.text().then(function (text) {
          var data = {};
          try {
            data = text ? JSON.parse(text) : {};
          } catch (err) {
            data = { error: text || "Respuesta inválida del servidor" };
          }
          return { r: r, data: data };
        });
      })
      .then(function (_ref) {
        var r = _ref.r;
        var data = _ref.data;
        form.classList.remove("submitting");
        if (r.ok && data.ok) {
          form.classList.add("sent");
          if (out) {
            out.textContent = "Gracias. Tu mensaje fue enviado.";
            out.removeAttribute("aria-hidden");
          }
          form.reset();
          setupCaptcha();
        } else {
          form.classList.add("failed");
          if (out) {
            var msg =
              (data && data.error) || "Error al enviar. Probá de nuevo más tarde.";
            if (data && data.detail) {
              msg += " (" + String(data.detail).slice(0, 200) + ")";
            }
            if (data && data.hint) {
              msg += " " + data.hint;
            }
            out.textContent = msg;
            out.removeAttribute("aria-hidden");
          }
          setupCaptcha();
        }
      })
      .catch(function () {
        form.classList.remove("submitting");
        form.classList.add("failed");
        if (out) {
          out.textContent = "Error de red. Probá de nuevo.";
          out.removeAttribute("aria-hidden");
        }
        setupCaptcha();
      });
  });
})();
