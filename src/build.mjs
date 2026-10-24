// Static site generator: YAML data -> fully pre-rendered HTML in dist/.
import fs from 'node:fs';
import path from 'node:path';
import { loadData } from './data.mjs';
import { makeOgRenderer } from './og.mjs';

const D = loadData();
if (D.errors.length) { console.error('Data errors:\n' + D.errors.join('\n')); process.exit(1); }
const { ROOT, config, providers, exams, services, categories, rowsById } = D;
const OUT = path.join(ROOT, 'dist');
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

function breadcrumbs(items) {
  const html = `<nav class="crumbs" aria-label="Breadcrumb"><ol>${items.map((it, i) => i === items.length - 1
    ? `<li><span aria-current="page">${esc(it.name)}</span></li>` : `<li><a href="${it.url}">${esc(it.name)}</a></li>`).join('')}</ol></nav>`;
  const ld = { '@type': 'BreadcrumbList', itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.url) })) };
  return { html, ld };
}

const HEADER = (active) => `<header class="top"><div class="wrap top-in">
  <a class="brand" href="${rel('/')}"><span class="logo" aria-hidden="true"><i></i><i></i></span>${esc(config.siteName)}</a>
  <nav class="nav" aria-label="Main"><a href="${rel('/')}"${active === 'home' ? ' aria-current="page"' : ''}>Matrix</a><a href="${rel('/category/')}"${active === 'cat' ? ' aria-current="page"' : ''}>Categories</a><a href="${rel('/aws/')}"${active === 'aws' ? ' aria-current="page"' : ''}>AWS</a><a href="${rel('/azure/')}"${active === 'azure' ? ' aria-current="page"' : ''}>Azure</a><a href="${rel('/exams/')}"${active === 'exams' ? ' aria-current="page"' : ''}>Exams</a><a href="${rel('/about/')}"${active === 'about' ? ' aria-current="page"' : ''}>About</a></nav>
  <form class="search" action="${rel('/')}" method="get" role="search"><label class="sr" for="q">Search services</label><input id="q" name="q" type="search" placeholder="Search services…" autocomplete="off"><kbd aria-hidden="true">⌘K</kbd></form>
</div></header>`;

const FOOTER = `<footer class="foot"><div class="wrap">
  <p>${esc(config.siteName)} is an open-source, community-maintained study guide. It is not affiliated with Amazon Web Services or Microsoft. Service names are trademarks of their owners. Always confirm details in the linked official documentation.</p>
  <p><a href="${config.repoUrl}">Source on GitHub</a> · <a href="${rel('/about/')}">Methodology</a> · <a href="${rel('/sitemap.xml')}">Sitemap</a> · MIT License</p>
</div></footer>`;

// Cmd+K / "/" focuses the header search (content pages ship only this tiny script).
const KEY_JS = `<script>addEventListener('keydown',function(e){if((e.key==='k'&&(e.metaKey||e.ctrlKey))||(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))){e.preventDefault();var q=document.getElementById('q');q.focus();q.select()}})</script>`;

