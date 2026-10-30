// Static site generator: YAML data -> fully pre-rendered HTML in dist/.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { loadData } from './data.mjs';
import { makeOgRenderer } from './og.mjs';
import { loadPosts } from './blog.mjs';

const D = loadData();
if (D.errors.length) { console.error('Data errors:\n' + D.errors.join('\n')); process.exit(1); }
const { ROOT, config, providers, exams, services, categories, rowsById, examGuides } = D;
const OUT = path.join(ROOT, 'dist');
// Blog: published posts only (drafts and future-dated posts are never built). BUILD_DATE=YYYY-MM-DD overrides today (UTC).
const BUILD_DATE = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const BLOG = loadPosts(ROOT, { today: BUILD_DATE, knownRows: rowsById });
if (BLOG.errors.length) { console.error('Blog errors:\n' + BLOG.errors.join('\n')); process.exit(1); }
fs.rmSync(OUT, { recursive: true, force: true });
const renderOg = makeOgRenderer(ROOT);
const BASE = config.baseUrl.replace(/\/$/, '');
// Path prefix for GitHub project Pages (e.g. /cloudequivalents). Empty on a custom-domain root.
const PREFIX = (() => {
  try {
    const pathname = new URL(BASE + '/').pathname.replace(/\/$/, '');
    return pathname === '/' ? '' : pathname;
  } catch { return ''; }
})();
const rel = (p) => PREFIX + p;
const [PA, PB] = providers;
const pages = []; // for sitemap
// Newest real review date in the data; used for pages with no date of their own.
const DATA_DATE = [...categories.flatMap((c) => [c.last_verified, c.gcp_last_verified]), ...[...examGuides.values()].map((g) => g.last_verified)].filter(Boolean).map(String).sort().pop();
// Public "What changed" log (data/changes.yaml), newest first.
const CHANGES = (yaml.load(fs.readFileSync(path.join(ROOT, 'data/changes.yaml'), 'utf8')) || []).map((c) => ({ ...c, date: String(c.date), links: c.links || [] })).sort((a, b) => b.date.localeCompare(a.date));
// Optional newsletter signup (site.config.json "newsletter"). Empty provider or url => nothing is rendered.
// buttondown: { "provider": "buttondown", "url": "https://buttondown.com/api/emails/embed-subscribe/<username>" }
let NL_CACHE;
const NEWSLETTER = () => (NL_CACHE ??= newsletterHtml());
function newsletterHtml() {
  const n = config.newsletter || {};
  const prov = String(n.provider || '').trim().toLowerCase(); const url = String(n.url || '').trim();
  if (!prov) return '';
  if (!/^https:\/\/[^\s"<>]+$/.test(url)) { console.warn(`newsletter: provider "${prov}" set but url missing or not https; nothing rendered`); return ''; }
  return `<aside class="signup" aria-labelledby="signup-h"><h2 id="signup-h">Get the weekly post by email</h2><p class="small muted">What changed across AWS, Azure and Google Cloud, once a week. Unsubscribe any time.</p>
<form class="signup-form" action="${esc(url)}" method="post"><input type="hidden" name="embed" value="1"><label class="sr" for="signup-email">Email address</label><input id="signup-email" type="email" name="email" required autocomplete="email" placeholder="you@example.com"><button type="submit">Subscribe</button></form></aside>`;
}
const lastmods = new Map(); // url -> YYYY-MM-DD (blog pages); everything else uses the data date
const usedTitles = new Set();

// ---------- helpers ----------
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const abs = (p) => BASE + p;
const write = (p, html) => { const f = path.join(OUT, p.endsWith('/') ? p + 'index.html' : p); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); };
const fmtDate = (iso) => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const clip = (s, n) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…');
// First sentence (avoids splitting on "e.g." / "vs." / decimals).
function firstSentence(t) {
  const m = String(t).match(/^.*?[.!?](?=\s+[A-Z(“"]|$)/s);
  let s = m ? m[0] : t;
  if (/\b(e\.g|i\.e|vs|etc)\.$/.test(s)) s = t;
  return s.trim();
}
const rest = (t) => String(t).slice(firstSentence(t).length).trim();
const names = (list) => list.map((s) => s.name);
const joinNames = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);
const editUrl = (file) => `${config.repoUrl}/edit/${config.repoBranch}/${file}`;
const issueUrl = (title) => `${config.repoUrl}/issues/new?title=${encodeURIComponent(title)}`;

const STATUS = {
  ga: null, preview: ['Preview', 'preview'], maintenance: ['Maintenance', 'warn'], sunset: ['Sunset', 'danger'],
  deprecated: ['Deprecated', 'warn'], retired: ['Retired', 'danger'], retiring: ['Retiring', 'warn'], beta: ['Beta', 'preview'], current: null,
};
const statusBadge = (st, note) => { const s = STATUS[st]; return s ? ` <span class="badge b-${s[1]}"${note ? ` title="${esc(note)}"` : ''}>${s[0]}</span>` : ''; };
const MATCH = { direct: ['Direct match', 'Direct equivalent with comparable scope.'], partial: ['Partial match', 'Overlapping but different scope, maturity or packaging.'], none: ['No equivalent', 'No first-party equivalent; alternatives listed.'] };
const matchBadge = (m) => `<span class="match m-${m}" title="${esc(MATCH[m][1])}">${MATCH[m][0]}</span>`;
const examLabel = (code) => { const e = exams.get(code); return e.unverified_code ? e.name.replace(/^(AWS|Microsoft) Certified:? ?/, '') : e.code; };
const examChip = (code) => { const e = exams.get(code); return `<a class="chip exam" href="/exams/#${esc(code)}" title="${esc(e.name)}">${esc(examLabel(code))}${statusBadge(e.status)}</a>`; };
const groupName = (cat, gid) => cat.groups.find((g) => g.id === gid).name;
const catOf = (r) => categories.find((c) => c.id === r.category);
const GCP = providers.find((p) => p.id === 'gcp');
// Provider columns for a category/row: GCP only where that category has been GCP-verified.
const provsForCat = (cat) => providers.filter((p) => p.id !== 'gcp' || cat.gcp_last_verified);
const provsFor = (r) => provsForCat(catOf(r));
const gcpOn = (r) => GCP && r.gcp && catOf(r).gcp_last_verified;
const gcpCats = categories.filter((c) => GCP && c.gcp_last_verified);

function breadcrumbs(items) {
  const html = `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map((it, i) => i === items.length - 1
    ? `<li><span aria-current="page">${esc(it.name)}</span></li>` : `<li><a href="${it.url}">${esc(it.name)}</a></li>`).join('')}</ol></nav>`;
  const ld = { '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.url) })) };
  return { html, ld };
}

const HEADER = (active) => `<header class="top"><div class="wrap top-in">
  <a class="brand" href="${rel('/')}"><span class="logo" aria-hidden="true"><i></i><i></i></span>${esc(config.siteName)}</a>
  <nav class="nav" aria-label="Main"><a href="${rel('/')}"${active === 'home' ? ' aria-current="page"' : ''}>Matrix</a><a href="${rel('/category/')}"${active === 'cat' ? ' aria-current="page"' : ''}>Categories</a><a href="${rel('/aws/')}"${active === 'aws' ? ' aria-current="page"' : ''}>AWS</a><a href="${rel('/azure/')}"${active === 'azure' ? ' aria-current="page"' : ''}>Azure</a>${GCP ? `<a href="${rel('/gcp/')}"${active === 'gcp' ? ' aria-current="page"' : ''}>GCP</a>` : ''}<a href="${rel('/exams/')}"${active === 'exams' ? ' aria-current="page"' : ''}>Exams</a><a href="${rel('/blog/')}"${active === 'blog' ? ' aria-current="page"' : ''}>Blog</a><a href="${rel('/about/')}"${active === 'about' ? ' aria-current="page"' : ''}>About</a></nav>
  <form class="search" action="${rel('/')}" method="get" role="search"><label class="sr" for="q">Search services</label><input id="q" name="q" type="search" placeholder="Search services…" autocomplete="off"><kbd aria-hidden="true">⌘K</kbd></form>
</div></header>`;

const FOOTER = `<footer class="foot"><div class="wrap">
  <p>${esc(config.siteName)} is an open-source, community-maintained study guide. It is not affiliated with Amazon Web Services, Microsoft, or Google. Service names are trademarks of their owners. Always confirm details in the linked official documentation.</p>
  <p><a href="${config.repoUrl}">Source on GitHub</a> · <a href="${rel('/about/')}">Methodology</a> · <a href="${rel('/blog/')}">Blog</a> · <a href="${rel('/blog/feed.xml')}">Blog feed</a> · <a href="${rel('/changes/')}">What changed</a> · <a href="${rel('/data/')}">Open data (JSON/CSV)</a> · <a href="${rel('/sitemap.xml')}">Sitemap</a> · MIT License</p>
</div></footer>`;

// Optional cookieless analytics (site.config.json "analytics"). Empty provider => nothing is emitted.
// cloudflare: { "provider": "cloudflare", "token": "<Web Analytics beacon token>" }
// goatcounter: { "provider": "goatcounter", "code": "<your GoatCounter site code>" }
const ANALYTICS = (() => {
  const a = config.analytics || {};
  const prov = String(a.provider || '').trim().toLowerCase();
  if (prov === 'cloudflare' && /^[A-Za-z0-9]+$/.test(String(a.token || '').trim())) {
    return `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: String(a.token).trim() })}'></script>`;
  }
  if (prov === 'goatcounter' && /^[a-z0-9-]+$/i.test(String(a.code || '').trim())) {
    return `<script data-goatcounter="https://${String(a.code).trim()}.goatcounter.com/count" defer src="https://gc.zgo.at/count.js"></script>`;
  }
  if (prov) console.warn(`analytics: provider "${prov}" set but token/code missing or invalid; nothing emitted`);
  return '';
})();

// Cmd+K / "/" focuses the header search (content pages ship only this tiny script).
const KEY_JS = `<script>addEventListener('keydown',function(e){if((e.key==='k'&&(e.metaKey||e.ctrlKey))||(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))){e.preventDefault();var q=document.getElementById('q');q.focus();q.select()}})</script>`;

function page({ url, title, description, h1, body, ld = [], ogImage, ogType = 'article', active, scripts = '', extraHead = '', lastmod, noindex = false }) {
  if (!noindex) pages.push(url);
  if (!lastmod) lastmod = ld.map((x) => x && x.dateModified).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '')).sort().pop();
  if (lastmod) lastmods.set(url, lastmod);
  // Prefix root-relative hrefs inside body (HEADER/FOOTER/assets already use rel()).
  body = body.replace(/(href|src)="(\/(?!\/)[^"]*)"/g, (_, a, path) => path.startsWith(PREFIX + '/') || path === PREFIX ? `${a}="${path}"` : `${a}="${PREFIX}${path}"`);
  const jsonld = ld.length ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@graph': ld }).replace(/</g, '\\u003c')}</script>` : '';
  const img = abs(ogImage || '/og/default.png');
  const BOOT = `<script>(function(){document.documentElement.classList.add('js');try{var s=JSON.parse(localStorage.getItem('cc-groups')||'{}');var c=Object.keys(s).filter(function(k){return s[k]===false});if(c.length)document.documentElement.setAttribute('data-cc-closed',c.join(' '))}catch(e){}})()</script>`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${BOOT}
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(url)}">
<meta name="theme-color" content="#0b1220">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(config.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(url)}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(h1)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${img}">
<link rel="alternate" type="application/atom+xml" title="${esc(config.siteName)} blog" href="${abs('/blog/feed.xml')}">
<link rel="icon" href="${rel('/favicon.svg')}" type="image/svg+xml">${noindex ? '\n<meta name="robots" content="noindex">' : ''}
<link rel="stylesheet" href="${rel('/assets/site.css')}">
${extraHead}${jsonld}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
${HEADER(active)}
<main id="main" class="wrap">
${body}
</main>
${FOOTER}
<script>window.__PREFIX__=${JSON.stringify(PREFIX)}</script>
${KEY_JS}<script src="${rel('/assets/site.js')}" defer></script>${scripts}${ANALYTICS}
</body>
</html>`;
  return html;
}

const sourcesList = (urls) => `<ul class="sources">${urls.map((u) => `<li><a href="${esc(u)}" rel="noopener">${esc(host(u))}<span class="path">${esc(new URL(u).pathname.replace(/\/$/, '').slice(0, 90))}</span></a></li>`).join('')}</ul>`;

// ---------- compare pages ----------
const guideLink = (code) => examGuides.get(code);
// Row id -> exam guides whose domains list that row.
const guidesByRow = new Map();
for (const g of examGuides.values()) for (const d of g.domains) for (const id of d.rows || []) { const l = guidesByRow.get(id) || []; if (!l.includes(g)) l.push(g); guidesByRow.set(id, l); }
function examsFor(r) { return providers.flatMap((p) => (r.exams?.[p.id] || [])); }

function derivedFaq(r) {
  const a = names(r.svc[PA.id]), b = names(r.svc[PB.id]);
  const out = [];
  out.push({ q: r.match === 'none' ? `Does ${PB.name} have an equivalent to ${joinNames(a)}?` : `What is the ${PB.name} equivalent of ${joinNames(a)}?`, a: r.answer });
  out.push({ q: `How does pricing compare between ${joinNames(a) || PA.name} and ${joinNames(b) || PB.name}?`, a: providers.map((p) => `${p.name}: ${r.pricing?.[p.id] || 'No direct pricing equivalent.'}`).join(' ') + ' Check the official pricing pages for current rates.' });
  const ex = examsFor(r);
  if (ex.length) out.push({ q: 'Which certification exams cover this topic?', a: ex.map((c) => { const e = exams.get(c); return `${e.name}${e.unverified_code ? '' : ` (${e.code})`}${e.status !== 'current' ? ` [${e.status}]` : ''}`; }).join('; ') + '.' });
  return out;
}

function svcCell(list, pid) {
  if (!list.length) return `<td class="none-cell">No first-party equivalent</td>`;
  return `<td>${list.map((s) => `<a href="${s.url}">${esc(s.name)}</a>${statusBadge(s.status, s.status_note)}`).join('<br>')}</td>`;
}

function comparePage(r) {
  const cat = catOf(r);
  const A = r.svc[PA.id], B = r.svc[PB.id];
  const aN = joinNames(names(A)) || `${PA.name} (none)`, bN = joinNames(names(B)) || `No ${PB.name} equivalent`;
  const h1 = B.length ? `${names(A).join(' / ')} vs ${names(B).join(' / ')}` : `${names(A).join(' / ')}: ${PB.name} equivalent`;
  const titleCore = B.length ? `${A[0].name} vs ${B[0].name}` : `${A[0].name} ${PB.name} equivalent`;
  const short = (s) => s.name.replace(/\s*\(.*?\)/g, '').replace(/\s*&.*$/, '').trim();
  const core = B.length ? `${short(A[0])} vs ${short(B[0])}` : `${short(A[0])}: ${PB.name} equivalent`;
  const cands = [`${core}: ${r.capability}`, `${r.capability}: ${core}`, `${r.capability}: ${PA.name} vs ${PB.name}`, core].filter((c) => !usedTitles.has(c));
  const title = cands.find((c) => c.length <= 65) || cands.sort((x, y) => x.length - y.length)[0];
  usedTitles.add(title);
  const lead = firstSentence(r.answer);
  const description = clip(`${lead} ${r.what_for}`, 158);
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: cat.name, url: `/category/${cat.id}/` }, { name: r.capability, url: r.url }]);
  const faq = [...derivedFaq(r), ...(r.faq || [])];
  const ex = examsFor(r);
  const related = (r.related || []).map((id) => rowsById.get(id));
  const RP = provsFor(r);
  const svcRows = (label, fn) => `<tr><th scope="row">${label}</th>${RP.map((p) => fn(r.svc[p.id], p).replace(/^<td/, `<td data-label="${esc(p.name)}"`)).join('')}</tr>`;
  const table = `<div class="tscroll"><table class="cmp${RP.length > 2 ? ' cmp3' : ''}">
<caption>${esc(r.capability)}: ${RP.map((p) => p.name).join(' vs ')} side by side</caption>
<thead><tr><th scope="col">Aspect</th>${RP.map((p) => `<th scope="col" class="p-${p.id}">${esc(p.long_name)}</th>`).join('')}</tr></thead>
<tbody>
${svcRows('Service', (l, p) => svcCell(l, p.id))}
${gcpOn(r) ? `<tr><th scope="row">Match vs AWS</th><td data-label="AWS">—</td><td data-label="Azure">${matchBadge(r.match)}</td><td data-label="GCP">${matchBadge(r.gcp.match)}</td></tr>` : ''}
${svcRows('Lifecycle', (l) => `<td>${l.length ? l.map((s) => esc(s.status_note || (s.status === 'ga' ? 'Generally available' : s.status))).join('<br>') : '—'}</td>`)}
${svcRows('What it is', (l) => `<td>${l.length ? l.map((s) => esc(s.summary)).join('<hr>') : '—'}</td>`)}
${svcRows('Pricing model', (l, p) => `<td>${esc(r.pricing?.[p.id] || '—')}</td>`)}
${svcRows('Docs', (l) => `<td>${l.map((s) => s.docs ? `<a href="${esc(s.docs)}" rel="noopener">${esc(s.name)} docs</a>` : '').filter(Boolean).join('<br>') || '—'}</td>`)}
${svcRows('Pricing page', (l) => `<td>${l.map((s) => s.pricing ? `<a href="${esc(s.pricing)}" rel="noopener">${esc(s.name)} pricing</a>` : '').filter(Boolean).join('<br>') || '—'}</td>`)}
${svcRows('Exams', (l, p) => `<td>${(r.exams?.[p.id] || []).map(examChip).join(' ') || '—'}</td>`)}
</tbody></table></div>`;

  const body = `${bc.html}
<article class="doc">
<header class="doc-head">
<p class="kicker">${esc(groupName(cat, r.group))}</p>
<h1>${esc(h1)}</h1>
<p class="answer"><strong>${esc(lead)}</strong></p>
${rest(r.answer) ? `<p class="lede">${esc(rest(r.answer))}</p>` : ''}
<p class="meta">${matchBadge(r.match)} <span>Use it to: ${esc(r.what_for)}</span></p>
<p class="meta small">Last verified: <time datetime="${cat.last_verified}">${fmtDate(cat.last_verified)}</time> · <a href="${editUrl(cat.file)}" rel="noopener">Edit on GitHub</a> · <a href="${issueUrl('Correction: ' + r.id)}" rel="noopener">Report an error</a></p>
</header>
<section aria-labelledby="t-table"><h2 id="t-table">Side-by-side comparison</h2>${table}</section>
<section aria-labelledby="t-diff"><h2 id="t-diff">Key differences</h2><ul class="diffs">${r.differences.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></section>
${gcpOn(r) ? `<section aria-labelledby="t-gcp"><h2 id="t-gcp">Google Cloud equivalent</h2>
<p>${matchBadge(r.gcp.match)} <strong>${esc(firstSentence(r.gcp.answer))}</strong> ${esc(rest(r.gcp.answer))}</p>
<ul class="diffs">${r.gcp.differences.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
<p><a href="${r.gcpUrl}">${esc(PA.name)} vs Google Cloud: full comparison →</a> <span class="small muted">GCP mapping last verified <time datetime="${catOf(r).gcp_last_verified}">${fmtDate(catOf(r).gcp_last_verified)}</time></span></p></section>` : ''}
<section aria-labelledby="t-price"><h2 id="t-price">Pricing summary</h2>
<p class="small muted">Pricing models only. No prices are quoted because they change by region and over time.</p>
<dl class="pricing">${RP.map((p) => `<div><dt class="p-${p.id}">${esc(p.name)}</dt><dd>${esc(r.pricing?.[p.id] || 'No direct equivalent.')}${r.svc[p.id].filter((s) => s.pricing).map((s) => ` <a href="${esc(s.pricing)}" rel="noopener">${esc(s.name)} pricing →</a>`).join('')}</dd></div>`).join('')}</dl></section>
${ex.length ? `<section aria-labelledby="t-exam"><h2 id="t-exam">Certification exam mapping</h2>
<div class="tscroll"><table class="exams"><thead><tr><th scope="col">Exam</th><th scope="col">Provider</th><th scope="col">Level</th><th scope="col">Status</th></tr></thead><tbody>
${ex.map((c) => { const e = exams.get(c); return `<tr><td><a href="${esc(e.url)}" rel="noopener">${esc(e.name)}</a>${e.unverified_code ? '' : ` <span class="code">${esc(e.code)}</span>`}${guideLink(c) ? `<div class="small"><a href="${guideLink(c).url}">${esc(c)} guide for AWS engineers →</a></div>` : ''}</td><td>${esc(providers.find((p) => p.id === e.provider)?.name || e.provider)}</td><td>${esc(e.level)}</td><td>${esc(e.status)}${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}</td></tr>`; }).join('')}
</tbody></table></div><p class="small muted">Relevance is based on each exam's published scope, not a line-by-line objective match. Check the official study guide.</p></section>` : ''}
${guidesByRow.get(r.id) ? `<section aria-labelledby="t-guides"><h2 id="t-guides">Azure exam guides for AWS engineers</h2><p>This comparison is on the study list for: ${guidesByRow.get(r.id).map((g) => `<a href="${g.url}">${esc(g.code)} for AWS engineers</a>`).join(', ')}.</p></section>` : ''}
${r.flags?.length ? `<section aria-labelledby="t-flag" class="flags"><h2 id="t-flag">Verification notes</h2><ul>${r.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="t-faq"><h2 id="t-faq">FAQ</h2>${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</section>
${related.length ? `<section aria-labelledby="t-rel"><h2 id="t-rel">Related comparisons</h2><ul class="related">${related.map((x) => `<li><a href="${x.url}">${esc(x.capability)}</a> <span class="muted small">${esc(joinNames(names(x.svc[PA.id])))} → ${esc(joinNames(names(x.svc[PB.id])) || 'none')}</span></li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="t-src"><h2 id="t-src">Official sources</h2>${sourcesList(gcpOn(r) ? [...r.sources, ...r.gcp.sources.filter((u) => !r.sources.includes(u))] : r.sources)}</section>
</article>`;
  const og = `/og/compare/${r.slug}.png`;
  renderOg({ kicker: `${PA.name} vs ${PB.name} · ${r.capability}`, title: B.length ? `${A[0].name} vs ${B[0].name}` : `${A[0].name} → ${PB.name}?`, subtitle: lead, badge: MATCH[r.match][0], siteName: config.siteName }, path.join(OUT, og));
  const ld = [bc.ld,
    { '@type': 'TechArticle', headline: h1, description, url: abs(r.url), dateModified: cat.last_verified, inLanguage: 'en', image: abs(og),
      about: [...A, ...B].map((s) => ({ '@type': 'Thing', name: s.name, sameAs: s.docs })), isPartOf: { '@type': 'WebSite', name: config.siteName, url: BASE + '/' }, citation: r.sources },
    { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }];
  write(r.url, page({ url: r.url, title, description, h1, body, ld, ogImage: og, active: 'cat' }));
}

// ---------- AWS vs Google Cloud compare pages (rows in GCP-verified categories) ----------
function gcpComparePage(r) {
  const cat = catOf(r);
  const g = r.gcp, A = r.svc[PA.id], G = r.svc.gcp, Z = r.svc[PB.id];
  const short = (x) => x.name.replace(/\s*\(.*?\)/g, '').replace(/\s*&.*$/, '').trim();
  const h1 = G.length ? `${names(A).join(' / ')} vs ${names(G).join(' / ')}` : `${names(A).join(' / ')}: Google Cloud equivalent`;
  const core = G.length ? `${short(A[0])} vs ${short(G[0])}` : `${short(A[0])}: Google Cloud equivalent`;
  const cands = [`${core}: ${r.capability}`, `${core} (AWS vs GCP)`, `${r.capability}: AWS vs Google Cloud`, `${core} · ${r.capability} on GCP`].filter((c) => !usedTitles.has(c));
  const title = cands.find((c) => c.length <= 65) || cands.sort((x, y) => x.length - y.length)[0];
  usedTitles.add(title);
  const lead = firstSentence(g.answer);
  const description = clip(`${lead} ${r.what_for}`.replace(/\s+/g, ' '), 158);
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: cat.name, url: `/category/${cat.id}/` }, { name: `${r.capability} (AWS vs GCP)`, url: r.gcpUrl }]);
  const PP = [PA, GCP];
  const svcRows = (label, fn) => `<tr><th scope="row">${label}</th>${PP.map((p) => fn(r.svc[p.id], p)).join('')}</tr>`;
  const table = `<div class="tscroll"><table class="cmp">
<caption>${esc(r.capability)}: AWS vs Google Cloud side by side</caption>
<thead><tr><th scope="col">Aspect</th>${PP.map((p) => `<th scope="col" class="p-${p.id}">${esc(p.long_name)}</th>`).join('')}</tr></thead>
<tbody>
${svcRows('Service', (l, p) => svcCell(l, p.id))}
${svcRows('Lifecycle', (l) => `<td>${l.length ? l.map((x) => esc(x.status_note || (x.status === 'ga' ? 'Generally available' : x.status))).join('<br>') : '—'}</td>`)}
${svcRows('What it is', (l) => `<td>${l.length ? l.map((x) => esc(x.summary)).join('<hr>') : '—'}</td>`)}
${svcRows('Pricing model', (l, p) => `<td>${esc(r.pricing?.[p.id] || '—')}</td>`)}
${svcRows('Docs', (l) => `<td>${l.map((x) => x.docs ? `<a href="${esc(x.docs)}" rel="noopener">${esc(x.name)} docs</a>` : '').filter(Boolean).join('<br>') || '—'}</td>`)}
${svcRows('Pricing page', (l) => `<td>${l.map((x) => x.pricing ? `<a href="${esc(x.pricing)}" rel="noopener">${esc(x.name)} pricing</a>` : '').filter(Boolean).join('<br>') || '—'}</td>`)}
</tbody></table></div>`;
  const faq = [
    { q: g.match === 'none' ? `Does Google Cloud have an equivalent to ${joinNames(names(A))}?` : `What is the Google Cloud equivalent of ${joinNames(names(A))}?`, a: g.answer },
    { q: `How does pricing compare between ${joinNames(names(A))} and ${joinNames(names(G)) || 'Google Cloud'}?`, a: `AWS: ${r.pricing?.[PA.id] || '—'} Google Cloud: ${g.pricing} Check the official pricing pages for current rates.` },
    { q: `What is the Azure equivalent?`, a: Z.length ? `${joinNames(names(Z))} (${MATCH[r.match][0].toLowerCase()}). ${firstSentence(r.answer)}` : `Azure has no first-party equivalent. ${firstSentence(r.answer)}` },
  ];
  const related = (r.related || []).map((id) => rowsById.get(id)).filter((x) => x.gcpUrl);
  const body = `${bc.html}
<article class="doc">
<header class="doc-head">
<p class="kicker">${esc(groupName(cat, r.group))} · AWS vs Google Cloud</p>
<h1>${esc(h1)}</h1>
<p class="answer"><strong>${esc(lead)}</strong></p>
${rest(g.answer) ? `<p class="lede">${esc(rest(g.answer))}</p>` : ''}
<p class="meta">${matchBadge(g.match)} <span>Use it to: ${esc(r.what_for)}</span></p>
<p class="meta small">Last verified: <time datetime="${cat.gcp_last_verified}">${fmtDate(cat.gcp_last_verified)}</time> · <a href="${editUrl(cat.file)}" rel="noopener">Edit on GitHub</a> · <a href="${issueUrl('Correction (GCP): ' + r.id)}" rel="noopener">Report an error</a></p>
</header>
<section aria-labelledby="t-table"><h2 id="t-table">Side-by-side comparison</h2>${table}</section>
<section aria-labelledby="t-diff"><h2 id="t-diff">Key differences</h2><ul class="diffs">${g.differences.map((d) => `<li>${esc(d)}</li>`).join('')}</ul></section>
<section aria-labelledby="t-price"><h2 id="t-price">Pricing summary</h2>
<p class="small muted">Pricing models only. No prices are quoted because they change by region and over time.</p>
<dl class="pricing">${PP.map((p) => `<div><dt class="p-${p.id}">${esc(p.name)}</dt><dd>${esc(r.pricing?.[p.id] || 'No direct equivalent.')}${r.svc[p.id].filter((x) => x.pricing).map((x) => ` <a href="${esc(x.pricing)}" rel="noopener">${esc(x.name)} pricing →</a>`).join('')}</dd></div>`).join('')}</dl></section>
<section aria-labelledby="t-az"><h2 id="t-az">And on Azure?</h2><p>${matchBadge(r.match)} ${Z.length ? `Azure's equivalent is ${Z.map((x) => `<a href="${x.url}">${esc(x.name)}</a>`).join(', ')}.` : 'Azure has no first-party equivalent.'} <a href="${r.url}">AWS vs Azure comparison →</a></p></section>
${g.flags?.length ? `<section aria-labelledby="t-flag" class="flags"><h2 id="t-flag">Verification notes</h2><ul>${g.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="t-faq"><h2 id="t-faq">FAQ</h2>${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</section>
${related.length ? `<section aria-labelledby="t-rel"><h2 id="t-rel">Related AWS vs GCP comparisons</h2><ul class="related">${related.map((x) => `<li><a href="${x.gcpUrl}">${esc(x.capability)}</a> <span class="muted small">${esc(joinNames(names(x.svc[PA.id])))} → ${esc(joinNames(names(x.svc.gcp)) || 'none')}</span></li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="t-src"><h2 id="t-src">Official sources</h2>${sourcesList(g.sources)}</section>
</article>`;
  const og = `/og/compare/${r.gcpSlug}.png`;
  renderOg({ kicker: `AWS vs Google Cloud · ${r.capability}`, title: G.length ? `${A[0].name} vs ${G[0].name}` : `${A[0].name} → Google Cloud?`, subtitle: lead, badge: MATCH[g.match][0], siteName: config.siteName }, path.join(OUT, og));
  const ld = [bc.ld,
    { '@type': 'TechArticle', headline: h1, description, url: abs(r.gcpUrl), dateModified: cat.gcp_last_verified, inLanguage: 'en', image: abs(og),
      about: [...A, ...G].map((x) => ({ '@type': 'Thing', name: x.name, sameAs: x.docs })), isPartOf: { '@type': 'WebSite', name: config.siteName, url: BASE + '/' }, citation: g.sources },
    { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }];
  write(r.gcpUrl, page({ url: r.gcpUrl, title, description, h1, body, ld, ogImage: og, active: 'cat' }));
}

// ---------- service hub pages ----------
function gcpHubPage(s) {
  const p = GCP;
  const rows = s.rows.filter(gcpOn);
  const cat = catOf(rows[0]);
  const aws = [...new Map(rows.flatMap((r) => r.svc[PA.id]).map((x) => [x.slug, x])).values()];
  const az = [...new Map(rows.flatMap((r) => r.svc[PB.id]).map((x) => [x.slug, x])).values()];
  const h1 = `AWS and Azure equivalents of ${s.name}`;
  const directLead = `The closest AWS equivalent${aws.length > 1 ? 's' : ''} of Google Cloud ${s.name} ${aws.length > 1 ? 'are' : 'is'} ${joinNames(names(aws))}; on Azure, ${az.length ? joinNames(names(az)) : 'there is no first-party equivalent'}.`;
  const title = clip(`AWS & Azure equivalent of ${s.name} (GCP) | ${config.siteName}`, 70);
  const description = clip(`AWS equivalent of Google Cloud ${s.name}: ${joinNames(names(aws))}. Azure: ${az.length ? joinNames(names(az)) : 'none'}. ${s.summary}`, 158);
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: p.name, url: `/${p.id}/` }, { name: s.name, url: s.url }]);
  const svcs = (l) => l.length ? l.map((x) => `<a href="${x.url}">${esc(x.name)}</a>${statusBadge(x.status, x.status_note)}`).join(', ') : '<span class="muted">None</span>';
  const body = `${bc.html}
<article class="doc">
<header class="doc-head">
<p class="kicker">${esc(p.long_name)} → AWS and Azure</p>
<h1>${esc(h1)}</h1>
<p class="answer"><strong>${esc(directLead)}</strong></p>
<p class="meta small">Last verified: <time datetime="${cat.gcp_last_verified}">${fmtDate(cat.gcp_last_verified)}</time> · <a href="${editUrl(s.file)}" rel="noopener">Edit on GitHub</a></p>
</header>
<section aria-labelledby="t-about"><h2 id="t-about">About ${esc(s.name)}</h2>
<table class="facts"><tbody>
<tr><th scope="row">Provider</th><td>${esc(p.long_name)}</td></tr>
<tr><th scope="row">Status</th><td>${s.status === 'ga' ? 'Generally available' : esc(s.status)}${statusBadge(s.status)}${s.status_note ? `<div class="small">${esc(s.status_note)}</div>` : ''}</td></tr>
<tr><th scope="row">What it is</th><td>${esc(s.summary)}</td></tr>
<tr><th scope="row">Documentation</th><td>${s.docs ? `<a href="${esc(s.docs)}" rel="noopener">${esc(host(s.docs))}</a>` : '—'}</td></tr>
<tr><th scope="row">Pricing</th><td>${s.pricing ? `<a href="${esc(s.pricing)}" rel="noopener">Official pricing page</a>` : 'No separate pricing page'}</td></tr>
</tbody></table></section>
<section aria-labelledby="t-map"><h2 id="t-map">Mappings (${rows.length})</h2>
<div class="tscroll"><table class="cmp"><thead><tr><th scope="col">Capability</th><th scope="col">AWS</th><th scope="col">Match (GCP vs AWS)</th><th scope="col">Azure</th></tr></thead><tbody>
${rows.map((r) => `<tr><td><a href="${r.gcpUrl}">${esc(r.capability)}</a></td><td>${svcs(r.svc[PA.id])}</td><td>${matchBadge(r.gcp.match)}</td><td>${svcs(r.svc[PB.id])}</td></tr>`).join('')}
</tbody></table></div>
${rows.map((r) => `<div class="cat-row"><h3><a href="${r.gcpUrl}">${esc(r.capability)}</a> ${matchBadge(r.gcp.match)}</h3><p>${esc(r.gcp.answer)}</p><ul class="diffs">${r.gcp.differences.slice(0, 3).map((d) => `<li>${esc(d)}</li>`).join('')}</ul><p><a href="${r.gcpUrl}">AWS vs GCP comparison →</a> · <a href="${r.url}">AWS vs Azure →</a></p></div>`).join('')}
</section>
</article>`;
  const og = `/og/${p.id}/${s.seg}.png`;
  renderOg({ kicker: 'Google Cloud → AWS & Azure', title: `AWS equivalent of ${s.name}`, subtitle: directLead, badge: `${rows.length} mapping${rows.length > 1 ? 's' : ''}`, siteName: config.siteName }, path.join(OUT, og));
  const ld = [bc.ld, { '@type': 'TechArticle', headline: h1, description, url: abs(s.url), dateModified: cat.gcp_last_verified, image: abs(og), about: { '@type': 'Thing', name: s.name, sameAs: s.docs } }];
  write(s.url, page({ url: s.url, title, description, h1, body, ld, ogImage: og, active: p.id }));
}

function hubPage(p, s) {
  if (p.id === 'gcp') return gcpHubPage(s);
  const other = providers.filter((x) => x.id !== p.id);
  const o = other[0];
  const cat = catOf(s.rows[0]);
  const primary = s.rows.filter((r) => r.svc[p.id][0]?.slug === s.slug);
  const lead = (primary[0] || s.rows[0]);
  const equivalents = [...new Map(s.rows.flatMap((r) => r.svc[o.id]).map((x) => [x.slug, x])).values()];
  const h1 = `${o.name} equivalent of ${s.name}`;
  const direct = p.id === PA.id ? lead.answer : (equivalents.length
    ? `The closest ${o.name} equivalent${equivalents.length > 1 ? 's' : ''} of ${s.name} ${equivalents.length > 1 ? 'are' : 'is'} ${joinNames(names(equivalents))}.`
    : `${o.name} has no first-party equivalent of ${s.name}.`);
  const directLead = firstSentence(direct);
  const title = clip(`${o.name} equivalent of ${s.name} | ${config.siteName}`, 70);
  const description = clip(`${o.name} equivalent of ${s.name}: ${equivalents.length ? joinNames(names(equivalents)) : 'none (alternatives listed)'}. ${s.summary}`, 158);
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: p.name, url: `/${p.id}/` }, { name: s.name, url: s.url }]);
  const body = `${bc.html}
<article class="doc">
<header class="doc-head">
<p class="kicker">${esc(p.long_name)} → ${esc(o.long_name)}</p>
<h1>${esc(h1)}</h1>
<p class="answer"><strong>${esc(directLead)}</strong></p>
<p class="meta small">Last verified: <time datetime="${cat.last_verified}">${fmtDate(cat.last_verified)}</time> · <a href="${editUrl(s.file)}" rel="noopener">Edit on GitHub</a></p>
</header>
<section aria-labelledby="t-about"><h2 id="t-about">About ${esc(s.name)}</h2>
<table class="facts"><tbody>
<tr><th scope="row">Provider</th><td>${esc(p.long_name)}</td></tr>
<tr><th scope="row">Status</th><td>${s.status === 'ga' ? 'Generally available' : esc(s.status)}${statusBadge(s.status)}${s.status_note ? `<div class="small">${esc(s.status_note)}</div>` : ''}</td></tr>
<tr><th scope="row">What it is</th><td>${esc(s.summary)}</td></tr>
<tr><th scope="row">Documentation</th><td>${s.docs ? `<a href="${esc(s.docs)}" rel="noopener">${esc(host(s.docs))}</a>` : '—'}</td></tr>
<tr><th scope="row">Pricing</th><td>${s.pricing ? `<a href="${esc(s.pricing)}" rel="noopener">Official pricing page</a>` : 'No separate pricing page'}</td></tr>
</tbody></table></section>
<section aria-labelledby="t-map"><h2 id="t-map">${esc(o.name)} mappings (${s.rows.length})</h2>
${(() => { const withG = GCP && s.rows.some(gcpOn); const svcs = (l) => l.length ? l.map((x) => `<a href="${x.url}">${esc(x.name)}</a>${statusBadge(x.status, x.status_note)}`).join(', ') : '<span class="muted">None</span>';
  return `<div class="tscroll"><table class="cmp"><thead><tr><th scope="col">Capability</th><th scope="col">${esc(o.name)} equivalent</th><th scope="col">Match</th>${withG ? '<th scope="col">Google Cloud</th>' : ''}</tr></thead><tbody>
