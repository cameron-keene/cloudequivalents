// Checks every URL in data/ for HTTP status. Usage: node scripts/check-links.mjs
import fs from 'node:fs'; import path from 'node:path'; import yaml from 'js-yaml';
const files = [];
(function walk(d){ for (const f of fs.readdirSync(d)) { const p = path.join(d,f); fs.statSync(p).isDirectory() ? walk(p) : p.endsWith('.yaml') && files.push(p); } })('data');
const urls = new Set();
for (const f of files) { const t = fs.readFileSync(f,'utf8'); for (const m of t.matchAll(/https?:\/\/[^\s"'<>)]+/g)) urls.add(m[0].replace(/[.,]$/,'')); }
const UA = {'user-agent':'Mozilla/5.0 (cloud-compare link checker)'};
async function check(u){
  for (const method of ['HEAD','GET']) {
    try { const r = await fetch(u,{method,redirect:'follow',headers:UA,signal:AbortSignal.timeout(20000)}); if (r.status<400 || method==='GET') return [r.status, r.url]; } catch(e){ if(method==='GET') return ['ERR',String(e.message)]; }
  }
}
const list=[...urls]; const out=[]; let i=0;
await Promise.all(Array.from({length:12},async()=>{ while(i<list.length){ const u=list[i++]; const [s,f]=await check(u); out.push({url:u,status:s,final:f}); }}));
out.sort((a,b)=>String(a.status).localeCompare(String(b.status)));
fs.writeFileSync('link-report.json', JSON.stringify(out,null,2));
const bad = out.filter(o=>o.status==='ERR'||o.status>=400);
console.log(`checked ${out.length} urls, ${bad.length} problems`); for (const b of bad) console.log(b.status, b.url);
