/**
 * Limpia cabeceras/pies WordPress en HTML estático y ajusta SEO básico.
 * Ejecutar desde la raíz del repo: node scripts/patch-html.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const SITE_ORIGIN = "https://giorgiohermanos.com";

const META_BY_PATH = {
  "/": {
    description:
      "Giorgio Hermanos: servicios forestales y madera en Concordia, Entre Ríos. Proyectos forestales con rentabilidad y asesoramiento técnico.",
    ogType: "website",
  },
  "/quienes-somos/": {
    description:
      "Historia y equipo de Giorgio Hermanos S.R.L., empresa familiar de servicios forestales en Concordia, Entre Ríos.",
    ogType: "article",
  },
  "/servicios/": {
    description:
      "Servicios forestales de Giorgio Hermanos: asesoramiento, manejo de plantaciones, certificaciones y más en Entre Ríos.",
    ogType: "article",
  },
  "/productos/": {
    description:
      "Productos y maderas de Giorgio Hermanos, La Casa de la Madera en Concordia, Entre Ríos.",
    ogType: "article",
  },
  "/actividad-forestal/": {
    description:
      "Información sobre actividad forestal, apoyos y gestión de proyectos con Giorgio Hermanos.",
    ogType: "article",
  },
  "/especies/": {
    description: "Especies forestales y maderables trabajadas por Giorgio Hermanos.",
    ogType: "article",
  },
  "/imagenes/": {
    description: "Galería e imágenes de proyectos y instalaciones de Giorgio Hermanos.",
    ogType: "article",
  },
  "/contacto/": {
    description:
      "Contacto Giorgio Hermanos: Presidente Illia 756, Concordia, Entre Ríos. Consultas sobre servicios forestales.",
    ogType: "article",
  },
  "/uncategorized/nuevos-productos/": {
    description: "Novedades de productos — Giorgio Hermanos.",
    ogType: "article",
  },
  "/author/unq-wrdps-admin/": {
    description: "Giorgio Hermanos — perfil de publicación.",
    ogType: "profile",
  },
  "/category/uncategorized/": {
    description: "Giorgio Hermanos — categoría de notas.",
    ogType: "website",
  },
  "/login-customizer/": {
    description: "Giorgio Hermanos.",
    ogType: "website",
  },
};

function walkHtmlFiles(dir, out = []) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name.startsWith(".")) continue;
    const p = path.join(dir, name.name);
    if (name.isDirectory()) {
      if (name.name === "wp-includes" || name.name === "node_modules") continue;
      walkHtmlFiles(p, out);
    } else if (name.name === "index.html") {
      out.push(p);
    }
  }
  return out;
}

function relUrl(filePath) {
  const rel = path.relative(root, filePath).replace(/\\/g, "/");
  const dir = path.dirname(rel);
  if (dir === ".") return "/";
  return "/" + dir + "/";
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : "Giorgio Hermanos";
}

function stripWpHead(html, { isContact }) {
  let h = html;
  h = h.replace(/<link rel="profile"[^>]*>\s*/gi, "");
  h = h.replace(/<link rel="pingback"[^>]*>\s*/gi, "");
  h = h.replace(/<link rel="alternate" type="application\/rss\+xml"[^>]*>\s*/gi, "");
  h = h.replace(/<link rel="alternate" title="oEmbed[^>]*>\s*/gi, "");
  h = h.replace(/<link rel="https:\/\/api\.w\.org\/"[^>]*>\s*/gi, "");
  h = h.replace(/<link rel="EditURI"[^>]*>\s*/gi, "");
  h = h.replace(/<link rel="alternate" title="JSON"[^>]*>\s*/gi, "");
  h = h.replace(/<meta name="generator" content="WordPress[^"]*"[^>]*>\s*/gi, "");
  h = h.replace(/<link rel="shortlink"[^>]*>\s*/gi, "");
  if (!isContact) {
    h = h.replace(
      /<link rel="stylesheet" id="contact-form-7-css"[^>]*>\s*/gi,
      "",
    );
  }
  return h;
}

function insertSeo(html, pathname, title) {
  const meta = META_BY_PATH[pathname] || META_BY_PATH["/"];
  const abs = SITE_ORIGIN.replace(/\/$/, "") + pathname;
  const block = `
<meta name="description" content="${escapeAttr(meta.description)}">
<meta property="og:site_name" content="Giorgio Hermanos">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(meta.description)}">
<meta property="og:url" content="${escapeAttr(abs)}">
<meta property="og:type" content="${escapeAttr(meta.ogType)}">
<meta property="og:locale" content="es_AR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeAttr(title)}">
<meta name="twitter:description" content="${escapeAttr(meta.description)}">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">`;
  return html.replace(/<\/title>/i, `</title>${block}`);
}