${s.rows.map((r) => `<tr><td><a href="${r.url}">${esc(r.capability)}</a></td><td>${svcs(r.svc[o.id])}</td><td>${matchBadge(r.match)}</td>${withG ? `<td>${gcpOn(r) ? `${svcs(r.svc.gcp)} ${matchBadge(r.gcp.match)}${p.id === PA.id ? ` <a class="small" href="${r.gcpUrl}">AWS vs GCP →</a>` : ''}` : '<span class="muted small">Not mapped yet</span>'}</td>` : ''}</tr>`).join('')}
</tbody></table></div>`; })()}
${(() => {
  const byG = new Map();
  for (const r of s.rows) { if (!byG.has(r.group)) byG.set(r.group, []); byG.get(r.group).push(r); }
  return [...byG.entries()].map(([gid, rows]) => {
    const gname = groupName(catOf(rows[0]), gid);
    return `<details class="cat-group" id="hub-${esc(gid)}" data-group="${esc(gid)}" open>
<summary class="cat-sum"><span class="chev" aria-hidden="true"></span><span class="cat-sum-label">${esc(gname)}</span><span class="count">(${rows.length})</span></summary>
<div class="cat-body">${rows.map((r) => `<div class="cat-row"><h3><a href="${r.url}">${esc(r.capability)}</a> ${matchBadge(r.match)}</h3><p>${esc(r.answer)}</p><ul class="diffs">${r.differences.slice(0, 3).map((d) => `<li>${esc(d)}</li>`).join('')}</ul><p><a href="${r.url}">Full comparison →</a></p></div>`).join('')}</div>
</details>`;
  }).join('');
})()}
</section>
</article>`;
  const og = `/og/${p.id}/${s.seg}.png`;
  renderOg({ kicker: `${p.name} → ${o.name}`, title: `${o.name} equivalent of ${s.name}`, subtitle: directLead, badge: `${s.rows.length} mapping${s.rows.length > 1 ? 's' : ''}`, siteName: config.siteName }, path.join(OUT, og));
  const ld = [bc.ld, { '@type': 'TechArticle', headline: h1, description, url: abs(s.url), dateModified: cat.last_verified, image: abs(og), about: { '@type': 'Thing', name: s.name, sameAs: s.docs } }];
  write(s.url, page({ url: s.url, title, description, h1, body, ld, ogImage: og, active: p.id }));
}

