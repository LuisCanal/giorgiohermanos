type Env = {
  RESEND_API_KEY: string;
  CONTACT_TO?: string;
  MAIL_TO?: string;
  MAIL_FROM?: string;
};

type PagesCtx = { request: Request; env: Env };

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allow =
    origin && origin !== "null"
      ? origin
      : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "86400",
  };
}

function json(
  body: unknown,
  request: Request,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  const h = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders(request),
    ...init.headers,
  });
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: h,
  });
}

export const onRequest = async ({ request, env }: PagesCtx): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(request),
    });
  }

  if (request.method !== "POST") {
    return json({ ok: false, error: "Método no permitido" }, request, {
      status: 405,
      headers: { Allow: "POST, OPTIONS" },
    });
  }

  const apiKey = env.RESEND_API_KEY;
  const to = env.CONTACT_TO || env.MAIL_TO;
  if (!apiKey || !to) {
    return json(
      {
        ok: false,
        error: "Falta configuración del servidor",
        hint: "Definí RESEND_API_KEY y CONTACT_TO (o MAIL_TO) en Pages → Settings → Variables (y redeploy).",
      },
      request,
      { status: 503 },
    );
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
      return json({ ok: false, error: "JSON inválido" }, request, { status: 400 });
    }
  } else {
    const form = await request.formData();
    name = String(form.get("name") ?? form.get("your-name") ?? "");
    email = String(form.get("email") ?? form.get("your-email") ?? "");
    subject = String(form.get("subject") ?? form.get("your-subject") ?? "");
    message = String(form.get("message") ?? form.get("your-message") ?? "");
  }

  if (!name.trim() || !email.trim() || !message.trim()) {
    return json(
      { ok: false, error: "Nombre, email y mensaje son obligatorios" },
      request,
      { status: 400 },
    );
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
    console.error("[contact] Resend HTTP", res.status, detail.slice(0, 500));
    return json(
      {
        ok: false,
        error: "No se pudo enviar el mensaje",
        detail: detail.slice(0, 400),
      },
      request,
      { status: 502 },
    );
  }

  return json({ ok: true }, request, { status: 200 });
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
