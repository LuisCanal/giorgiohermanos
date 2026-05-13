(function () {
  var form = document.getElementById("giorgio-contact-form");
  if (!form || !(form instanceof HTMLFormElement)) return;

  var out = form.querySelector(".wpcf7-response-output");

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
          } catch (e) {
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
        }
      })
      .catch(function () {
        form.classList.remove("submitting");
        form.classList.add("failed");
        if (out) {
          out.textContent = "Error de red. Probá de nuevo.";
          out.removeAttribute("aria-hidden");
        }
      });
  });
})();