function providerIndex(p) {
  const list = [...services[p.id].values()].sort((a, b) => a.name.localeCompare(b.name));
  const o = providers.find((x) => x.id !== p.id);
  const cats = p.id === 'gcp' ? gcpCats : categories;
  const url = `/${p.id}/`;
  const h1 = `${p.long_name} services and their ${o.name} equivalents`;
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: p.name, url }]);
  const homeCat = (s) => catOf(s.rows[0]).id;
  const body = `${bc.html}<article class="doc wide"><header class="doc-head"><h1>${esc(h1)}</h1><p class="answer"><strong>${list.length} ${esc(p.name)} services mapped to ${esc(o.name)} across ${cats.length} ${cats.length === 1 ? 'category' : 'categories'}, including retired and maintenance-mode services.</strong></p>${p.id === 'gcp' ? `<p class="small muted">${gcpCats.length === categories.length ? `Google Cloud mappings cover all ${gcpCats.length} categories.` : `Google Cloud mappings are being added category by category. Verified so far: ${gcpCats.map((c) => esc(c.name)).join(', ')}.`}</p>` : ''}</header>
<div class="group-controls js-only" role="group" aria-label="Section controls"><button type="button" class="btn-text" data-expand-all>Expand all</button><button type="button" class="btn-text" data-collapse-all>Collapse all</button></div>
${cats.map((cat) => { const items = list.filter((s) => homeCat(s) === cat.id); if (!items.length) return ''; return `<details class="cat-group" id="svc-${cat.id}" data-group="pidx-${cat.id}" open>
<summary class="cat-sum"><span class="chev" aria-hidden="true"></span><span class="cat-sum-label">${esc(cat.name)}</span><span class="count">(${items.length})</span></summary>
<div class="cat-body"><div class="tscroll"><table class="cmp"><thead><tr><th scope="col">${esc(p.name)} service</th><th scope="col">What it is</th><th scope="col">${esc(o.name)} equivalent(s)</th></tr></thead><tbody>
${items.map((s) => { const eq = [...new Map(s.rows.flatMap((r) => r.svc[o.id]).map((x) => [x.slug, x])).values()]; return `<tr><td><a href="${s.url}">${esc(s.name)}</a>${statusBadge(s.status, s.status_note)}</td><td class="small">${esc(clip(s.summary, 160))}</td><td>${eq.length ? eq.map((x) => esc(x.name)).join(', ') : '<span class="muted">None</span>'}</td></tr>`; }).join('')}
</tbody></table></div></div></details>`; }).join('')}
</article>`;
  const og = `/og/${p.id}/index.png`;
  renderOg({ kicker: `${p.name} → ${o.name}`, title: `${p.name} services, mapped to ${o.name}`, subtitle: `${list.length} services with status, docs and equivalents.`, siteName: config.siteName }, path.join(OUT, og));
  write(url, page({ url, title: `${p.name} services → ${o.name} equivalents | ${config.siteName}`, description: clip(`All ${list.length} ${p.long_name} services we map, grouped by category (${cats.map((c) => c.short || c.name).join(', ')}), with lifecycle status and ${o.long_name} equivalents.`, 158), h1, body, ld: [bc.ld, { '@type': 'CollectionPage', name: h1, url: abs(url), dateModified: DATA_DATE, inLanguage: 'en' }], ogImage: og, ogType: 'website', active: p.id }));
}

