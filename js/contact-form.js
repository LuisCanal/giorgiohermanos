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
    var payload = {
      name: fd.get("name"),
      email: fd.get("email"),
      subject: fd.get("subject"),
      message: fd.get("message"),
    };

    fetch("/api/contact", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
      .then(function (r) {
        return r.json().then(function (data) {
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
            out.textContent =
              (data && data.error) || "Error al enviar. Probá de nuevo más tarde.";
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
