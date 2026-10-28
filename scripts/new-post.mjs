// Creates a blog post skeleton. Usage:
//   npm run new-post -- "Title of the post" [--date YYYY-MM-DD] [--tags aws,azure,weekly] [--draft] [--slug custom-slug]
// Writes content/blog/YYYY-MM-DD-slug.md (or content/blog/drafts/... with --draft) and prints the path.
import fs from 'node:fs';
import path from 'node:path';
import { slugify, BLOG_DIR, FILE_RE } from '../src/blog.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const flags = new Set(['--date', '--tags', '--slug']);
const opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const title = args.filter((a, i) => !a.startsWith('--') && !flags.has(args[i - 1])).join(' ').trim();
if (!title) { console.error('Usage: npm run new-post -- "Title" [--date YYYY-MM-DD] [--tags a,b] [--draft] [--slug s]'); process.exit(1); }
// Default date: today in America/Chicago (the site owner's time zone), as YYYY-MM-DD.
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const date = opt('--date') || today;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { console.error('--date must be YYYY-MM-DD'); process.exit(1); }
const slug = slugify(opt('--slug') || title);
const tags = (opt('--tags') || 'weekly').split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);
const draft = args.includes('--draft');
const file = `${date}-${slug}.md`;
if (!FILE_RE.test(file)) { console.error(`Bad file name ${file}`); process.exit(1); }
const dir = path.join(ROOT, BLOG_DIR, draft ? 'drafts' : '');
const out = path.join(dir, file);
if (fs.existsSync(out) || fs.existsSync(path.join(ROOT, BLOG_DIR, file)) || fs.existsSync(path.join(ROOT, BLOG_DIR, 'drafts', file))) { console.error(`Already exists: ${file}`); process.exit(1); }
fs.mkdirSync(dir, { recursive: true });
const q = (s) => JSON.stringify(s);
fs.writeFileSync(out, `---
title: ${q(title)}
date: ${date}
description: ${q('TODO: one or two sentences, 50-160 characters, used for search results and social cards.')}
tags: [${tags.join(', ')}]
# Optional: comparison rows to feature under "Related comparisons" (row ids from data/categories/*.yaml).
compares: []
sources:
  - title: ${q('TODO: official source title')}
    url: https://example.com/replace-with-official-source
${draft ? 'draft: true\n' : ''}---

TODO: opening paragraph. Start sections with "## " (the title is the page's only h1).

## What changed

- Link comparisons with root-relative links, for example [Amazon S3 vs Azure Blob Storage](/compare/aws-s3-vs-azure-blob-storage/).

## What it means if you know AWS
`);
console.log(path.relative(ROOT, out));
