type Env = {
  RESEND_API_KEY: string;
  CONTACT_TO?: string;
  MAIL_TO?: string;
  MAIL_FROM?: string;
};

type PagesCtx = { request: Request; env: Env };

export const onRequest = async ({ request, env }: PagesCtx): Promise<Response> => {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Método no permitido" }), {
      status: 405,
      headers: { "Content-Type": "application/json; charset=utf-8", Allow: "POST" },
    });
  }

  const apiKey = env.RESEND_API_KEY;
  const to = env.CONTACT_TO || env.MAIL_TO;
  if (!apiKey || !to) {
    return new Response(JSON.stringify({ ok: false, error: "Falta configuración del servidor" }), {
      status: 503,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  let name = "";
  let email = "";
  let subject = "";
  let message = "";
  const ct = request.headers.get("content-type") || "";

  if (ct.includes("application/json")) {
    try {
      const j = (await request.json()) as Record<string, unknown>;
      name = String(j.name ?? j["your-name"] ?? "");
      email = String(j.email ?? j["your-email"] ?? "");
      subject = String(j.subject ?? j["your-subject"] ?? "");
      message = String(j.message ?? j["your-message"] ?? "");
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "JSON inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
  } else {
    const form = await request.formData();
    name = String(form.get("name") ?? form.get("your-name") ?? "");
    email = String(form.get("email") ?? form.get("your-email") ?? "");
    subject = String(form.get("subject") ?? form.get("your-subject") ?? "");
    message = String(form.get("message") ?? form.get("your-message") ?? "");
  }

  if (!name.trim() || !email.trim() || !message.trim()) {
    return new Response(JSON.stringify({ ok: false, error: "Nombre, email y mensaje son obligatorios" }), {
      status: 400,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const subj = subject.trim() || "Consulta desde la web";
  const from =
    env.MAIL_FROM ||
    "Giorgio Hermanos <onboarding@resend.dev>";

  const html = `<p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
<p><strong>Email:</strong> ${escapeHtml(email)}</p>
<p><strong>Motivo:</strong> ${escapeHtml(subject)}</p>
<p><strong>Mensaje:</strong></p><p>${nl2br(escapeHtml(message))}</p>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: email,
      subject: `[Giorgio Hermanos] ${subj}`,
      html,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    return new Response(
      JSON.stringify({
        ok: false,
        error: "No se pudo enviar el mensaje",
        detail: detail.slice(0, 400),
      }),
      {
        status: 502,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      },
    );
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nl2br(s: string): string {
  return s.replace(/\r\n/g, "\n").replace(/\n/g, "<br>");
}