// ---------- category page ----------
function categoryPage(cat) {
  const url = `/category/${cat.id}/`;
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: cat.name, url }]);
  const counts = { direct: 0, partial: 0, none: 0 }; cat.rows.forEach((r) => counts[r.match]++);
  const h1 = `${cat.name}: ${PA.name} to ${PB.name} service map`;
  const body = `${bc.html}<article class="doc wide"><header class="doc-head"><h1>${esc(h1)}</h1>
<p class="answer"><strong>${cat.rows.length} ${esc(PA.name)} → ${esc(PB.name)} mappings: ${counts.direct} direct, ${counts.partial} partial, ${counts.none} with no equivalent.</strong></p><p class="lede">${esc(cat.description)}</p>
<p class="meta small">Last verified: <time datetime="${cat.last_verified}">${fmtDate(cat.last_verified)}</time> · <a href="${editUrl(cat.file)}" rel="noopener">Edit on GitHub</a></p></header>
<div class="group-controls js-only" role="group" aria-label="Section controls">
<button type="button" class="btn-text" data-expand-all>Expand all</button>
<button type="button" class="btn-text" data-collapse-all>Collapse all</button>
</div>
<nav aria-label="Groups" class="toc jump-chips"><ul>${cat.groups.map((g) => `<li><a href="#${g.id}">${esc(g.name)} <span class="muted">(${cat.rows.filter((r) => r.group === g.id).length})</span></a></li>`).join('')}</ul></nav>
${cat.groups.map((g) => { const rows = cat.rows.filter((r) => r.group === g.id); return `<details class="cat-group" id="${g.id}" data-group="${g.id}" open>
<summary class="cat-sum"><span class="chev" aria-hidden="true"></span><span class="cat-sum-label">${esc(g.name)}</span><span class="count">(${rows.length})</span></summary>
<div class="cat-body">${rows.map((r) => `<div class="cat-row"><h3><a href="${r.url}">${esc(r.capability)}</a> ${matchBadge(r.match)}</h3><p>${esc(r.answer)}</p>${gcpOn(r) ? `<p class="small"><span class="muted">Google Cloud:</span> ${r.svc.gcp.length ? esc(joinNames(names(r.svc.gcp))) : 'no first-party equivalent'} ${matchBadge(r.gcp.match)} <a href="${r.gcpUrl}">AWS vs GCP →</a></p>` : ''}</div>`).join('')}</div>
</details>`; }).join('')}
</article>`;
  const og = `/og/category/${cat.id}.png`;
  renderOg({ kicker: `${PA.name} vs ${PB.name}`, title: cat.name, subtitle: `${cat.rows.length} mappings: ${counts.direct} direct, ${counts.partial} partial, ${counts.none} none.`, siteName: config.siteName }, path.join(OUT, og));
  const ld = [bc.ld, { '@type': 'CollectionPage', name: h1, url: abs(url), dateModified: cat.last_verified, hasPart: cat.rows.map((r) => ({ '@type': 'TechArticle', headline: r.capability, url: abs(r.url) })) }];
  write(url, page({ url, title: `${cat.name}: ${PA.name} vs ${PB.name} services | ${config.siteName}`, description: clip(`${cat.rows.length} verified ${PA.name} to ${PB.name} ${cat.seo_description || cat.description}`, 158), h1, body, ld, ogImage: og, ogType: 'website', active: 'cat' }));
}

