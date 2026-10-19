// Post-build SEO/integrity checks on dist/: one H1, unique title/description, canonical, valid JSON-LD, no broken internal links.
import fs from 'node:fs'; import path from 'node:path';
const root = 'dist'; const files = [];
const config = JSON.parse(fs.readFileSync('site.config.json','utf8'));
let PREFIX = '';
try { const pathname = new URL(config.baseUrl.replace(/\/$/,'') + '/').pathname.replace(/\/$/,''); PREFIX = pathname === '/' ? '' : pathname; } catch {}

(function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') && files.push(p); } })(root);
const titles = new Map(), descs = new Map(); const errs = []; let links = 0;
for (const f of files) {
  if (f.endsWith('404.html')) continue;
  const h = fs.readFileSync(f, 'utf8');
  const h1 = (h.match(/<h1[\s>]/g) || []).length; if (h1 !== 1) errs.push(`${f}: ${h1} h1`);
  const t = h.match(/<title>(.*?)<\/title>/)?.[1]; const d = h.match(/<meta name="description" content="(.*?)"/)?.[1];
  if (titles.has(t)) errs.push(`dup title ${t}: ${f} ${titles.get(t)}`); titles.set(t, f);
  if (descs.has(d)) errs.push(`dup desc: ${f} ${descs.get(d)}`); descs.set(d, f);
  if (!/rel="canonical"/.test(h)) errs.push(`${f}: no canonical`);
  for (const m of h.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)) { try { JSON.parse(m[1]); } catch { errs.push(`${f}: bad JSON-LD`); } }
  const ogm = h.match(/property="og:image" content="([^"]+)"/); if (ogm) { let og = ogm[1]; try { og = new URL(og).pathname; } catch {} if (PREFIX && og.startsWith(PREFIX + '/')) og = og.slice(PREFIX.length); else if (PREFIX && og === PREFIX) og = '/'; if (!fs.existsSync(path.join(root, og))) errs.push(`${f}: missing og ${ogm[1]}`); }
  for (const m of h.matchAll(/href="(\/[^"#?]*)/g)) { links++; let u = m[1]; if (PREFIX && u.startsWith(PREFIX + '/')) u = u.slice(PREFIX.length); else if (PREFIX && u === PREFIX) u = '/'; const p = path.join(root, u, u.endsWith('/') ? 'index.html' : ''); if (!fs.existsSync(p) && !u.match(/\.(xml|txt|json|svg|png|css|js)$/)) { const p2 = path.join(root, u); if (!fs.existsSync(p2)) errs.push(`${f}: broken link ${m[1]}`); } else if (u.match(/\.(xml|txt|json|svg|png|css|js)$/) && !fs.existsSync(path.join(root, u))) errs.push(`${f}: broken link ${m[1]}`); }
}
console.log(`${files.length} html files, ${links} internal links checked, ${errs.length} problems`); errs.forEach((e) => console.log(' ', e));
process.exit(errs.length ? 1 : 0);