function page({ url, title, description, h1, body, ld = [], ogImage, ogType = 'article', active, scripts = '', extraHead = '' }) {
  pages.push(url);
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
<link rel="icon" href="${rel('/favicon.svg')}" type="image/svg+xml">
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
${KEY_JS}<script src="${rel('/assets/site.js')}" defer></script>${scripts}
</body>
</html>`;
  return html;
}

const sourcesList = (urls) => `<ul class="sources">${urls.map((u) => `<li><a href="${esc(u)}" rel="noopener">${esc(host(u))}<span class="path">${esc(new URL(u).pathname.replace(/\/$/, '').slice(0, 90))}</span></a></li>`).join('')}</ul>`;

// ---------- compare pages ----------
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
  const svcRows = (label, fn) => `<tr><th scope="row">${label}</th>${providers.map((p) => fn(r.svc[p.id], p)).join('')}</tr>`;
  const table = `<div class="tscroll"><table class="cmp">
<caption>${esc(r.capability)}: ${providers.map((p) => p.name).join(' vs ')} side by side</caption>
<thead><tr><th scope="col">Aspect</th>${providers.map((p) => `<th scope="col" class="p-${p.id}">${esc(p.long_name)}</th>`).join('')}</tr></thead>
<tbody>
${svcRows('Service', (l, p) => svcCell(l, p.id))}
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
<section aria-labelledby="t-price"><h2 id="t-price">Pricing summary</h2>
<p class="small muted">Pricing models only. No prices are quoted because they change by region and over time.</p>
<dl class="pricing">${providers.map((p) => `<div><dt class="p-${p.id}">${esc(p.name)}</dt><dd>${esc(r.pricing?.[p.id] || 'No direct equivalent.')}${r.svc[p.id].filter((s) => s.pricing).map((s) => ` <a href="${esc(s.pricing)}" rel="noopener">${esc(s.name)} pricing →</a>`).join('')}</dd></div>`).join('')}</dl></section>
${ex.length ? `<section aria-labelledby="t-exam"><h2 id="t-exam">Certification exam mapping</h2>
<table class="exams"><thead><tr><th scope="col">Exam</th><th scope="col">Provider</th><th scope="col">Level</th><th scope="col">Status</th></tr></thead><tbody>
${ex.map((c) => { const e = exams.get(c); return `<tr><td><a href="${esc(e.url)}" rel="noopener">${esc(e.name)}</a>${e.unverified_code ? '' : ` <span class="code">${esc(e.code)}</span>`}</td><td>${esc(providers.find((p) => p.id === e.provider)?.name || e.provider)}</td><td>${esc(e.level)}</td><td>${esc(e.status)}${e.note ? `<div class="small muted">${esc(e.note)}</div>` : ''}</td></tr>`; }).join('')}
</tbody></table><p class="small muted">Relevance is based on each exam's published scope, not a line-by-line objective match. Check the official study guide.</p></section>` : ''}
${r.flags?.length ? `<section aria-labelledby="t-flag" class="flags"><h2 id="t-flag">Verification notes</h2><ul>${r.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="t-faq"><h2 id="t-faq">FAQ</h2>${faq.map((f) => `<details><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}</section>
${related.length ? `<section aria-labelledby="t-rel"><h2 id="t-rel">Related comparisons</h2><ul class="related">${related.map((x) => `<li><a href="${x.url}">${esc(x.capability)}</a> <span class="muted small">${esc(joinNames(names(x.svc[PA.id])))} → ${esc(joinNames(names(x.svc[PB.id])) || 'none')}</span></li>`).join('')}</ul></section>` : ''}
<section aria-labelledby="t-src"><h2 id="t-src">Official sources</h2>${sourcesList(r.sources)}</section>
</article>`;
  const og = `/og/compare/${r.slug}.png`;
  renderOg({ kicker: `${PA.name} vs ${PB.name} · ${r.capability}`, title: B.length ? `${A[0].name} vs ${B[0].name}` : `${A[0].name} → ${PB.name}?`, subtitle: lead, badge: MATCH[r.match][0], siteName: config.siteName }, path.join(OUT, og));
  const ld = [bc.ld,
    { '@type': 'TechArticle', headline: h1, description, url: abs(r.url), dateModified: cat.last_verified, inLanguage: 'en', image: abs(og),
      about: [...A, ...B].map((s) => ({ '@type': 'Thing', name: s.name, sameAs: s.docs })), isPartOf: { '@type': 'WebSite', name: config.siteName, url: BASE + '/' }, citation: r.sources },
    { '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }];
  write(r.url, page({ url: r.url, title, description, h1, body, ld, ogImage: og, active: 'cat' }));
}

// ---------- service hub pages ----------
function hubPage(p, s) {
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
<div class="tscroll"><table class="cmp"><thead><tr><th scope="col">Capability</th><th scope="col">${esc(o.name)} equivalent</th><th scope="col">Match</th></tr></thead><tbody>
${s.rows.map((r) => `<tr><td><a href="${r.url}">${esc(r.capability)}</a></td><td>${r.svc[o.id].length ? r.svc[o.id].map((x) => `<a href="${x.url}">${esc(x.name)}</a>${statusBadge(x.status, x.status_note)}`).join(', ') : '<span class="muted">None</span>'}</td><td>${matchBadge(r.match)}</td></tr>`).join('')}
</tbody></table></div>
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
  const url = `/${p.id}/`;
  const h1 = `${p.long_name} services and their ${o.name} equivalents`;
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: p.name, url }]);
  const homeCat = (s) => catOf(s.rows[0]).id;
  const body = `${bc.html}<article class="doc wide"><header class="doc-head"><h1>${esc(h1)}</h1><p class="answer"><strong>${list.length} ${esc(p.name)} services mapped to ${esc(o.name)} across ${categories.length} categories, including retired and maintenance-mode services.</strong></p></header>
<div class="group-controls js-only" role="group" aria-label="Section controls"><button type="button" class="btn-text" data-expand-all>Expand all</button><button type="button" class="btn-text" data-collapse-all>Collapse all</button></div>
${categories.map((cat) => { const items = list.filter((s) => homeCat(s) === cat.id); if (!items.length) return ''; return `<details class="cat-group" id="svc-${cat.id}" data-group="pidx-${cat.id}" open>
<summary class="cat-sum"><span class="chev" aria-hidden="true"></span><span class="cat-sum-label">${esc(cat.name)}</span><span class="count">(${items.length})</span></summary>
<div class="cat-body"><div class="tscroll"><table class="cmp"><thead><tr><th scope="col">${esc(p.name)} service</th><th scope="col">What it is</th><th scope="col">${esc(o.name)} equivalent(s)</th></tr></thead><tbody>
${items.map((s) => { const eq = [...new Map(s.rows.flatMap((r) => r.svc[o.id]).map((x) => [x.slug, x])).values()]; return `<tr><td><a href="${s.url}">${esc(s.name)}</a>${statusBadge(s.status, s.status_note)}</td><td class="small">${esc(clip(s.summary, 160))}</td><td>${eq.length ? eq.map((x) => esc(x.name)).join(', ') : '<span class="muted">None</span>'}</td></tr>`; }).join('')}
</tbody></table></div></div></details>`; }).join('')}
</article>`;
  const og = `/og/${p.id}/index.png`;
  renderOg({ kicker: `${p.name} → ${o.name}`, title: `${p.name} services, mapped to ${o.name}`, subtitle: `${list.length} services with status, docs and equivalents.`, siteName: config.siteName }, path.join(OUT, og));
  write(url, page({ url, title: `${p.name} services → ${o.name} equivalents | ${config.siteName}`, description: clip(`All ${list.length} ${p.long_name} services we map, grouped by category (${categories.map((c) => c.short || c.name).join(', ')}), with lifecycle status and ${o.long_name} equivalents.`, 158), h1, body, ld: [bc.ld], ogImage: og, ogType: 'website', active: p.id }));
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
<div class="cat-body">${rows.map((r) => `<div class="cat-row"><h3><a href="${r.url}">${esc(r.capability)}</a> ${matchBadge(r.match)}</h3><p>${esc(r.answer)}</p></div>`).join('')}</div>
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
  write(url, page({ url, title: `${PA.name} vs ${PB.name} service categories | ${config.siteName}`, description: clip(`Browse ${all.length} ${PA.name} to ${PB.name} service mappings by category: ${categories.map((c) => c.short || c.name).join(', ')}.`, 158), h1, body, ld: [bc.ld], ogType: 'website', active: 'cat' }));
}

// ---------- exams page ----------
function examsPage() {
  const url = '/exams/';
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'Exams', url }]);
  const all = [...rowsById.values()];
  const h1 = 'AWS and Azure certification exams, mapped to services';
  const body = `${bc.html}<article class="doc wide"><header class="doc-head"><h1>${esc(h1)}</h1>
<p class="answer"><strong>Which comparisons to study for each AWS and Microsoft certification, including exams that are retiring or retired.</strong></p>
<p class="small muted">Relevance is based on each exam's published scope summary. Always check the official exam guide.</p></header>
${providers.map((p) => `<section aria-labelledby="ex-${p.id}"><h2 id="ex-${p.id}">${esc(p.long_name)}</h2>
${[...exams.values()].filter((e) => e.provider === p.id).map((e) => { const rows = all.filter((r) => (r.exams?.[p.id] || []).includes(e.code)); return `<div class="exam-block" id="${esc(e.code)}"><h3><a href="${esc(e.url)}" rel="noopener">${esc(e.name)}</a>${e.unverified_code ? '' : ` <span class="code">${esc(e.code)}</span>`}${statusBadge(e.status)}</h3>
<p class="small">${esc(e.level)}${e.note ? ` · ${esc(e.note)}` : ''}</p>
${rows.length ? categories.map((c) => { const cr = rows.filter((r) => r.category === c.id); return cr.length ? `<p class="small muted ex-cat">${esc(c.name)} (${cr.length})</p><ul class="cols">${cr.map((r) => `<li><a href="${r.url}">${esc(r.capability)}</a></li>`).join('')}</ul>` : ''; }).join('') : '<p class="muted small">No comparisons mapped to this exam.</p>'}</div>`; }).join('')}</section>`).join('')}
</article>`;
  const codes = (pid) => [...exams.values()].filter((e) => e.provider === pid && e.status !== 'retired' && !e.unverified_code).map((e) => e.code);
  renderOg({ kicker: 'Certification study map', title: 'AWS & Azure exams mapped to services', subtitle: `${codes(PA.id).slice(0, 5).join(', ')}, ${codes(PB.id).slice(0, 5).join(', ')} and more.`, siteName: config.siteName }, path.join(OUT, '/og/exams.png'));
  write(url, page({ url, title: `AWS & Azure certification exams mapped to services | ${config.siteName}`, description: clip(`Study map linking ${PA.name} (${codes(PA.id).join(', ')}) and ${PB.name} (${codes(PB.id).join(', ')}) exams to service comparisons.`, 158), h1, body, ld: [bc.ld], ogImage: '/og/exams.png', ogType: 'website', active: 'exams' }));
}

// ---------- about page ----------
function aboutPage() {
  const url = '/about/';
  const bc = breadcrumbs([{ name: 'Home', url: '/' }, { name: 'About', url }]);
  const h1 = `About ${config.siteName} and how mappings are verified`;
  const body = `${bc.html}<article class="doc"><header class="doc-head"><h1>${esc(h1)}</h1>
<p class="answer"><strong>${esc(config.siteName)} is an open-source study guide that maps cloud services between providers, with every claim tied to official documentation.</strong></p></header>
<h2>Verification policy</h2><ul class="diffs">
<li>Each mapping cites official AWS and Microsoft documentation, and the comparison is checked against those pages on the "Last verified" date.</li>
<li>Lifecycle states (preview, maintenance, sunset, deprecated, retired) come from the vendors' own lifecycle and retirement pages.</li>
<li>Prices are never quoted. Pages describe the pricing model and link to the official pricing page.</li>
<li>Anything that could not be confirmed is listed under "Verification notes" on that page rather than stated as fact.</li>
<li>"No equivalent" is used when a provider has no first-party service. The closest alternatives are listed instead.</li></ul>
<h2>Match levels</h2><dl class="pricing">${Object.entries(MATCH).map(([k, v]) => `<div><dt>${matchBadge(k)}</dt><dd>${esc(v[1])}</dd></div>`).join('')}</dl>
<h2>Contribute</h2><p>All content lives in YAML files under <code>data/</code>, one file per category. Open a pull request with an official source URL for every change. <a href="${config.repoUrl}">View the repository</a>.</p>
</article>`;
  write(url, page({ url, title: `About & methodology | ${config.siteName}`, description: `How ${config.siteName} maps AWS and Azure services: official-source verification, lifecycle tracking, no invented prices, and open-source YAML data.`, h1, body, ld: [bc.ld], ogType: 'website', active: 'about' }));
}

// ---------- home (interactive matrix over server-rendered HTML) ----------
function homePage() {
  const all = [...rowsById.values()];
  const counts = { direct: 0, partial: 0, none: 0 }; all.forEach((r) => counts[r.match]++);
  const usedExams = [...exams.values()].filter((e) => all.some((r) => examsFor(r).includes(e.code)));
  const chips = (list) => list.length ? list.map((s) => `<a class="chip svc" href="${s.url}">${esc(s.name)}${statusBadge(s.status, s.status_note)}</a>`).join('') : '<span class="nochip">No equivalent</span>';
  const groupOpts = categories.map((c) => `<optgroup label="${esc(c.name)}">${c.groups.map((g) => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</optgroup>`).join('');
  const thead = `<thead><tr><th scope="col">Capability</th>${providers.map((p) => `<th scope="col" class="p-${p.id}"><span class="dot" aria-hidden="true"></span>${esc(p.name)}</th>`).join('')}<th scope="col">Match</th><th scope="col"><span class="sr">Details</span></th></tr></thead>`;
  const sections = categories.map((cat) => {
    const tbodies = cat.groups.map((g) => {
      const rows = cat.rows.filter((r) => r.group === g.id);
      return `<tbody id="rows-${g.id}" data-group="${g.id}" data-cat="${cat.id}" data-count="${rows.length}">
<tr class="grp"><th colspan="${providers.length + 3}" scope="colgroup"><button type="button" class="grp-toggle" id="g-${g.id}" aria-expanded="true" aria-controls="rows-${g.id}" data-group="${g.id}"><span class="chev" aria-hidden="true"></span><span class="grp-label">${esc(g.name)}</span><span class="count" data-count-label>(${rows.length})</span></button></th></tr>
${rows.map((r) => `<tr class="row" id="${r.id}" data-cat="${cat.id}" data-group="${g.id}" data-match="${r.match}" data-exams="${examsFor(r).join(' ')}" data-s="${esc([r.capability, r.what_for, ...providers.flatMap((p) => names(r.svc[p.id]))].join(' ').toLowerCase())}">
<th scope="row" class="cap"><a href="${r.url}">${esc(r.capability)}</a><span class="what">${esc(r.what_for)}</span></th>
${providers.map((p) => `<td class="pcol p-${p.id}" data-label="${esc(p.name)}">${chips(r.svc[p.id])}</td>`).join('')}
<td class="mcol" data-label="Match">${matchBadge(r.match)}</td>
<td class="act"><a class="open" href="${r.url}" data-open="${r.id}" data-cat="${cat.id}" aria-label="Details: ${esc(r.capability)}">Details</a></td></tr>`).join('')}
</tbody>`;
    }).join('');
    return `<section class="mcat" id="cat-${cat.id}" data-cat="${cat.id}" aria-labelledby="h-${cat.id}">
<h2 class="mcat-h" id="h-${cat.id}"><span>${esc(cat.name)}</span> <span class="count" data-cat-count>(${cat.rows.length})</span> <a class="mcat-link small" href="/category/${cat.id}/">Category page<span class="sr">: ${esc(cat.name)}</span> →</a></h2>
<div class="tscroll"><table class="matrix" id="matrix-${cat.id}"><caption class="sr">${esc(cat.name)}: ${esc(PA.name)} to ${esc(PB.name)} service matrix</caption>${thead}
${tbodies}
</table></div></section>`;
  }).join('\n');
  const body = `<section class="hero"><h1>${esc(PA.name)} ↔ ${esc(PB.name)} service equivalents</h1>
<p class="lede">${all.length} verified capability mappings across ${categories.length} categories, ${services[PA.id].size} ${esc(PA.name)} and ${services[PB.id].size} ${esc(PB.name)} services. Each has a plain-language purpose, match quality, key differences, pricing model, exam mapping and official sources. Retired and maintenance-mode services are flagged.</p>
<ul class="cat-pills" aria-label="Categories">${categories.map((c) => `<li><a href="#cat-${c.id}" data-jump-cat="${c.id}">${esc(c.short || c.name)} <span class="muted">${c.rows.length}</span></a></li>`).join('')}</ul>
<p class="stats"><span>${matchBadge('direct')} ${counts.direct}</span><span>${matchBadge('partial')} ${counts.partial}</span><span>${matchBadge('none')} ${counts.none}</span><span class="small muted">Last verified ${fmtDate(categories.map((c) => c.last_verified).sort().pop())}</span></p></section>
<div class="home-layout">
<aside class="jump" aria-label="Jump to section">
<nav class="jump-nav">${categories.map((c) => `<p class="jump-title"><a href="#cat-${c.id}" data-jump-cat="${c.id}">${esc(c.short || c.name)}</a></p><ul>${c.groups.map((g) => `<li><a href="#g-${g.id}" data-jump="${g.id}">${esc(g.name)} <span class="muted">(${c.rows.filter((r) => r.group === g.id).length})</span></a></li>`).join('')}</ul>`).join('')}</nav>
</aside>
<div class="home-main">
<div class="toolbar sticky-bar js-only" id="toolbar" role="group" aria-label="Filters">
<label class="jump-mobile">Jump <select id="f-jump" aria-label="Jump to group"><option value="">Jump to group…</option>${groupOpts}</select></label>
<label>Category <select id="f-cat"><option value="">All categories</option>${categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
<label>Group <select id="f-group"><option value="">All groups</option>${groupOpts}</select></label>
<label>Exam <select id="f-exam"><option value="">Any exam</option>${providers.map((p) => `<optgroup label="${esc(p.name)}">${usedExams.filter((e) => e.provider === p.id).map((e) => `<option value="${esc(e.code)}">${esc(e.unverified_code ? e.name : e.code + ' · ' + e.name.replace(/^(AWS Certified|Microsoft Certified:)\s*/, ''))}${e.status !== 'current' ? ` (${e.status})` : ''}</option>`).join('')}</optgroup>`).join('')}</select></label>
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
  write('/', page({ url: '/', title: `${PA.name} vs ${PB.name} service equivalents (2026) | ${config.siteName}`, description: clip(`Searchable matrix of ${all.length} verified ${PA.name} to ${PB.name} service mappings: ${categories.map((c) => c.short || c.name).join(', ')}. Differences, pricing models, exams, sources.`, 158), h1: `${PA.name} ↔ ${PB.name} service equivalents`, body, ld, ogType: 'website', active: 'home', extraHead: '', scripts: `<script src="${rel('/assets/home.js')}" defer></script>` }));

  // Lazy-loaded drawer data, one file per category.
  for (const cat of categories) {
    const idx = cat.rows.map((r) => ({ id: r.id, url: rel(r.url), capability: r.capability, what_for: r.what_for, match: r.match, matchLabel: MATCH[r.match][0], answer: r.answer,
      providers: providers.map((p) => ({ id: p.id, name: p.name, services: r.svc[p.id].map((s) => ({ name: s.name, url: rel(s.url), status: STATUS[s.status]?.[0] || '', docs: s.docs })), pricing: r.pricing?.[p.id] || '' })),
      differences: r.differences, exams: examsFor(r).map((c) => ({ code: c, label: examLabel(c), name: exams.get(c).name, status: exams.get(c).status })), flags: r.flags || [] }));
    write(`/data/rows-${cat.id}.json`, JSON.stringify(idx));
  }
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
for (const p of providers) { providerIndex(p); for (const s of services[p.id].values()) hubPage(p, s); }
examsPage();
aboutPage();
write('/404.html', page({ url: '/404.html', title: `Not found | ${config.siteName}`, description: 'Page not found.', h1: 'Page not found', body: '<article class="doc"><h1>Page not found</h1><p>Try the <a href="/">service matrix</a> or search above.</p></article>' }).replace('<meta name="description"', '<meta name="robots" content="noindex">\n<meta name="description"'));
pages.splice(pages.indexOf('/404.html'), 1);
const today = categories.map((c) => c.last_verified).sort().pop();
write('/sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((u) => `  <url><loc>${abs(u)}</loc><lastmod>${today}</lastmod></url>`).join('\n')}\n</urlset>\n`);
write('/robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);
console.log(`Built ${pages.length} pages (${rowsById.size} compare pages) into dist/`);
