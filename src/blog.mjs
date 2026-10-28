// Blog posts: Markdown files with YAML front matter in content/blog/.
// Published post:  content/blog/YYYY-MM-DD-slug.md  (URL /blog/slug/)
// Draft (never built, listed, or put in the feed/sitemap): front matter `draft: true`,
// or any file under content/blog/drafts/, or a file name starting with "_".
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { Marked } from 'marked';

export const BLOG_DIR = 'content/blog';
export const FILE_RE = /^(\d{4}-\d{2}-\d{2})-([a-z0-9]+(?:-[a-z0-9]+)*)\.md$/;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const isoDate = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ''));
export const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '');

export function splitFrontMatter(text) {
  const m = text.replace(/^\uFEFF/, '').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return null;
  return { data: yaml.load(m[1]) || {}, body: m[2] };
}

// Markdown -> HTML. Raw HTML in posts is escaped (posts are text, not markup); "# " headings are not allowed
// (the page already has the post title as its only <h1>); external links get rel="noopener".
function makeMarked() {
  const md = new Marked({ gfm: true });
  md.use({
    renderer: {
      html(token) { return esc(token.text ?? token.raw ?? ''); },
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const id = slugify(text.replace(/<[^>]+>/g, '')) || undefined;
        const d = Math.max(2, depth);
        return `<h${d}${id ? ` id="${id}"` : ''}>${text}</h${d}>\n`;
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const ext = /^https?:\/\//.test(href);
        return `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}${ext ? ' rel="noopener"' : ''}>${text}</a>`;
      },
      table(token) {
        const head = `<tr>${token.header.map((c) => `<th scope="col"${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</th>`).join('')}</tr>`;
        const rows = token.rows.map((r) => `<tr>${r.map((c) => `<td${c.align ? ` style="text-align:${c.align}"` : ''}>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`).join('');
        return `<div class="tscroll"><table class="cmp"><thead>${head}</thead><tbody>${rows}</tbody></table></div>\n`;
      },
    },
  });
  return md;
}

// Returns { posts (published, newest first), drafts, errors }. `today` (YYYY-MM-DD) hides future-dated posts.
export function loadPosts(ROOT, { today = new Date().toISOString().slice(0, 10), knownRows = null } = {}) {
  const dir = path.join(ROOT, BLOG_DIR);
  const posts = []; const drafts = []; const errors = []; const scheduled = [];
  if (!fs.existsSync(dir)) return { posts, drafts, scheduled, errors };
  const md = makeMarked();
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.md')) files.push(p); } })(dir);
  const slugs = new Map();
  for (const file of files.sort()) {
    const relFile = path.relative(ROOT, file);
    const name = path.basename(file);
    const inDrafts = path.relative(dir, file).split(path.sep)[0] === 'drafts';
    const fm = splitFrontMatter(fs.readFileSync(file, 'utf8'));
    const errs = []; const err = (m) => errs.push(`${relFile}: ${m}`);
    if (!fm) { errors.push(`${relFile}: missing front matter (--- ... ---)`); continue; }
    const d = fm.data;
    const isDraft = d.draft === true || inDrafts || name.startsWith('_');
    const fn = name.replace(/^_/, '').match(FILE_RE);
    if (!fn) { errors.push(`${relFile}: file name must be YYYY-MM-DD-slug.md (lowercase letters, digits, hyphens)`); continue; }
    const date = isoDate(d.date);
    const updated = d.updated != null ? isoDate(d.updated) : '';
    if (typeof d.title !== 'string' || !d.title.trim()) err('title is required');
    if (!ISO.test(date)) err('date must be YYYY-MM-DD');
    else if (date !== fn[1]) err(`date ${date} does not match file name date ${fn[1]}`);
    if (updated && (!ISO.test(updated) || updated < date)) err('updated must be YYYY-MM-DD and not before date');
    if (typeof d.description !== 'string' || d.description.trim().length < 50 || d.description.trim().length > 160) err('description is required, 50-160 characters');
    if (!Array.isArray(d.tags) || !d.tags.length || d.tags.some((t) => typeof t !== 'string' || !/^[a-z0-9][a-z0-9 .+-]*$/.test(t))) err('tags must be a non-empty list of lowercase strings');
    if (!Array.isArray(d.sources) || !d.sources.length) err('sources must be a non-empty list of { title, url }');
    else d.sources.forEach((s, i) => { if (!s || typeof s.title !== 'string' || !s.title.trim() || typeof s.url !== 'string' || !/^https:\/\/[^\s]+$/.test(s.url)) err(`sources[${i}] needs a title and an https url`); });
    if (d.compares != null && (!Array.isArray(d.compares) || d.compares.some((c) => typeof c !== 'string'))) err('compares must be a list of row ids');
    if (knownRows && Array.isArray(d.compares)) for (const c of d.compares) if (!knownRows.has(c)) err(`compares: unknown row id ${c}`);
    if (d.draft != null && typeof d.draft !== 'boolean') err('draft must be true or false');
    if (/^#\s/m.test(fm.body.replace(/```[\s\S]*?```/g, ''))) err('do not use "# " headings in the body; the title is the only h1 (start sections at "## ")');
    if (!fm.body.trim()) err('body is empty');
    if (/\bTODO\b/.test(fm.body + JSON.stringify(d)) || /example\.com/.test(JSON.stringify(d.sources || ''))) err('remove TODO placeholders and example.com sources before publishing');
    const slug = fn[2];
    const post = { file: relFile, slug, url: `/blog/${slug}/`, title: String(d.title || '').trim(), date, updated: updated || date, description: String(d.description || '').trim(), tags: d.tags || [], sources: d.sources || [], compares: d.compares || [], draft: isDraft, body: fm.body };
    // Drafts are checked (problems reported as warnings) but never block the build.
    if (isDraft) { post.warnings = errs; drafts.push(post); continue; }
    errors.push(...errs);
    if (slugs.has(slug)) errors.push(`${relFile}: ` + `duplicate slug ${slug} (also ${slugs.get(slug)})`); slugs.set(slug, relFile);
    if (date > today) { scheduled.push(post); continue; }
    post.html = md.parse(fm.body);
    post.words = fm.body.split(/\s+/).filter(Boolean).length;
    posts.push(post);
  }
  posts.sort((a, b) => (b.date + b.slug).localeCompare(a.date + a.slug));
  return { posts, drafts, scheduled, errors };
}

// data/news-feeds.yaml: [{ id, name, provider, kind, url, site, verified }]
export function loadFeeds(ROOT) {
  const f = path.join(ROOT, 'data/news-feeds.yaml');
  const errors = [];
  if (!fs.existsSync(f)) return { feeds: [], errors };
  const feeds = yaml.load(fs.readFileSync(f, 'utf8'))?.feeds || [];
  const ids = new Set();
  for (const x of feeds) {
    if (!x.id || ids.has(x.id)) errors.push(`news-feeds: missing or duplicate id ${x.id}`); ids.add(x.id);
    for (const k of ['name', 'provider', 'format', 'url', 'site', 'verified']) if (!x[k]) errors.push(`news-feeds ${x.id}: missing ${k}`);
    if (x.format && !['rss', 'atom'].includes(x.format)) errors.push(`news-feeds ${x.id}: format must be rss or atom`);
    if (x.url && !/^https:\/\//.test(x.url)) errors.push(`news-feeds ${x.id}: url must be https`);
  }
  return { feeds, errors };
}