function escapeAttr(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function stripFooterWp(html) {
  return html.replace(
    /<script type="speculationrules">[\s\S]*?(?=<script type="text\/javascript" src="\/wp-content\/themes\/zerif-lite\/js\/bootstrap\.min\.js)/i,
    "",
  );
}

function stripEmojiTail(html) {
  return html.replace(
    /<script id="wp-emoji-settings"[\s\S]*?<\/script>\s*<script type="module">[\s\S]*?<\/script>\s*(?=<\/body>)/i,
    "",
  );
}

function upgradeSchemaUrls(html) {
  return html
    .replace(/http:\/\/schema\.org\//g, "https://schema.org/")
    .replace(/href="\/\/fonts\.googleapis\.com/g, 'href="https://fonts.googleapis.com');
}

function patchContactForm(html) {
  const newForm = `<div class="wpcf7" id="contacto-form-wrap" lang="es" dir="ltr">
<div class="screen-reader-response"><p role="status" aria-live="polite" aria-atomic="true"></p></div>
<form id="giorgio-contact-form" class="wpcf7-form init" method="post" action="/api/contact" novalidate>
<p>Nombre y Apellido</p>
<p><span class="wpcf7-form-control-wrap"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-text wpcf7-validates-as-required" aria-required="true" type="text" name="name" autocomplete="name" required></span></p>
<p>Email</p>
<p><span class="wpcf7-form-control-wrap"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-email wpcf7-validates-as-required wpcf7-text wpcf7-validates-as-email" aria-required="true" type="email" name="email" autocomplete="email" required></span></p>
<p>Motivo</p>
<p><span class="wpcf7-form-control-wrap"><input size="40" maxlength="400" class="wpcf7-form-control wpcf7-text" type="text" name="subject" autocomplete="off"></span></p>
<p>Mensaje</p>
<p><span class="wpcf7-form-control-wrap"><textarea cols="40" rows="10" maxlength="2000" class="wpcf7-form-control wpcf7-textarea" name="message" required></textarea></span></p>
<p><input class="wpcf7-form-control wpcf7-submit" type="submit" value="Enviar"></p>
<div class="wpcf7-response-output" aria-hidden="true"></div>
</form>
</div>`;
  return html.replace(
    /<div class="wpcf7 no-js"[\s\S]*?<\/form>\s*<\/div>/i,
    newForm,
  );
}

function addContactScript(html) {
  if (html.includes("contact-form.js")) return html;
  return html.replace(
    /(<script type="text\/javascript" src="\/wp-content\/themes\/zerif-lite\/js\/bootstrap\.min\.js[^"]*"[^>]*><\/script>)/i,
    `$1
<script type="text/javascript" src="/js/contact-form.js" defer></script>`,
  );
}

function fixFerozoImage(html) {
  return html.replace(
    /http:\/\/c1641487\.ferozo\.com\/wp-content\//g,
    "/wp-content/",
  );
}

function noindexJunk(html, pathname) {
  if (
    pathname === "/login-customizer/" ||
    pathname === "/category/uncategorized/"
  ) {
    return html.replace(
      /<meta name="robots" content="max-image-preview:large">/i,
      '<meta name="robots" content="noindex, follow">',
    );
  }
  return html;
}

const files = walkHtmlFiles(root).filter((f) => !f.includes(`${path.sep}wp-`));

for (const file of files) {
  let html = fs.readFileSync(file, "utf8");
  const pathname = relUrl(file);
  const isContact = pathname === "/contacto/";
  const title = extractTitle(html);

  html = stripWpHead(html, { isContact });
  if (!html.includes('property="og:site_name"')) {
    html = insertSeo(html, pathname, title);
  }
  html = stripFooterWp(html);
  html = stripEmojiTail(html);
  html = upgradeSchemaUrls(html);
  html = fixFerozoImage(html);
  html = noindexJunk(html, pathname);

  if (isContact) {
    html = patchContactForm(html);
    html = addContactScript(html);
  }

  fs.writeFileSync(file, html, "utf8");
  console.log("OK", pathname);
}

console.log("Listo:", files.length, "archivos");
