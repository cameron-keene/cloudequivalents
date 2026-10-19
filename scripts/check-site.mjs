// Post-build SEO/integrity checks on dist/: one H1, unique title/description, canonical, valid JSON-LD, no broken internal links.
import fs from 'node:fs'; import path from 'node:path';
const root = 'dist'; const files = [];
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
  const og = h.match(/property="og:image" content="https?:\/\/[^/]+(\/[^"]+)"/)?.[1]; if (og && !fs.existsSync(path.join(root, og))) errs.push(`${f}: missing og ${og}`);
  for (const m of h.matchAll(/href="(\/[^"#?]*)/g)) { links++; const u = m[1]; const p = path.join(root, u, u.endsWith('/') ? 'index.html' : ''); if (!fs.existsSync(p)) errs.push(`${f}: broken link ${u}`); }
}
console.log(`${files.length} html files, ${links} internal links checked, ${errs.length} problems`); errs.forEach((e) => console.log(' ', e));
process.exit(errs.length ? 1 : 0);
