import { loadData } from './data.mjs';
import { loadPosts, loadFeeds } from './blog.mjs';
const d = loadData();
const today = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);
const blog = loadPosts(d.ROOT, { today, knownRows: d.rowsById });
const feeds = loadFeeds(d.ROOT);
const errors = [...d.errors, ...blog.errors, ...feeds.errors];
for (const p of blog.drafts) for (const w of p.warnings || []) console.warn(`draft warning: ${w}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`OK: ${d.rowsById.size} rows, ${d.providers.map((p) => `${d.services[p.id].size} ${p.name} services`).join(', ')}, ${d.exams.size} exams, ${d.examGuides.size} exam guides, ${blog.posts.length} blog posts (${blog.drafts.length} drafts, ${blog.scheduled.length} scheduled), ${feeds.feeds.length} news feeds`);