// ---------- category index ----------
function categoryIndex() {
  const url = '/category/';
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'Categories', url }]);
  const all = [...rowsById.values()];
  const h1 = `${PA.name} to ${PB.name} service categories`;
  const body = `${bc.html}<article class="doc wide"><header class="doc-head"><h1>${esc(h1)}</h1>
<p class="answer"><strong>${all.length} verified mappings across ${categories.length} categories.</strong></p></header>
<div class="cat-cards">${categories.map((c) => { const k = { direct: 0, partial: 0, none: 0 }; c.rows.forEach((r) => k[r.match]++); return `<section class="cat-card"><h2><a href="/category/${c.id}/">${esc(c.name)}</a></h2><p>${esc(c.description)}</p>
<p class="small">${c.rows.length} mappings · ${matchBadge('direct')} ${k.direct} ${matchBadge('partial')} ${k.partial} ${matchBadge('none')} ${k.none}</p>
<ul class="small">${c.groups.map((g) => `<li><a href="/category/${c.id}/#${g.id}">${esc(g.name)}</a> <span class="muted">(${c.rows.filter((r) => r.group === g.id).length})</span></li>`).join('')}</ul></section>`; }).join('')}</div>
</article>`;
  write(url, page({ url, title: `${PA.name} vs ${PB.name} service categories | ${config.siteName}`, description: clip(`Browse ${all.length} ${PA.name} to ${PB.name} service mappings by category: ${categories.map((c) => c.short || c.name).join(', ')}.`, 158), h1, body, ld: [bc.ld, { '@type': 'CollectionPage', name: h1, url: abs(url), dateModified: DATA_DATE, inLanguage: 'en', hasPart: categories.map((c) => ({ '@type': 'CollectionPage', name: c.name, url: abs(`/category/${c.id}/`) })) }], ogType: 'website', active: 'cat' }));
}

