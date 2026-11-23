// Score the title/meta-description split test from a Google Search Console Pages export.
// Usage: npm run title-test -- path/to/Pages.csv
// Groups, baseline and design live in data/experiments/title-test-2026-11.yaml
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const EXP_PATH = path.join(ROOT, 'data/experiments/title-test-2026-11.yaml');
const exp = yaml.load(fs.readFileSync(EXP_PATH, 'utf8'));

const parse = (line) => {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
};

const normPath = (raw) => {
  let s = String(raw || '').trim();
  if (!s) return '';
  try {
    if (/^https?:\/\//i.test(s)) s = new URL(s).pathname || '/';
  } catch { /* keep s */ }
  s = s.split('?')[0].split('#')[0];
  if (!s.startsWith('/')) s = '/' + s;
  if (s !== '/' && !path.posix.extname(s) && !s.endsWith('/')) s += '/';
  return s;
};

const num = (v) => {
  if (v == null || v === '') return 0;
  const s = String(v).trim().replace(/,/g, '').replace(/%$/, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

const pct = (clicks, impr) => (impr ? (100 * clicks / impr).toFixed(2) + '%' : '—');
const pad = (s, n, right = false) => {
  s = String(s);
  return s.length >= n ? s : (right ? s + ' '.repeat(n - s.length) : ' '.repeat(n - s.length) + s);
};

const excluded = new Map((exp.excluded || []).map((p) => [p.path, p]));
const treatment = new Map((exp.treatment || []).filter((p) => !excluded.has(p.path)).map((p) => [p.path, p]));
const control = new Map((exp.control || []).filter((p) => !excluded.has(p.path)).map((p) => [p.path, p]));
const file = process.argv[2];

const header = () => {
  const start = exp.design?.start_date || '(fill at deploy)';
  const review = exp.design?.review_date || (exp.design?.start_date
    ? `start + ${exp.design.review_after_days || 21} days`
    : 'start + 21 days');
  console.log(`Title split test: ${exp.id}`);
  console.log(`Status: ${exp.status}`);
  console.log(`Baseline window: ${exp.baseline?.window}`);
  console.log(`Start date: ${start}`);
  console.log(`Review date: ${review}`);
  console.log(`Pages: ${treatment.size} treatment, ${control.size} control, ${excluded.size} excluded (not scored)`);
};

if (!file) {
  header();
  const tb = exp.baseline?.treatment_group || {};
  const cb = exp.baseline?.control_group || {};
  console.log('\nBaseline (Pages.csv, 28 days ending 2026-11-21)');
  console.log(`  Treatment: ${tb.clicks ?? '—'} clicks, ${tb.impressions ?? '—'} impressions, CTR ${pct(tb.clicks, tb.impressions)}`);
  console.log(`  Control:   ${cb.clicks ?? '—'} clicks, ${cb.impressions ?? '—'} impressions, CTR ${pct(cb.clicks, cb.impressions)}`);
  if (excluded.size) {
    console.log('  Excluded from scoring:');
    for (const [path, rec] of excluded) console.log(`    ${path}  (${rec.reason ? String(rec.reason).split('\n')[0].trim() : 'see experiment log'})`);
  }
  console.log('\nExport Pages.csv from Search Console (Pages report) for the test window, then:\n  npm run title-test -- Pages.csv');
  process.exit(0);
}

if (!fs.existsSync(file)) { console.error(`File not found: ${file}`); process.exit(1); }

const raw = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const lines = raw.split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
let headerIdx = lines.findIndex((l) => {
  const h = parse(l).map((x) => x.toLowerCase());
  return h.some((x) => x.includes('click')) && h.some((x) => x.includes('impression'));
});
if (headerIdx < 0) { console.error('Could not find a Pages header row with Clicks and Impressions columns.'); process.exit(1); }
const head = parse(lines[headerIdx]).map((h) => h.toLowerCase().trim());
const col = (preds) => head.findIndex((h) => preds.some((p) => p(h)));
const pi = col([(h) => h === 'top pages' || h === 'page' || h === 'pages' || h === 'url' || h === 'landing page' || h.endsWith('pages')]);
const ci = col([(h) => h === 'clicks']);
const ii = col([(h) => h === 'impressions']);
if (pi < 0 || ci < 0 || ii < 0) { console.error(`Missing columns in ${file}. Have: ${head.join(', ')}`); process.exit(1); }

const exportPages = new Map();
for (const l of lines.slice(headerIdx + 1)) {
  const c = parse(l);
  const p = normPath(c[pi]);
  if (!p) continue;
  const row = { path: p, clicks: num(c[ci]), impressions: num(c[ii]) };
  if (exportPages.has(p)) {
    const prev = exportPages.get(p);
    prev.clicks += row.clicks;
    prev.impressions += row.impressions;
  } else exportPages.set(p, row);
}

const sum = (paths) => {
  let clicks = 0, impressions = 0, matched = 0, missing = [];
  for (const p of paths) {
    const row = exportPages.get(p);
    if (!row) { missing.push(p); continue; }
    matched++;
    clicks += row.clicks;
    impressions += row.impressions;
  }
  return { clicks, impressions, matched, missing, n: paths.length };
};

const tPaths = [...treatment.keys()];
const cPaths = [...control.keys()];
const t = sum(tPaths);
const c = sum(cPaths);
const tb = exp.baseline?.treatment_group || {};
const cb = exp.baseline?.control_group || {};

header();
console.log(`\nExport: ${file}`);
console.log(`  Matched ${t.matched} of ${t.n} treatment, ${c.matched} of ${c.n} control (${exportPages.size} rows in export)`);
if (t.missing.length || c.missing.length) {
  for (const p of [...t.missing, ...c.missing]) console.log(`  missing from export: ${p}`);
}

const row = (label, clicks, impr, extra = '') =>
  `  ${pad(label, 22, true)}${pad(clicks, 7)}  ${pad(impr, 11)}  ${pad(pct(clicks, impr), 8)}${extra}`;

console.log('');
console.log(`  ${pad('', 22, true)}${pad('clicks', 7)}  ${pad('impressions', 11)}  ${pad('CTR', 8)}`);
console.log(row('Treatment', t.clicks, t.impressions));
if (tb.clicks != null) console.log(row('  baseline', tb.clicks, tb.impressions));
console.log(row('Control', c.clicks, c.impressions));
if (cb.clicks != null) console.log(row('  baseline', cb.clicks, cb.impressions));

if (t.impressions && c.impressions) {
  const diff = (100 * t.clicks / t.impressions) - (100 * c.clicks / c.impressions);
  console.log(`\n  CTR difference (treatment − control): ${diff >= 0 ? '+' : ''}${diff.toFixed(2)} pp`);
}

const table = (label, paths, group) => {
  console.log(`\n${label}:`);
  for (const p of paths) {
    const rec = group.get(p);
    const rowX = exportPages.get(p) || { clicks: 0, impressions: 0 };
    const bCtr = pct(rec.baseline_clicks, rec.baseline_impressions);
    const eCtr = exportPages.has(p) ? pct(rowX.clicks, rowX.impressions) : 'missing';
    console.log(`  ${pad(rowX.clicks, 4)} clk  ${pad(rowX.impressions, 5)} impr  ${pad(eCtr, 7)}  (baseline ${rec.baseline_clicks} / ${rec.baseline_impressions}, ${bCtr})  ${p}`);
  }
};
table('Treatment pages', tPaths, treatment);
table('Control pages', cPaths, control);

if (excluded.size) {
  console.log('\nExcluded pages (not scored in treatment or control):');
  for (const [p, rec] of excluded) {
    const rowX = exportPages.get(p);
    const bCtr = pct(rec.baseline_clicks, rec.baseline_impressions);
    if (!rowX) {
      console.log(`  missing from export  (baseline ${rec.baseline_clicks} / ${rec.baseline_impressions}, ${bCtr})  ${p}`);
      continue;
    }
    console.log(`  ${pad(rowX.clicks, 4)} clk  ${pad(rowX.impressions, 5)} impr  ${pad(pct(rowX.clicks, rowX.impressions), 7)}  (baseline ${rec.baseline_clicks} / ${rec.baseline_impressions}, ${bCtr})  ${p}`);
  }
}
