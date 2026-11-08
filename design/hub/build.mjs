// Builds the Journey Hub (design/hub/index.html): one page with the screens, design system,
// design cues, inspiration, requirements, roadmap and tech plan, generated from the repo.
//
//   npm ci --prefix design/hub && npm run build --prefix design/hub
//   node design/hub/build.mjs --files   # prints the image list to publish with the page
//
// Sources: docs/*.md, design/tokens.json, design/hub/status.json and design/hub/src/*.
// The output is a page fragment for the Artifact tool, which adds <html>, <head> and <body>.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marked } from 'marked';

const HUB = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HUB, '..', '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const src = (name) => readFileSync(join(HUB, 'src', name), 'utf8').trimEnd();
const tokens = JSON.parse(read('design/tokens.json'));
const status = JSON.parse(read('design/hub/status.json'));

const ASSET_DIRS = ['img', 'inspiration'];
if (process.argv.includes('--files')) {
  const files = ASSET_DIRS.flatMap((d) => readdirSync(join(HUB, d)).filter((f) => !f.startsWith('.')).sort().map((f) => ({ path: `${d}/${f}` })));
  console.log(JSON.stringify(files));
  process.exit(0);
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (md) => new Marked().parseInline(String(md));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------- docs: each one becomes a view; links between docs become links between views ---------- */
const DOCS = [
  { file: 'docs/04-design-brief.md', view: 'cues' },
  { file: 'docs/05-inspiration.md', view: 'inspiration' },
  { file: 'docs/01-requirements.md', view: 'requirements' },
  { file: 'docs/03-roadmap.md', view: 'roadmap' },
  { file: 'docs/02-tech-stack.md', view: 'tech' },
];
const VIEW_OF = Object.fromEntries(DOCS.map((d) => [basename(d.file), d.view]));
const ARCH = src('architecture.html') + '\n';

// GitHub's heading anchors, kept to ASCII letters, digits and hyphens (the only # links a hub URL keeps).
const slugify = (text) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  .replace(/[^a-z0-9 -]/g, '').replace(/ /g, '-');

function rewriteHref(href, view) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return { href, external: true };
  if (href.startsWith('#')) return { href: `#${view}-${href.slice(1)}` };
  const [path, frag] = href.split('#');
  const target = VIEW_OF[basename(path)];
  if (target) return { href: frag ? `#${target}-${frag}` : `#${target}` };
  return null; // a repo file the hub doesn't show: keep the words, drop the link
}

function renderDoc(md, view) {
  const seen = new Map();
  const toc = [];
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading(text, level, raw) {
        let slug = slugify(raw);
        const n = seen.get(slug) || 0;
        seen.set(slug, n + 1);
        if (n) slug += `-${n}`;
        const id = `${view}-${slug}`;
        if (level === 2) toc.push(`<a href="#${id}">${esc(raw)}</a>`);
        return `<h${level} id="${id}">${text}</h${level}>\n`;
      },
      link(href, title, text) {
        const r = rewriteHref(href, view);
        if (!r) return text;
        const url = esc(encodeURI(r.href).replace(/%25/g, '%'));
        return `<a href="${url}"${title ? ` title="${title}"` : ''}${r.external ? ' target="_blank" rel="noopener"' : ''}>${text}</a>`;
      },
      image(href, title, text) {
        // Doc images live in design/hub, next to the page.
        const url = esc(href.replace(/^(\.\.\/)*design\/hub\//, ''));
        return `<img src="${url}" alt="${text}" loading="lazy"${title ? ` title="${title}"` : ''}>`;
      },
      table(header, body) {
        return `<div class="table-wrap"><table>\n<thead>\n${header}</thead>\n${body ? `<tbody>${body}</tbody>` : ''}</table></div>\n`;
      },
      code(code, lang) {
        // The architecture chart is mermaid on GitHub and an HTML diagram in the hub.
        return (lang || '').trim().split(/\s/)[0] === 'mermaid' ? ARCH : false;
      },
    },
  });
  const html = marked.parse(md);
  return { html, toc: toc.length ? `<span class="label">On this page</span>${toc.join('')}` : '' };
}

