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

const MIN_MS = 2500;
const MAX_MS = 45 * 60 * 1000;

function parseFormFields(request: Request, ct: string): Promise<Record<string, string>> {
  if (ct.includes("application/json")) {
    return request.json().then((j) => {
      const o = j as Record<string, unknown>;
      const s: Record<string, string> = {};
      for (const k of Object.keys(o)) {
        s[k] = String(o[k] ?? "");
      }
      return s;
    });
  }
  return request.formData().then((form) => {
    const s: Record<string, string> = {};
    for (const [k, v] of form.entries()) {
      s[k] = typeof v === "string" ? v : "";
    }
    return s;
  });
}

function validateAntiSpam(fd: Record<string, string>): string | null {
  if (String(fd.company_site ?? "").trim() !== "") {
    return "No se pudo enviar el mensaje.";
  }

  const opened = Number(fd.form_opened_ts);
  const now = Date.now();
  if (!Number.isFinite(opened) || opened <= 0) {
    return "Recargá la página e intentá de nuevo.";
  }
  const elapsed = now - opened;
  if (elapsed < MIN_MS) {
    return "Esperá unos segundos antes de enviar (protección anti-spam).";
  }
  if (elapsed > MAX_MS) {
    return "La sesión expiró. Recargá la página e intentá de nuevo.";
  }

  const n1 = parseInt(String(fd.gh_n1), 10);
  const n2 = parseInt(String(fd.gh_n2), 10);
  const ans = parseInt(String(fd.captcha_answer), 10);
  if (!Number.isFinite(n1) || !Number.isFinite(n2) || !Number.isFinite(ans)) {
    return "Completá la verificación numérica.";
  }
  if (n1 < 1 || n1 > 20 || n2 < 1 || n2 > 20) {
    return "Verificación no válida. Recargá la página.";
  }
  if (ans < 2 || ans > 40 || n1 + n2 !== ans) {
    return "La suma no es correcta. Revisá el resultado e intentá de nuevo.";
  }

  return null;
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

  const ct = request.headers.get("content-type") || "";
  let fd: Record<string, string>;
  try {
    fd = await parseFormFields(request, ct);
  } catch {
    return json({ ok: false, error: "Datos del formulario inválidos" }, request, {
      status: 400,
    });
  }

  const spamErr = validateAntiSpam(fd);
  if (spamErr) {
    return json({ ok: false, error: spamErr }, request, { status: 400 });
  }

  const name = String(fd.name ?? fd["your-name"] ?? "");
  const email = String(fd.email ?? fd["your-email"] ?? "");
  const subject = String(fd.subject ?? fd["your-subject"] ?? "");
  const message = String(fd.message ?? fd["your-message"] ?? "");

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