// ---------- exams page ----------
// ---------- exam guides for AWS engineers ----------
function examGuidePage(g) {
  const e = exams.get(g.code);
  const url = g.url;
  const alt = (g.alt_codes || []).length ? ` (replaces ${g.alt_codes.join(', ')})` : '';
  const h1 = `${g.code}${alt} for AWS engineers: ${g.title}`;
  const title = clip(`${g.code}${(g.alt_codes || []).length ? ` (${g.alt_codes.join(', ')})` : ''} for AWS engineers: domains mapped to AWS`, 65);
  const description = clip(`${g.code} (${g.title}) study guide for AWS engineers: official domains and weights, how each maps to AWS services you know, and the Azure concepts that trip AWS people up.`, 158);
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'Exams', url: '/exams/' }, { name: `${g.code} for AWS engineers`, url }]);
  const awsName = (r) => joinNames(names(r.svc[PA.id])) || 'none';
  const azName = (r) => joinNames(names(r.svc[PB.id])) || 'none';
  const closest = (g.closest_aws || []).map((c) => { const x = exams.get(c.code); return `<li><a href="${esc(x.url)}" rel="noopener">${esc(x.name)}</a>${x.unverified_code ? '' : ` <span class="code">${esc(x.code)}</span>`}${statusBadge(x.status)}: ${esc(c.why)}${x.note ? ` <span class="small muted">${esc(x.note)}</span>` : ''}</li>`; }).join('');
  const domainRows = g.domains.map((d, i) => `<tr><td><a href="#d${i + 1}">${esc(d.name)}</a></td><td class="code">${esc(d.weight)}</td><td>${(d.rows || []).length || '—'}</td></tr>`).join('');
  const domains = g.domains.map((d, i) => {
    const rows = (d.rows || []).map((id) => rowsById.get(id));
    return `<section class="exam-domain" aria-labelledby="d${i + 1}"><h3 id="d${i + 1}">${i + 1}. ${esc(d.name)} <span class="badge">${esc(d.weight)}</span></h3>
<p class="small muted">Official skill areas: ${esc(d.areas.join(' · '))}</p>
<p><strong>From AWS:</strong> ${esc(d.aws)}</p>
${rows.length ? `<p class="small muted">Compare pages to study (${rows.length}):</p><ul class="related">${rows.map((r) => `<li><a href="${r.url}">${esc(r.capability)}</a> <span class="muted small">${esc(awsName(r))} → ${esc(azName(r))}</span></li>`).join('')}</ul>` : '<p class="small muted">No AWS↔Azure service comparison on this site maps to this domain.</p>'}</section>`;
  }).join('\n');
  const faq = [
    { q: `What does ${g.code} cover, and how is it weighted?`, a: `${g.code} (${g.title}) has ${g.domains.length} domains: ${g.domains.map((d) => `${d.name} (${d.weight})`).join('; ')}. Weights are from the official Microsoft Learn study guide${g.skills_as_of ? ` (skills measured as of ${fmtDate(g.skills_as_of)})` : ''}.` },
    { q: `What is the closest AWS certification to ${g.code}?`, a: (g.closest_aws || []).length ? g.closest_aws.map((c) => { const x = exams.get(c.code); return `${x.name}${x.unverified_code ? '' : ` (${x.code})`}: ${c.why}`; }).join(' ') : (g.closest_aws_note || 'None.') },
    { q: `Is ${g.code} a current exam?`, a: `As of ${fmtDate(g.last_verified)}, Microsoft Learn lists ${g.code} as ${e.status}.${e.note ? ' ' + e.note : ''}` },
  ];
  const body = `${bc.html}
<article class="doc">
<header class="doc-head">
<p class="kicker">Exam guide for cloud switchers · ${esc(e.level)}</p>
<h1>${esc(h1)}</h1>
<p class="answer"><strong>${esc(firstSentence(g.summary))}</strong></p>
${rest(g.summary) ? `<p class="lede">${esc(rest(g.summary))}</p>` : ''}
<p class="meta small">Last verified: <time datetime="${g.last_verified}">${fmtDate(g.last_verified)}</time> against the <a href="${esc(g.study_guide)}" rel="noopener">official ${esc(g.code)} study guide</a> · <a href="${editUrl(g.file)}" rel="noopener">Edit on GitHub</a> · <a href="${issueUrl('Correction: exam guide ' + g.code)}" rel="noopener">Report an error</a></p>
</header>
<section aria-labelledby="t-facts"><h2 id="t-facts">Exam at a glance</h2>
<div class="tscroll"><table class="facts"><tbody>
<tr><th scope="row">Exam</th><td>${esc(g.code)}: ${esc(g.title)}</td></tr>
<tr><th scope="row">Certification</th><td><a href="${esc(e.url)}" rel="noopener">${esc(e.name)}</a> (${esc(e.level)})</td></tr>
<tr><th scope="row">Status</th><td>${esc(e.status)}${statusBadge(e.status)}${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}</td></tr>
<tr><th scope="row">Skills measured as of</th><td>${g.skills_as_of ? fmtDate(g.skills_as_of) : 'Not stated on the study guide'}</td></tr>
<tr><th scope="row">Passing score</th><td>${esc(String(g.passing_score))} or greater (per the study guide)</td></tr>
${g.prereq ? `<tr><th scope="row">Prerequisite</th><td>${esc(g.prereq)}</td></tr>` : ''}
<tr><th scope="row">Closest AWS cert</th><td>${(g.closest_aws || []).map((c) => esc(examLabel(c.code))).join(', ') || 'None current'}</td></tr>
</tbody></table></div>
<p class="small muted">Exam prices vary by country and are set on the exam page, so none are quoted here. Microsoft doesn't publish pass rates.</p></section>
<section aria-labelledby="t-who"><h2 id="t-who">Who it's for</h2><ul class="diffs">${g.audience.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></section>
<section aria-labelledby="t-dom"><h2 id="t-dom">Domains and how they map to AWS</h2>
<div class="tscroll"><table class="exams"><thead><tr><th scope="col">Domain (official)</th><th scope="col">Weight</th><th scope="col">Compare pages</th></tr></thead><tbody>${domainRows}</tbody></table></div>
${domains}</section>
<section aria-labelledby="t-trip"><h2 id="t-trip">Concepts that trip AWS engineers up</h2>${g.gotchas.map((x) => `<h3>${esc(x.title)}</h3><p>${esc(x.detail)}</p>`).join('')}</section>
<section aria-labelledby="t-aws"><h2 id="t-aws">Closest AWS certification</h2>${closest ? `<ul class="diffs">${closest}</ul>` : ''}${g.closest_aws_note ? `<p>${esc(g.closest_aws_note)}</p>` : ''}</section>
${g.flags?.length ? `<section aria-labelledby="t-flag" class="flags"><h2 id="t-flag">Verification notes</h2><ul>${g.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="t-faq"><h2 id="t-faq">FAQ</h2>${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</section>
<section aria-labelledby="t-more"><h2 id="t-more">Other exam guides</h2><ul class="related">${[...examGuides.values()].filter((x) => x.code !== g.code).map((x) => `<li><a href="${x.url}">${esc(x.code)} for AWS engineers</a> <span class="muted small">${esc(x.title)}</span></li>`).join('')}</ul></section>
<section aria-labelledby="t-src"><h2 id="t-src">Official sources</h2>${sourcesList(g.sources)}</section>
</article>`;
  const og = `/og/exams/${g.slug}.png`;
  renderOg({ kicker: 'Exam guide for AWS engineers', title: `${g.code}${alt}: ${g.title}`, subtitle: g.domains.map((d) => `${d.name} ${d.weight}`).join(' · '), badge: e.level, siteName: config.siteName }, path.join(OUT, og));
  const ld = [bc.ld,
    { '@type': 'TechArticle', headline: h1, description, url: abs(url), dateModified: g.last_verified, inLanguage: 'en', image: abs(og),
      about: { '@type': 'EducationalOccupationalCredential', name: e.name, credentialCategory: 'certification', url: e.url, recognizedBy: { '@type': 'Organization', name: 'Microsoft' } },
      audience: { '@type': 'Audience', audienceType: 'AWS engineers learning Azure' }, isPartOf: { '@type': 'WebSite', name: config.siteName, url: BASE + '/' }, citation: g.sources },
    { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }];
  write(url, page({ url, title, description, h1, body, ld, ogImage: og, active: 'exams' }));
}

function examsPage() {
  const url = '/exams/';
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'Exams', url }]);
  const all = [...rowsById.values()];
  const h1 = 'AWS and Azure certification exams, mapped to services';
  const body = `${bc.html}<article class="doc wide"><header class="doc-head"><h1>${esc(h1)}</h1>
<p class="answer"><strong>Which comparisons to study for each AWS and Microsoft certification, including exams that are retiring or retired.</strong></p>
<p class="small muted">Relevance is based on each exam's published scope summary. Always check the official exam guide.</p></header>
${examGuides.size ? `<section aria-labelledby="ex-guides"><h2 id="ex-guides">Azure exam guides for AWS engineers</h2>
<p>For each exam: who it's for, the official domains and weights, how each domain maps to the AWS services you already know, and the Azure concepts that trip AWS people up.</p>
<div class="cat-cards">${[...examGuides.values()].map((g) => `<div class="cat-card"><h3><a href="${g.url}">${esc(g.code)} for AWS engineers</a></h3><p class="small">${esc(g.title)} · ${esc(exams.get(g.code).level)}</p><p class="small muted">${g.domains.length} domains · closest AWS: ${esc((g.closest_aws || []).map((c) => examLabel(c.code)).join(', ') || 'none')}</p></div>`).join('')}</div></section>` : ''}
${providers.filter((p) => [...exams.values()].some((e) => e.provider === p.id)).map((p) => `<section aria-labelledby="ex-${p.id}"><h2 id="ex-${p.id}">${esc(p.long_name)}</h2>
${[...exams.values()].filter((e) => e.provider === p.id).map((e) => { const rows = all.filter((r) => (r.exams?.[p.id] || []).includes(e.code)); return `<div class="exam-block" id="${esc(e.code)}"><h3><a href="${esc(e.url)}" rel="noopener">${esc(e.name)}</a>${e.unverified_code ? '' : ` <span class="code">${esc(e.code)}</span>`}${statusBadge(e.status)}</h3>
<p class="small">${esc(e.level)}${e.note ? ` · ${esc(e.note)}` : ''}</p>${guideLink(e.code) ? `<p class="small"><a href="${guideLink(e.code).url}">${esc(e.code)} guide for AWS engineers →</a></p>` : ''}
${rows.length ? categories.map((c) => { const cr = rows.filter((r) => r.category === c.id); return cr.length ? `<p class="small muted ex-cat">${esc(c.name)} (${cr.length})</p><ul class="cols">${cr.map((r) => `<li><a href="${r.url}">${esc(r.capability)}</a></li>`).join('')}</ul>` : ''; }).join('') : '<p class="muted small">No comparisons mapped to this exam.</p>'}</div>`; }).join('')}</section>`).join('')}
</article>`;
  const codes = (pid) => [...exams.values()].filter((e) => e.provider === pid && e.status !== 'retired' && !e.unverified_code).map((e) => e.code);
  renderOg({ kicker: 'Certification study map', title: 'AWS & Azure exams mapped to services', subtitle: `${codes(PA.id).slice(0, 5).join(', ')}, ${codes(PB.id).slice(0, 5).join(', ')} and more.`, siteName: config.siteName }, path.join(OUT, '/og/exams.png'));
  write(url, page({ url, title: `AWS & Azure certification exams mapped to services | ${config.siteName}`, description: clip(`Study map linking ${PA.name} (${codes(PA.id).join(', ')}) and ${PB.name} (${codes(PB.id).join(', ')}) exams to service comparisons.`, 158), h1, body, ld: [bc.ld, { '@type': 'CollectionPage', name: h1, url: abs(url), dateModified: DATA_DATE, inLanguage: 'en' }], ogImage: '/og/exams.png', ogType: 'website', active: 'exams' }));
}

// ---------- about page ----------
function aboutPage() {
  const url = '/about/';
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'About', url }]);
  const h1 = `About ${config.siteName} and how mappings are verified`;
  const body = `${bc.html}<article class="doc"><header class="doc-head"><h1>${esc(h1)}</h1>
<p class="answer"><strong>${esc(config.siteName)} is an open-source study guide that maps cloud services between providers, with every claim tied to official documentation.</strong></p></header>
<h2>Verification policy</h2><ul class="diffs">
<li>Each mapping cites official AWS and Microsoft documentation (and Google Cloud documentation for the GCP column), and the comparison is checked against those pages on the "Last verified" date.</li>
<li>Lifecycle states (preview, maintenance, sunset, deprecated, retired) come from the vendors' own lifecycle and retirement pages.</li>
<li>Prices are never quoted. Pages describe the pricing model and link to the official pricing page.</li>
<li>Anything that could not be confirmed is listed under "Verification notes" on that page rather than stated as fact.</li>
<li>"No equivalent" is used when a provider has no first-party service. The closest alternatives are listed instead.</li></ul>
<h2>Match levels</h2><dl class="pricing">${Object.entries(MATCH).map(([k, v]) => `<div><dt>${matchBadge(k)}</dt><dd>${esc(v[1])}</dd></div>`).join('')}</dl>
<h2>Contribute</h2><p>All content lives in YAML files under <code>data/</code>, one file per category. Open a pull request with an official source URL for every change. <a href="${config.repoUrl}">View the repository</a>.</p>
</article>`;
  write(url, page({ url, title: `About & methodology | ${config.siteName}`, description: `How ${config.siteName} maps AWS and Azure services: official-source verification, lifecycle tracking, no invented prices, and open-source YAML data.`, h1, body, ld: [bc.ld, { '@type': 'AboutPage', name: h1, url: abs(url), dateModified: DATA_DATE, inLanguage: 'en' }], ogType: 'website', active: 'about' }));
}

// ---------- blog (content/blog/*.md; see src/blog.mjs and README "Blog") ----------
const xmlEsc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const absolutize = (html) => html.replace(/(href|src)="(\/(?!\/)[^"]*)"/g, (_, a, p) => `${a}="${BASE}${p}"`);
function blogPages() {
  const posts = BLOG.posts; const PER = 10;
  const pageCount = Math.max(1, Math.ceil(posts.length / PER));
  const tagList = (tags) => `<ul class="tags" aria-label="Tags">${tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`;
  const meta = (p) => `<time datetime="${p.date}">${fmtDate(p.date)}</time>${p.updated !== p.date ? ` · Updated <time datetime="${p.updated}">${fmtDate(p.updated)}</time>` : ''} · ${Math.max(1, Math.round(p.words / 220))} min read`;
  const publisher = { '@type': 'Organization', name: config.siteName, url: BASE + '/' };
  renderOg({ kicker: 'Blog', title: `${config.siteName} blog`, subtitle: 'What changed across AWS, Azure and Google Cloud, and how the services map.', siteName: config.siteName }, path.join(OUT, '/og/blog.png'));

  // Index pages: /blog/, /blog/page/2/, ...
  for (let n = 1; n <= pageCount; n++) {
    const url = n === 1 ? '/blog/' : `/blog/page/${n}/`;
    const slice = posts.slice((n - 1) * PER, n * PER);
    const bc = breadcrumbs(n === 1 ? [{ name: 'Home', url: '/' }, { name: 'Blog', url }] : [{ name: 'Home', url: '/' }, { name: 'Blog', url: '/blog/' }, { name: `Page ${n}`, url }]);
    const h1 = n === 1 ? `${config.siteName} blog` : `${config.siteName} blog, page ${n}`;
    const list = slice.length ? `<ol class="post-list">${slice.map((p) => `<li class="cat-card post-card"><p class="small muted post-meta">${meta(p)}</p><h2><a href="${p.url}">${esc(p.title)}</a></h2><p>${esc(p.description)}</p>${tagList(p.tags)}</li>`).join('')}</ol>`
      : `<div class="empty-state"><p><strong>No posts yet.</strong> Weekly posts on what changed across AWS, Azure and Google Cloud will appear here.</p><p class="small">Subscribe to the <a href="/blog/feed.xml">Atom feed</a> to get them, or browse the <a href="/">service matrix</a> in the meantime.</p></div>`;
    const pager = pageCount > 1 ? `<nav class="pager" aria-label="Blog pages">${n > 1 ? `<a href="${n === 2 ? '/blog/' : `/blog/page/${n - 1}/`}" rel="prev">← Newer posts</a>` : '<span></span>'}<span class="small muted">Page ${n} of ${pageCount}</span>${n < pageCount ? `<a href="/blog/page/${n + 1}/" rel="next">Older posts →</a>` : '<span></span>'}</nav>` : '';
    const body = `${bc.html}<article class="doc"><header class="doc-head"><h1>${esc(h1)}</h1>
<p class="answer"><strong>What changed across AWS, Azure and Google Cloud, and what it means for the service mappings and certification exams.</strong></p>
<p class="small muted">Every post links its official sources. <a href="/blog/feed.xml">Atom feed</a></p></header>
${list}${pager}${NEWSLETTER()}</article>`;
    const ld = [bc.ld, { '@type': 'Blog', name: `${config.siteName} blog`, url: abs('/blog/'), publisher, blogPost: slice.map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: abs(p.url), datePublished: p.date, dateModified: p.updated })) }];
    write(url, page({ url, title: n === 1 ? `Blog: AWS, Azure and Google Cloud changes | ${config.siteName}` : `Blog, page ${n} | ${config.siteName}`, description: n === 1 ? `Weekly notes on AWS, Azure and Google Cloud service changes, how they affect the ${config.siteName} mappings, and certification news, with official sources.` : `Older ${config.siteName} blog posts, page ${n} of ${pageCount}.`, h1, body, ld, ogImage: '/og/blog.png', ogType: 'website', active: 'blog', lastmod: posts[0]?.updated }));
  }

  // Post pages
  posts.forEach((p, i) => {
    const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'Blog', url: '/blog/' }, { name: p.title, url: p.url }]);
    const og = `/og/blog/${p.slug}.png`;
    renderOg({ kicker: `Blog · ${fmtDate(p.date)}`, title: p.title, subtitle: p.description, siteName: config.siteName }, path.join(OUT, og));
    const rows = p.compares.map((id) => rowsById.get(id));
    const newer = posts[i - 1]; const older = posts[i + 1];
    const body = `${bc.html}<article class="doc post"><header class="doc-head"><p class="small muted post-meta">${meta(p)}</p><h1>${esc(p.title)}</h1>
<p class="answer"><strong>${esc(p.description)}</strong></p>${tagList(p.tags)}</header>
<div class="prose">${p.html}</div>
${rows.length ? `<section aria-labelledby="post-related"><h2 id="post-related">Related comparisons</h2><ul class="diffs">${rows.map((r) => `<li><a href="${r.url}">${esc(r.capability)}</a> <span class="muted small">${esc(r.what_for)}</span></li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="post-sources"><h2 id="post-sources">Sources</h2><ol class="sources">${p.sources.map((s) => `<li><a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a> <span class="path">${esc(host(s.url))}</span></li>`).join('')}</ol></section>
<nav class="pager" aria-label="More posts">${newer ? `<a href="${newer.url}" rel="prev">← ${esc(newer.title)}</a>` : '<span></span>'}<a href="/blog/">All posts</a>${older ? `<a href="${older.url}" rel="next">${esc(older.title)} →</a>` : '<span></span>'}</nav>
${NEWSLETTER()}</article>`;
    const ld = [bc.ld, { '@type': 'BlogPosting', headline: clip(p.title, 110), description: p.description, datePublished: p.date, dateModified: p.updated, url: abs(p.url), mainEntityOfPage: abs(p.url), image: abs(og), keywords: p.tags.join(', '), wordCount: p.words, author: publisher, publisher, isPartOf: { '@type': 'Blog', name: `${config.siteName} blog`, url: abs('/blog/') }, citation: p.sources.map((s) => ({ '@type': 'CreativeWork', name: s.title, url: s.url })) }];
    write(p.url, page({ url: p.url, title: `${p.title} | ${config.siteName}`, description: p.description, h1: p.title, body, ld, ogImage: og, ogType: 'article', active: 'blog', lastmod: p.updated,
      extraHead: `<meta property="article:published_time" content="${p.date}">\n<meta property="article:modified_time" content="${p.updated}">\n${p.tags.map((t) => `<meta property="article:tag" content="${esc(t)}">`).join('\n')}\n` }));
  });

  // Atom feed (always written, valid even with no entries).
  const feedUpdated = (posts.length ? posts.map((p) => p.updated).sort().pop() : categories.map((c) => c.last_verified).sort().pop()) + 'T12:00:00Z';
  write('/blog/feed.xml', `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xmlEsc(config.siteName)} blog</title>
  <subtitle>What changed across AWS, Azure and Google Cloud, with official sources.</subtitle>
  <link rel="self" type="application/atom+xml" href="${abs('/blog/feed.xml')}"/>
  <link rel="alternate" type="text/html" href="${abs('/blog/')}"/>
  <id>${abs('/blog/')}</id>
  <updated>${feedUpdated}</updated>
  <author><name>${xmlEsc(config.siteName)}</name><uri>${BASE}/</uri></author>
${posts.slice(0, 20).map((p) => `  <entry>
    <title>${xmlEsc(p.title)}</title>
    <link rel="alternate" type="text/html" href="${abs(p.url)}"/>
    <id>${abs(p.url)}</id>
    <published>${p.date}T12:00:00Z</published>
    <updated>${p.updated}T12:00:00Z</updated>
    <summary>${xmlEsc(p.description)}</summary>
${p.tags.map((t) => `    <category term="${xmlEsc(t)}"/>`).join('\n')}
    <content type="html">${xmlEsc(absolutize(p.html) + `<h2>Sources</h2><ol>${p.sources.map((s) => `<li><a href="${esc(s.url)}">${esc(s.title)}</a></li>`).join('')}</ol>`)}</content>
  </entry>`).join('\n')}
</feed>
`);
}

// ---------- home (interactive matrix over server-rendered HTML) ----------
function homePage() {
  const all = [...rowsById.values()];
  const counts = { direct: 0, partial: 0, none: 0 }; all.forEach((r) => counts[r.match]++);
  const usedExams = [...exams.values()].filter((e) => all.some((r) => examsFor(r).includes(e.code)));
  const chips = (list) => list.length ? list.map((s) => `<a class="chip svc" href="${s.url}">${esc(s.name)}${statusBadge(s.status, s.status_note)}</a>`).join('') : '<span class="nochip">No equivalent</span>';
  const groupOpts = categories.map((c) => `<optgroup label="${esc(c.name)}">${c.groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</optgroup>`).join('');
  const theadFor = (cat) => `<thead><tr><th scope="col">Capability</th>${provsForCat(cat).map((p) => `<th scope="col" class="p-${p.id}"><span class="dot" aria-hidden="true"></span>${esc(p.name)}</th>`).join('')}<th scope="col">${provsForCat(cat).length > 2 ? 'Match <span class="mh">AWS ↔ Azure</span>' : 'Match<span class="sr"> (AWS to Azure)</span>'}</th><th scope="col"><span class="sr">Details</span></th></tr></thead>`;
  const sections = categories.map((cat) => {
    const CP = provsForCat(cat); const thead = theadFor(cat);
    const tbodies = cat.groups.map((g) => {
      const rows = cat.rows.filter((r) => r.group === g.id);
      return `<tbody id="rows-${g.id}" data-group="${g.id}" data-cat="${cat.id}" data-count="${rows.length}">
<tr class="grp"><th colspan="${CP.length + 3}" scope="colgroup"><button type="button" class="grp-toggle" id="g-${g.id}" aria-expanded="true" aria-controls="rows-${g.id}" data-group="${g.id}"><span class="chev" aria-hidden="true"></span><span class="grp-label">${esc(g.name)}</span><span class="count" data-count-label>(${rows.length})</span></button></th></tr>
${rows.map((r) => `<tr class="row" id="${r.id}" data-cat="${cat.id}" data-group="${g.id}" data-match="${r.match}" data-exams="${examsFor(r).join(' ')}" data-s="${esc([r.capability, r.what_for, ...CP.flatMap((p) => names(r.svc[p.id]))].join(' ').toLowerCase())}">
<th scope="row" class="cap"><a href="${r.url}">${esc(r.capability)}</a><span class="what">${esc(r.what_for)}</span></th>
${CP.map((p) => `<td class="pcol p-${p.id}" data-label="${esc(p.name)}">${chips(r.svc[p.id])}${p.id === 'gcp' && r.gcp ? `<span class="gmatch"><span class="sr">Google Cloud vs AWS: </span>${matchBadge(r.gcp.match)}</span>` : ''}</td>`).join('')}
<td class="mcol" data-label="${CP.length > 2 ? 'Match (AWS ↔ Azure)' : 'Match'}">${matchBadge(r.match)}</td>
<td class="act"><a class="open" href="${r.url}" data-open="${r.id}" data-cat="${cat.id}" aria-label="Details: ${esc(r.capability)}">Details</a></td></tr>`).join('')}
</tbody>`;
    }).join('');
    return `<section class="mcat" id="cat-${cat.id}" data-cat="${cat.id}" aria-labelledby="h-${cat.id}">
<h2 class="mcat-h" id="h-${cat.id}"><span>${esc(cat.name)}</span> <span class="count" data-cat-count>(${cat.rows.length})</span> <a class="mcat-link small" href="/category/${cat.id}/">Category page<span class="sr">: ${esc(cat.name)}</span> →</a></h2>
<div class="tscroll mx"><table class="matrix${CP.length > 2 ? ' m3' : ''}" id="matrix-${cat.id}"><caption class="sr">${esc(cat.name)}: ${esc(PA.name)} to ${esc(PB.name)} service matrix</caption>${thead}
${tbodies}
</table></div></section>`;
  }).join('\n');
  const body = `<section class="hero"><h1>${esc(PA.name)} ↔ ${esc(PB.name)} service equivalents</h1>
<p class="lede">${all.length} verified capability mappings across ${categories.length} categories, ${services[PA.id].size} ${esc(PA.name)} and ${services[PB.id].size} ${esc(PB.name)} services. Each has a plain-language purpose, match quality, key differences, pricing model, exam mapping and official sources. Retired and maintenance-mode services are flagged.</p>
${gcpCats.length ? `<p class="small">${gcpCats.length === categories.length ? 'New: a <strong>Google Cloud</strong> column across every category: ' : 'New: a <strong>Google Cloud</strong> column, verified category by category. Done so far: '}${gcpCats.map((c) => `<a href="#cat-${c.id}">${esc(c.name)}</a> (${c.rows.length})`).join(', ')}. <a href="/gcp/">Browse GCP services →</a></p>` : ''}
<ul class="cat-pills" aria-label="Categories">${categories.map((c) => `<li><a href="#cat-${c.id}" data-jump-cat="${c.id}">${esc(c.short || c.name)} <span class="muted">${c.rows.length}</span></a></li>`).join('')}</ul>
<p class="stats"><span>${matchBadge('direct')} ${counts.direct}</span><span>${matchBadge('partial')} ${counts.partial}</span><span>${matchBadge('none')} ${counts.none}</span><span class="small muted">Last verified ${fmtDate(categories.map((c) => c.last_verified).sort().pop())}</span></p>
${CHANGES.length ? `<p class="small">Latest change (${fmtDate(CHANGES[0].date)}): ${esc(CHANGES[0].title)}. <a href="/changes/">What changed →</a></p>` : ''}</section>
<div class="home-layout">
<aside class="jump" aria-label="Jump to section">
<nav class="jump-nav">${categories.map((c) => `<p class="jump-title"><a href="#cat-${c.id}" data-jump-cat="${c.id}">${esc(c.short || c.name)}</a></p><ul>${c.groups.map((g) => `<li><a href="#g-${g.id}" data-jump="${g.id}">${esc(g.name)} <span class="muted">(${c.rows.filter((r) => r.group === g.id).length})</span></a></li>`).join('')}</ul>`).join('')}</nav>
</aside>
<div class="home-main">
<div class="toolbar sticky-bar js-only" id="toolbar" role="group" aria-label="Filters">
<label class="jump-mobile">Jump <select id="f-jump" aria-label="Jump to group"><option value="">Jump to group…</option>${groupOpts}</select></label>
<label>Category <select id="f-cat"><option value="">All categories</option>${categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
<label>Group <select id="f-group"><option value="">All groups</option>${groupOpts}</select></label>
<label>Exam <select id="f-exam"><option value="">Any exam</option>${providers.filter((p) => usedExams.some((e) => e.provider === p.id)).map((p) => `<optgroup label="${esc(p.name)}">${usedExams.filter((e) => e.provider === p.id).map((e) => `<option value="${esc(e.code)}">${esc(e.unverified_code ? e.name : e.code + ' · ' + e.name.replace(/^(AWS Certified|Microsoft Certified:)\s*/, ''))}${e.status !== 'current' ? ` (${e.status})` : ''}</option>`).join('')}</optgroup>`).join('')}</select></label>
<label>Match <select id="f-match"><option value="">Any match</option><option value="direct">Direct</option><option value="partial">Partial</option><option value="none">No equivalent</option></select></label>
<div class="view" role="radiogroup" aria-label="View"><button type="button" id="v-matrix" role="radio" aria-checked="true">Matrix</button><button type="button" id="v-cards" role="radio" aria-checked="false">Cards</button></div>
<div class="toolbar-actions">
<button type="button" class="btn-text" id="expand-all">Expand all</button>
<button type="button" class="btn-text" id="collapse-all">Collapse all</button>
<p id="count" class="small muted" aria-live="polite">${all.length} mappings</p>
</div>
</div>
${sections}
<p id="empty" class="empty" hidden>No mappings match these filters.</p>
</div>
</div>
<dialog id="drawer" class="drawer" aria-labelledby="dr-title"><div class="dr-in"><button type="button" class="dr-close" id="dr-close" aria-label="Close">×</button><div id="dr-body"></div></div></dialog>
<button type="button" class="to-top js-only" id="to-top" aria-label="Back to top" hidden>↑</button>`;
  renderOg({ kicker: 'Open-source cloud study guide', title: `${PA.name} ↔ ${PB.name} service equivalents`, subtitle: `${all.length} verified mappings: ${categories.map((c) => c.short || c.name).join(', ')}.`, siteName: config.siteName }, path.join(OUT, '/og/default.png'));
  const ld = [{ '@type': 'WebSite', name: config.siteName, url: BASE + '/', potentialAction: { '@type': 'SearchAction', target: BASE + '/?q={query}', 'query-input': 'required name=query' } },
    { '@type': 'ItemList', name: `${PA.name} to ${PB.name} service mappings`, numberOfItems: all.length, itemListElement: all.map((r, i) => ({ '@type': 'ListItem', position: i + 1, name: r.capability, url: abs(r.url) })) }];
  write('/', page({ url: '/', title: `AWS vs Azure vs Google Cloud service equivalents (2026) | ${config.siteName}`, description: clip(`Searchable matrix of ${all.length} verified AWS to Azure and Google Cloud service mappings: ${categories.map((c) => c.short || c.name).join(', ')}. Differences, pricing, exams, sources.`, 158), h1: `${PA.name} ↔ ${PB.name} service equivalents`, body, ld, ogType: 'website', active: 'home', extraHead: '', scripts: `<script src="${rel('/assets/home.js')}" defer></script>` }));

  // Lazy-loaded drawer data, one file per category.
  for (const cat of categories) {
    const idx = cat.rows.map((r) => ({ id: r.id, url: rel(r.url), capability: r.capability, what_for: r.what_for, match: r.match, matchLabel: MATCH[r.match][0], answer: r.answer,
      providers: provsForCat(cat).map((p) => ({ id: p.id, name: p.name, services: r.svc[p.id].map((s) => ({ name: s.name, url: rel(s.url), status: STATUS[s.status]?.[0] || '', docs: s.docs })), pricing: r.pricing?.[p.id] || '',
        ...(p.id === 'gcp' && r.gcp ? { match: r.gcp.match, matchLabel: MATCH[r.gcp.match][0], compare: rel(r.gcpUrl) } : {}) })),
      differences: r.differences, exams: examsFor(r).map((c) => ({ code: c, label: examLabel(c), name: exams.get(c).name, status: exams.get(c).status })), flags: r.flags || [] }));
    write(`/data/rows-${cat.id}.json`, JSON.stringify(idx));
  }
}


// ---------- open dataset: /api/v1/mappings.json + .csv, documented at /data/ ----------
function datasetPage() {
  const gOn = providers.some((p) => p.id === 'gcp');
  const nm = (arr) => arr.map((s) => s.name);
  const rows = categories.flatMap((cat) => cat.rows.map((r) => ({
    id: r.id, category: cat.id, category_name: cat.name, group: r.group, group_name: groupName(cat, r.group), capability: r.capability,
    aws: nm(r.svc.aws || []), azure: nm(r.svc.azure || []), azure_match: r.match,
    gcp: gOn && r.gcp ? nm(r.svc.gcp || []) : null, gcp_match: gOn && r.gcp ? r.gcp.match : null,
    aws_azure_url: abs(r.url), aws_gcp_url: gOn && r.gcpUrl ? abs(r.gcpUrl) : null,
    azure_last_reviewed: String(cat.last_verified), gcp_last_reviewed: gOn && r.gcp && cat.gcp_last_verified ? String(cat.gcp_last_verified) : null,
    sources: [...(r.sources || []), ...((r.gcp && r.gcp.sources) || [])],
  })));
  const modified = rows.flatMap((r) => [r.azure_last_reviewed, r.gcp_last_reviewed]).filter(Boolean).sort().pop();
  const json = { name: `${config.siteName} cloud service mappings`, version: 1, license: 'MIT', url: abs('/data/'), modified, count: rows.length, rows };
  write('/api/v1/mappings.json', JSON.stringify(json, null, 1) + '\n');
  const cols = ['id', 'category', 'group', 'capability', 'aws', 'azure', 'azure_match', 'gcp', 'gcp_match', 'aws_azure_url', 'aws_gcp_url', 'azure_last_reviewed', 'gcp_last_reviewed'];
  const cell = (v) => { const t = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v); return /[",\n;]/.test(t) || /^[=+\-@]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  write('/api/v1/mappings.csv', [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n') + '\n');
  const fields = [
    ['id', 'string', 'Stable row id (also used in the site source YAML).'], ['category / category_name', 'string', 'Category id and display name.'], ['group / group_name', 'string', 'Sub-group within the category.'],
    ['capability', 'string', 'What the services do, in plain words.'], ['aws', 'string[]', 'AWS service names (CSV: joined with "; ").'], ['azure', 'string[]', 'Azure equivalent(s); empty when there is no first-party equivalent.'],
    ['azure_match', 'direct | partial | none', 'How closely the Azure service matches AWS.'], ['gcp', 'string[] | null', 'Google Cloud equivalent(s); null when the category has no reviewed GCP column.'], ['gcp_match', 'direct | partial | none | null', 'How closely the Google Cloud service matches AWS.'],
    ['aws_azure_url / aws_gcp_url', 'URL', 'The comparison pages on this site.'], ['azure_last_reviewed / gcp_last_reviewed', 'YYYY-MM-DD', 'Date the mapping was last checked against official docs.'], ['sources', 'URL[] (JSON only)', 'Official documentation used to verify the row.'],
  ];
  const url = '/data/';
  const h1 = 'Open data: AWS, Azure and Google Cloud service mappings';
  const year = String(modified).slice(0, 4);
  const cite = `${config.siteName} (${year}). AWS, Azure and Google Cloud service mappings, v1 (updated ${modified}). ${abs('/data/')}`;
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'Open data', url }]);
  const body = `${bc.html}<article class="doc"><header class="doc-head"><h1>${esc(h1)}</h1>
<p class="answer"><strong>Every mapping on this site, ${rows.length} rows, as one JSON or CSV file, regenerated on every build from the same reviewed data as the pages.</strong></p>
<p class="small muted">Last updated <time datetime="${modified}">${fmtDate(modified)}</time></p></header>
<h2>Download</h2><ul class="diffs"><li><a href="/api/v1/mappings.json">/api/v1/mappings.json</a> (all fields, including official sources)</li><li><a href="/api/v1/mappings.csv">/api/v1/mappings.csv</a> (one row per mapping, lists joined with "; ")</li></ul>
<p>Both files are static, need no key, and keep their URL and field names for v1. Breaking changes will ship under a new version path.</p>
<h2>Fields</h2><div class="tscroll"><table class="exams"><thead><tr><th scope="col">Field</th><th scope="col">Type</th><th scope="col">Meaning</th></tr></thead><tbody>${fields.map(([a, b, c]) => `<tr><td><code>${esc(a)}</code></td><td>${esc(b)}</td><td>${esc(c)}</td></tr>`).join('')}</tbody></table></div>
<h2>License</h2><p>The data is released under the MIT License, the same license as the <a href="${config.repoUrl}">site source</a>. Service names are trademarks of their owners. Always confirm details in the linked official documentation.</p>
<h2>Suggested citation</h2><p><code>${esc(cite)}</code></p>
<h2>Corrections</h2><p>Found a wrong mapping? Open an issue or pull request on <a href="${config.repoUrl}">GitHub</a>. See the <a href="/about/">methodology</a> for how rows are verified.</p></article>`;
  const ld = [bc.ld, { '@type': 'Dataset', name: `${config.siteName}: AWS, Azure and Google Cloud service mappings`, description: `${rows.length} reviewed mappings between AWS services and their Microsoft Azure and Google Cloud equivalents, with match level, comparison page URLs, last-reviewed dates and official documentation sources.`,
    url: abs(url), license: 'https://opensource.org/licenses/MIT', isAccessibleForFree: true, dateModified: modified, version: '1', keywords: ['AWS', 'Azure', 'Google Cloud', 'cloud service equivalents', 'cloud migration'],
    creator: { '@type': 'Organization', name: config.siteName, url: BASE + '/' }, citation: cite,
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: abs('/api/v1/mappings.json') }, { '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: abs('/api/v1/mappings.csv') }] }];
  write(url, page({ url, title: `Open data: cloud service mappings (JSON, CSV) | ${config.siteName}`, description: `Download all ${rows.length} AWS, Azure and Google Cloud service mappings as JSON or CSV. MIT licensed, with field docs, review dates and a suggested citation.`, h1, body, ld, ogType: 'website' }));
}


// ---------- public change log: /changes/ + /changes/feed.xml ----------
function changesPage() {
  const url = '/changes/';
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'What changed', url }]);
  const h1 = `What changed on ${config.siteName}`;
  const link = (l) => `<a href="${esc(l)}">${esc(l.replace(/^https?:\/\/[^/]+/, '') || l)}</a>`;
  const commit = (c) => c.commit ? ` <a class="small muted" href="${config.repoUrl}/commit/${esc(c.commit)}">${esc(c.commit)}</a>` : '';
  const body = `${bc.html}<article class="doc"><header class="doc-head"><h1>${esc(h1)}</h1>
<p class="answer"><strong>A dated log of what was added or corrected on this site: new categories, providers, guides, data and fixes.</strong></p>
<p class="small muted">Newest first. Last change <time datetime="${CHANGES[0].date}">${fmtDate(CHANGES[0].date)}</time>. <a href="/changes/feed.xml">Atom feed</a></p></header>
<ol class="changes">${CHANGES.map((c) => `<li id="c-${c.date}"><h2><time datetime="${c.date}">${fmtDate(c.date)}</time>: ${esc(c.title)}</h2><p>${esc(c.summary)}</p>${c.links.length || c.commit ? `<p class="small">${c.links.map(link).join(' · ')}${commit(c)}</p>` : ''}</li>`).join('')}</ol>
${NEWSLETTER()}</article>`;
  const ld = [bc.ld, { '@type': 'WebPage', name: h1, url: abs(url), dateModified: CHANGES[0].date, inLanguage: 'en' }];
  write(url, page({ url, title: `What changed: site change log | ${config.siteName}`, description: `Dated log of additions and corrections to ${config.siteName}: new categories, the Google Cloud column, exam guides and the open dataset.`, h1, body, ld, ogType: 'website' }));
  const full = (l) => /^https?:/.test(l) ? l : abs(l);
  write('/changes/feed.xml', `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${xmlEsc(config.siteName)}: what changed</title>
  <link rel="self" type="application/atom+xml" href="${abs('/changes/feed.xml')}"/>
  <link rel="alternate" type="text/html" href="${abs(url)}"/>
  <id>${abs(url)}</id>
  <updated>${CHANGES[0].date}T12:00:00Z</updated>
  <author><name>${xmlEsc(config.siteName)}</name><uri>${BASE}/</uri></author>
${CHANGES.map((c) => `  <entry>
    <title>${xmlEsc(c.title)}</title>
    <link rel="alternate" type="text/html" href="${abs(url)}#c-${c.date}"/>
    <id>${abs(url)}#c-${c.date}</id>
    <updated>${c.date}T12:00:00Z</updated>
    <summary>${xmlEsc(c.summary)}</summary>
    <content type="html">${xmlEsc(`<p>${esc(c.summary)}</p>${c.links.length ? `<ul>${c.links.map((l) => `<li><a href="${esc(full(l))}">${esc(full(l))}</a></li>`).join('')}</ul>` : ''}`)}</content>
  </entry>`).join('\n')}
</feed>
`);
}

// ---------- /llms.txt: short map of the site for AI tools ----------
function llmsTxt() {
  const n = rowsById.size;
  write('/llms.txt', `# ${config.siteName}

> Open-source study guide mapping ${n} AWS services to their Microsoft Azure and Google Cloud equivalents, each verified against official documentation and dated.

Each mapping has an AWS vs Azure page and an AWS vs Google Cloud page with match level, key differences, pricing model, exam mapping and official sources. Data is MIT licensed.

## Data
- [Open dataset](${abs('/data/')}): field docs, license and citation
- [mappings.json](${abs('/api/v1/mappings.json')}): all ${n} mappings as JSON, with sources
- [mappings.csv](${abs('/api/v1/mappings.csv')}): the same as CSV

## Browse
- [Service matrix](${abs('/')})
- [Categories](${abs('/category/')})
${providers.map((p) => `- [${p.name} services](${abs(`/${p.id}/`)})`).join('\n')}
- [Certification exams](${abs('/exams/')})

## Updates
- [Blog](${abs('/blog/')}) ([Atom](${abs('/blog/feed.xml')}))
- [What changed](${abs('/changes/')}) ([Atom](${abs('/changes/feed.xml')}))
- [Methodology](${abs('/about/')})
`);
}

// ---------- run ----------
fs.cpSync(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), { recursive: true, filter: (s) => !s.includes('fonts') });
// Pre-paint collapse rules for every group (matrix rows + category/hub details bodies).
{
  const ids = [...new Set([...categories.flatMap((c) => c.groups.map((g) => g.id)), ...categories.map((c) => `pidx-${c.id}`)])];
  const css = ids.map((id) => [
    `html[data-cc-closed~="${id}"] tbody[data-group="${id}"]>tr.row{display:none!important}`,
    `html[data-cc-closed~="${id}"] tbody[data-group="${id}"] .chev{transform:rotate(-90deg)}`,
    `html[data-cc-closed~="${id}"] .jump a[href="#g-${id}"]{opacity:.55}`,
    `html[data-cc-closed~="${id}"] details.cat-group[data-group="${id}"]>.cat-body{display:none!important}`,
    `html[data-cc-closed~="${id}"] details.cat-group[data-group="${id}"]>.cat-sum .chev{transform:rotate(-90deg)!important}`,
  ].join('')).join('');
  fs.appendFileSync(path.join(OUT, 'assets/site.css'), '\n/* generated collapse rules */\n' + css + '\n');
}
fs.writeFileSync(path.join(OUT, 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0b1220"/><rect x="6" y="9" width="9" height="14" rx="2" fill="#ff9900"/><rect x="17" y="9" width="9" height="14" rx="2" fill="#3b8eea"/></svg>`);
homePage();
categories.forEach(categoryPage);
categoryIndex();
for (const r of rowsById.values()) comparePage(r);
for (const r of rowsById.values()) if (gcpOn(r)) gcpComparePage(r);
for (const p of providers) { providerIndex(p); for (const s of services[p.id].values()) hubPage(p, s); }
for (const g of examGuides.values()) examGuidePage(g);
examsPage();
aboutPage();
datasetPage();
changesPage();
llmsTxt();
blogPages();
write('/404.html', page({ url: '/404.html', title: `Not found | ${config.siteName}`, description: 'Page not found.', h1: 'Page not found', body: '<article class="doc"><h1>Page not found</h1><p>Try the <a href="/">service matrix</a> or search above.</p></article>' }).replace('<meta name="description"', '<meta name="robots" content="noindex">\n<meta name="description"'));
pages.splice(pages.indexOf('/404.html'), 1);
const today = DATA_DATE;
write('/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((u) => `  <url><loc>${abs(u)}</loc><lastmod>${lastmods.get(u) || today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
// Search and AI crawlers are explicitly welcome (training tokens included): the data is MIT licensed.
const BOTS = ['Googlebot', 'Bingbot', 'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot', 'Perplexity-User', 'Google-Extended', 'Applebot', 'Applebot-Extended'];
write('/robots.txt', `${BOTS.map((b) => `User-agent: ${b}`).join('\n')}\nAllow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);
// IndexNow (Bing, Yandex, etc.) ownership key file
if (config.indexNowKey) write(`/${config.indexNowKey}.txt`, config.indexNowKey);
console.log(`Built ${pages.length} pages (${rowsById.size} compare pages, ${BLOG.posts.length} blog posts; ${BLOG.drafts.length} drafts and ${BLOG.scheduled.length} future-dated posts skipped) into dist/`);
