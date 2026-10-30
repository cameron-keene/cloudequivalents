// Count visits referred by AI assistants from an analytics CSV export (GoatCounter "Export" CSV, or any CSV with a Referrer column).
// Usage: npm run ai-referrers -- path/to/export.csv
// The host list lives in site.config.json "aiReferrers" so analytics filters and this script stay in sync.
import fs from 'node:fs';
const config = JSON.parse(fs.readFileSync(new URL('../site.config.json', import.meta.url), 'utf8'));
const hosts = config.aiReferrers || [];
const file = process.argv[2];
if (!file) { console.log(`AI referrer hosts (${hosts.length}):\n${hosts.map((h) => '  ' + h).join('\n')}\n\nGoatCounter: Settings > Export to CSV, then: npm run ai-referrers -- export.csv`); process.exit(0); }
const parse = (line) => { const out = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; };
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean);
const head = parse(lines[0]).map((h) => h.toLowerCase());
const ri = head.findIndex((h) => h.includes('referrer') && !h.includes('scheme'));
const pi = head.findIndex((h) => h === 'path' || h.endsWith(',path'));
const match = (ref) => hosts.find((h) => { try { const u = new URL(/^https?:/.test(ref) ? ref : 'https://' + ref).hostname.replace(/^www\./, ''); return u === h || u.endsWith('.' + h); } catch { return false; } });
const byHost = new Map(), byPath = new Map(); let total = 0, ai = 0;
for (const l of lines.slice(1)) {
  const c = parse(l); total++;
  const ref = ri >= 0 ? c[ri] : c.find((x) => match(x)) || '';
  const h = ref && match(ref); if (!h) continue; ai++;
  byHost.set(h, (byHost.get(h) || 0) + 1); if (pi >= 0) byPath.set(c[pi], (byPath.get(c[pi]) || 0) + 1);
}
console.log(`${ai} of ${total} visits (${total ? (100 * ai / total).toFixed(2) : 0}%) came from AI assistants`);
for (const [h, n] of [...byHost].sort((a, b) => b[1] - a[1])) console.log(`  ${h}: ${n}`);
if (byPath.size) { console.log('Top landing pages:'); for (const [p, n] of [...byPath].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(`  ${n}  ${p}`); }
