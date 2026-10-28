// Collects recent items from the official feeds in data/news-feeds.yaml (for the weekly blog job).
// Usage:
//   npm run news                          -> Markdown digest of the last 7 days to stdout
//   npm run news -- --days 14 --json      -> JSON array instead
//   npm run news -- --since 2026-10-21 --provider aws,gcp --kind announcements,release-notes
//   npm run news -- --check               -> verify every feed is reachable and parses as RSS/Atom (exit 1 if not)
// Feed content is untrusted third-party text: treat titles/summaries as data, verify facts on the linked page.
import path from 'node:path';
import { loadFeeds } from '../src/blog.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const check = opt('check', false) === true;
const days = Number(opt('days', 7));
const since = opt('since', null) ? new Date(opt('since') + 'T00:00:00Z') : new Date(Date.now() - days * 864e5);
const provs = opt('provider', null) ? String(opt('provider')).split(',') : null;
const kinds = opt('kind', null) ? String(opt('kind')).split(',') : null;
const asJson = opt('json', false) === true;

const { feeds, errors } = loadFeeds(ROOT);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
const sel = feeds.filter((f) => (!provs || provs.includes(f.provider)) && (!kinds || kinds.includes(f.kind)));

const decode = (s) => String(s ?? '').replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const text = (s) => decode(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (xml, t) => { const m = xml.match(new RegExp(`<${t}(?:\\s[^>]*)?>([\\s\\S]*?)</${t}>`)); return m ? m[1] : ''; };

function parse(xml) {
  if (/<feed[\s>]/.test(xml) && /<entry[\s>]/.test(xml) || /<feed[\s>][\s\S]*<\/feed>/.test(xml)) {
    const entries = [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/g)].map((m) => m[0]);
    return { format: 'atom', items: entries.map((e) => ({ title: text(tag(e, 'title')), link: (e.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/) || e.match(/<link[^>]*href="([^"]+)"/) || [])[1] || '', date: text(tag(e, 'published') || tag(e, 'updated')), summary: text(tag(e, 'summary') || tag(e, 'content')).slice(0, 400) })) };
  }
  if (/<rss[\s>]/.test(xml) && /<channel[\s>]/.test(xml)) {
    const items = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/g)].map((m) => m[0]);
    return { format: 'rss', items: items.map((e) => ({ title: text(tag(e, 'title')), link: text(tag(e, 'link')) || text(tag(e, 'guid')), date: text(tag(e, 'pubDate') || tag(e, 'dc:date')), summary: text(tag(e, 'description')).slice(0, 400) })) };
  }
  return null;
}

async function get(url) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (cloudequivalents news job)', accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8' }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) { last = e; await new Promise((s) => setTimeout(s, 1500 * (i + 1))); }
  }
  throw last;
}

const results = await Promise.all(sel.map(async (f) => {
  try {
    const p = parse(await get(f.url));
    if (!p) return { feed: f, error: 'not RSS or Atom' };
    if (!p.items.length) return { feed: f, error: 'feed has no entries' };
    return { feed: f, format: p.format, items: p.items };
  } catch (e) { return { feed: f, error: String(e.message || e) }; }
}));

if (check) {
  let bad = 0;
  for (const r of results) { if (r.error) bad++; console.log(`${r.error ? 'FAIL' : 'OK  '} ${r.feed.id.padEnd(32)} ${r.error || `${r.format} ${r.items.length} entries, newest ${r.items[0].date}`}`); }
  console.log(`${results.length - bad}/${results.length} feeds OK`);
  process.exit(bad ? 1 : 0);
}

const out = [];
for (const r of results) {
  if (r.error) { console.error(`warning: ${r.feed.id}: ${r.error}`); continue; }
  for (const it of r.items) {
    const d = new Date(it.date.replace(/ Z$/, ' GMT'));
    if (isNaN(d) || d < since) continue;
    out.push({ feed: r.feed.id, feedName: r.feed.name, provider: r.feed.provider, kind: r.feed.kind, date: d.toISOString(), title: it.title, link: it.link, summary: it.summary });
  }
}
out.sort((a, b) => b.date.localeCompare(a.date));
if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`# Provider news since ${since.toISOString().slice(0, 10)} (${out.length} items)\n`);
for (const p of ['aws', 'azure', 'gcp']) {
  const list = out.filter((o) => o.provider === p); if (!list.length) continue;
  console.log(`## ${{ aws: 'AWS', azure: 'Microsoft Azure', gcp: 'Google Cloud' }[p]} (${list.length})\n`);
  for (const o of list) console.log(`- ${o.date.slice(0, 10)} [${o.title.replace(/[[\]]/g, '')}](${o.link}) (${o.feedName})`);
  console.log('');
}
