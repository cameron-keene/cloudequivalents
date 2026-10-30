import { loadData } from './data.mjs';
import { loadPosts, loadFeeds } from './blog.mjs';
const d = loadData();
const today = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const blog = loadPosts(d.ROOT, { today, knownRows: d.rowsById });
const feeds = loadFeeds(d.ROOT);
const errors = [...d.errors, ...blog.errors, ...feeds.errors];
// data/changes.yaml: public change log
import fs from 'node:fs'; import path from 'node:path'; import yaml from 'js-yaml';
const changes = yaml.load(fs.readFileSync(path.join(d.ROOT, 'data/changes.yaml'), 'utf8')) || [];
if (!changes.length) errors.push('data/changes.yaml: needs at least one entry');
const cdates = new Set();
for (const c of changes) {
  const w = `changes.yaml ${c.date}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(c.date))) errors.push(`${w}: date must be YYYY-MM-DD (quoted)`);
  if (cdates.has(String(c.date))) errors.push(`${w}: one entry per date (merge them)`); cdates.add(String(c.date));
  if (String(c.date) > today) errors.push(`${w}: future date`);
  for (const k of ['title', 'summary']) if (!c[k]) errors.push(`${w}: missing ${k}`);
  for (const l of c.links || []) if (!/^(\/|https:\/\/)/.test(l)) errors.push(`${w}: link must be a site path or https URL: ${l}`);
  if (c.commit && !/^[0-9a-f]{7,40}$/.test(c.commit)) errors.push(`${w}: bad commit hash`);
}
for (const p of blog.drafts) for (const w of p.warnings || []) console.warn(`draft warning: ${w}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`OK: ${d.rowsById.size} rows, ${d.providers.map((p) => `${d.services[p.id].size} ${p.name} services`).join(', ')}, ${d.exams.size} exams, ${d.examGuides.size} exam guides, ${blog.posts.length} blog posts (${blog.drafts.length} drafts, ${blog.scheduled.length} scheduled), ${feeds.feeds.length} news feeds, ${changes.length} change-log entries`);