function section(md, heading) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => heading.test(l));
  if (start < 0) throw new Error(`No section matching ${heading}`);
  const next = lines.findIndex((l, i) => i > start && /^#{1,2} /.test(l));
  return lines.slice(start + 1, next < 0 ? lines.length : next).join('\n');
}

const docs = Object.fromEntries(DOCS.map((d) => [d.view, renderDoc(read(d.file), d.view)]));
const decisions = renderDoc(section(read('docs/01-requirements.md'), /^## (\d+\.\s*)?Decisions\s*$/), 'requirements').html;

/* ---------- tokens ---------- */
const ACC = tokens.accent;
const base = ACC.chosen || ACC.default;
if (!ACC.options[base]) throw new Error(`tokens.json: accent "${base}" is not one of the options`);

function tokensCss() {
  const decls = (obj) => Object.entries(obj).map(([k, v]) => `--${k}: ${v};`).join(' ');
  const accent = (o) => `--accent: ${o.accent}; --on-accent: ${o.onAccent}; --accent-text-l: ${o.textLight}; --accent-text-d: ${o.textDark}; --accent-soft-l: ${o.softLight}; --accent-soft-d: ${o.softDark};`;
  const theme = (mode) => [
    decls(tokens.color[mode]),
    decls(tokens.shadow[mode]),
    mode === 'light' ? '--accent-text: var(--accent-text-l); --accent-soft: var(--accent-soft-l);' : '--accent-text: var(--accent-text-d); --accent-soft: var(--accent-soft-d);',
  ].join('\n  ');
  return [
    '/* Generated from design/tokens.json by design/hub/build.mjs. Change the tokens, not this block. */',
    `:root { --font: ${tokens.font.stack}; ${accent(ACC.options[base])} --on-photo: ${tokens.onPhoto.text}; --photo-glass: ${tokens.onPhoto.glass}; --photo-glass-line: ${tokens.onPhoto.glassLine}; }`,
    ...Object.entries(ACC.options).map(([k, o]) => `.app[data-accent="${k}"] { ${accent(o)} }`),
    '/* phone screens: light unless the theme switch, or the viewer\'s own setting on Auto, says dark */',
    `.ph {\n  ${theme('light')}\n}`,
    `.ph.always-dark, .app[data-screens="dark"] .ph, :root[data-theme="dark"] .app[data-screens="auto"] .ph {\n  ${theme('dark')}\n}`,
    `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) .app[data-screens="auto"] .ph {\n  ${theme('dark')}\n  }\n}`,
  ].join('\n');
}

const accentButtons = Object.entries(ACC.options).map(([k, o]) =>
  `<button type="button" id="ac-${k}" data-set-accent="${k}" aria-pressed="${k === base}"><i style="background:${o.accent}"></i>${esc(o.label)}${k === ACC.chosen ? ' (chosen)' : ''}</button>`).join('');
const accentCards = Object.entries(ACC.options).map(([k, o]) =>
  `<button type="button" class="acc-card" id="card-${k}" data-set-accent="${k}" aria-pressed="${k === base}"><i style="background:${o.accent}"></i><b>${esc(o.label)}${k === ACC.chosen ? ' · chosen' : ''}</b><span>${esc(o.note)}</span><code>${o.accent} · ${esc(o.contrast)}</code></button>`).join('\n');
const accentIntro = ACC.chosen
  ? `${esc(ACC.options[ACC.chosen].label)} is the chosen accent. Buttons, the + tab, progress rings and milestones use it.`
  : 'Pick one. Buttons, the + tab, progress rings and milestones use it.';

const SWATCHES = [['bg', 'Background'], ['surface', 'Surface'], ['fill', 'Fill'], ['line', 'Line'], ['muted', 'Muted text'], ['text', 'Text'],
  ['like', 'Like'], ['ok', 'Active'], ['warn', 'Paused'], ['done', 'Completed']];
const swatches = (mode, label) => `<div><span class="label">${label}</span><ul aria-label="${label} theme">${SWATCHES.map(([k, name]) => {
  const v = tokens.color[mode][k];
  if (!v) throw new Error(`tokens.json: color.${mode}.${k} is missing`);
  return `<li><i style="background:${v}"></i>${name}<code>${v}</code></li>`;
}).join('')}</ul></div>`;

const typeSpecimens = tokens.type.map((t) => {
  const style = `font-size:${t.size}px; line-height:${t.line}px; font-weight:${t.weight}; letter-spacing:${t.tracking}em${t.caps ? '; text-transform:uppercase; color:var(--page-accent)' : ''}`;
  return `<div><span style="${style}">${esc(t.sample)}</span><code>${esc(t.name)} · ${t.size}/${t.line} · ${t.weight}${t.caps ? ' · caps' : ''}</code></div>`;
}).join('\n');
const radii = Object.entries(tokens.radius).map(([k, v]) =>
  `<li><i style="--r:${Math.min(v, 60)}px"></i>${cap(k)}<code>${v >= 999 ? 'full' : `${v}px`}</code></li>`).join('');
const spaces = tokens.space.map((s) => `<li><code>${s}</code><i style="--s:${s}"></i></li>`).join('');

/* ---------- assemble ---------- */
const vars = {
  TOKENS_CSS: tokensCss(),
  STYLES: src('styles.css'),
  ICONS: src('icons.svg'),
  APP_JS: src('app.js'),
  SCREENS: src('screens.html'),
  DEFAULT_ACCENT: base,
  ACCENT_SWATCHES: accentButtons,
  ACCENT_INTRO: accentIntro,
  SYS_ACCENTS: accentCards,
  SYS_LIGHT: swatches('light', 'Light'),
  SYS_DARK: swatches('dark', 'Dark'),
  SYS_TYPE: typeSpecimens,
  SYS_RADIUS: radii,
  SYS_SPACE: spaces,
  STATUS_PHASE: esc(status.phase),
  STATUS_SUMMARY: inline(status.summary),
  STATUS_NEXT: status.next.map((n) => `<li><span>${inline(n)}</span></li>`).join(''),
  STATUS_OPEN: status.open.map((o) => `<div class="q"><b>${esc(o.q)}</b><span>${inline(o.a)}</span></div>`).join(''),
  UPDATES: (status.updates || []).map((u) => `<li><time datetime="${u.date}">${fmtDate(u.date)}</time><span>${inline(u.text)}</span></li>`).join(''),
  DECISIONS: decisions,
  BUILT_AT: fmtDate(new Date().toISOString().slice(0, 10)),
  ...Object.fromEntries(DOCS.flatMap((d) => [[`DOC_${d.view.toUpperCase()}`, docs[d.view].html], [`TOC_${d.view.toUpperCase()}`, docs[d.view].toc]])),
};

const used = new Set();
const out = src('page.html').replace(/\{\{([A-Z0-9_]+)\}\}/g, (m, key) => {
  if (!(key in vars)) throw new Error(`page.html uses ${m}, which build.mjs doesn't define`);
  used.add(key);
  return vars[key];
}) + '\n';
const unused = Object.keys(vars).filter((k) => !used.has(k));
if (unused.length) throw new Error(`build.mjs defines ${unused.join(', ')}, which page.html doesn't use`);

// Every image the page shows must exist; images nobody shows are reported.
const refs = new Set([...out.matchAll(/(?:src="|url\()((?:img|inspiration)\/[^")\s]+)/g)].map((m) => m[1]));
const missing = [...refs].filter((r) => !existsSync(join(HUB, r)));
if (missing.length) throw new Error(`Missing images: ${missing.join(', ')}`);
const unshown = ASSET_DIRS.flatMap((d) => readdirSync(join(HUB, d)).map((f) => `${d}/${f}`)).filter((f) => !refs.has(f));

writeFileSync(join(HUB, 'index.html'), out);
console.log(`Built design/hub/index.html: ${(out.length / 1024).toFixed(0)} KB, ${refs.size} images${unshown.length ? `; not shown anywhere: ${unshown.join(', ')}` : ''}`);
