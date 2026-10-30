# Cloud Equivalents: AWS ↔ Azure service equivalents

**Live site:** [cloudequivalents.com](https://cloudequivalents.com) · **Repo:** [github.com/cameron-keene/cloudequivalents](https://github.com/cameron-keene/cloudequivalents)

An open-source, source-cited study guide that maps cloud services between providers. It goes deeper than a name-to-name table. Every mapping includes:

- a plain-language purpose
- match quality (direct, partial, or none)
- key differences
- the pricing model, with links to official pricing pages (no prices are quoted)
- related certification exams
- lifecycle status (preview, maintenance, sunset, deprecated, retired)
- official documentation sources

**Current scope:** Compute (32 mappings), Containers & Serverless (29), Storage (38), Databases (34), Networking & Content Delivery (40), Identity & Security (29), and AI & Machine Learning (65): 267 mappings, 268 AWS services, 232 Azure services. Last verified 2026-10-24.

**Google Cloud column:** Compute (32), Containers & Serverless (29), Storage (38), Databases (34), Networking & Content Delivery (40), Identity & Security (29), AI & Machine Learning (65) (216 GCP services, verified 2026-10-27).


## Screenshots

![Home matrix](screenshots/01-home-matrix.png)

![Detail drawer](screenshots/02-drawer.png)

![Compare page](screenshots/03-compare-page.png)

![Cards + exam filter](screenshots/04-cards-exam-filter.png)

![Collapsible groups](screenshots/05-groups-collapsed.png)

![Search auto-expands matching groups](screenshots/06-search-auto-expand.png)

![Mobile layout (390px)](screenshots/07-mobile-390.png)

## Quick start

```bash
npm install
npm run validate      # schema and reference checks on data/
npm run build         # writes the pre-rendered site to dist/
node scripts/check-site.mjs   # one H1, unique titles/descriptions, JSON-LD, internal links, OG images
npm run check-links   # HTTP-checks every URL in data/ (writes link-report.json)
npm run preview       # http://localhost:4173/
npm run new-post -- "Title"   # new blog post skeleton in content/blog/ (see "Blog" below)
npm run news -- --days 7      # digest of official AWS/Azure/Google Cloud news feeds (data/news-feeds.yaml)
```

Requires Node 20 or later. The build needs no network access and no paid services. Open Graph images are rendered locally with `@resvg/resvg-js` using the bundled DejaVu fonts.

## Configuration

`site.config.json` holds every deploy-specific value in one place:

| key | purpose |
|---|---|
| `baseUrl` | Canonical origin, used for canonical URLs, sitemap, OG URLs, and JSON-LD. `https://cloudequivalents.com` (custom domain set in GitHub Pages settings; no CNAME file is needed because the site deploys via Actions). For a GitHub Pages project-site URL such as `https://<user>.github.io/<repo>`, the path prefix is applied automatically. |
| `repoUrl` / `repoBranch` | Target of the "Edit on GitHub" and "Report an error" links. `https://github.com/cameron-keene/cloudequivalents` |
| `activeProviders` | Provider columns to render. Each must also be `enabled` in `data/providers.yaml`. |
| `analytics` | Optional cookieless analytics. Leave `provider` empty to emit nothing. Cloudflare Web Analytics: `{"provider": "cloudflare", "token": "<beacon token>"}`. GoatCounter: `{"provider": "goatcounter", "code": "<site code>"}` (the `<code>` part of `https://<code>.goatcounter.com`). The script is added just before `</body>` on every page with `defer`, so it causes no layout shift. |

## Site structure

| URL | What |
|---|---|
| `/` | Interactive matrix with one section per category: collapsible groups (Expand/Collapse all, remembered), Cmd/Ctrl+K search, category/group/exam/match filters, jump-to-category and jump-to-group nav, detail drawer, and a Matrix/Cards toggle. Filter state is kept in the URL (`?q=&cat=&group=&exam=&match=&view=cards`). Without JavaScript it's a plain server-rendered table. |
| `/compare/aws-<slug>-vs-azure-<slug>/` | One fully pre-rendered page per mapping. Each has a direct answer, an HTML comparison table, differences, pricing, exams, FAQ, related links, sources, a last-verified date, and an edit link. |
| `/aws/<service>/` and `/azure/<service>/` | Hub pages ("Azure equivalent of X" and the reverse) |
| `/aws/`, `/azure/` | Service indexes |
| `/category/` and `/category/<id>/` | Category index and per-category overviews (groups are collapsible) |
| `/exams/` | Certification exams mapped to comparisons, plus the exam-guide index |
| `/exams/<code>-for-aws-engineers/` | Azure exam guides for AWS engineers (AZ-900, AZ-104, AZ-305, AZ-400, SC-500, AI-901, AI-200, AI-103, AI-300, DP-300): official domains and weights, how each domain maps to AWS, linked compare pages, gotchas, closest AWS cert, last-verified date |
| `/about/` | Methodology |
| `/blog/`, `/blog/page/<n>/` | Blog index, newest first, 10 posts per page (shows an empty state when there are no posts) |
| `/blog/<slug>/` | One page per published post, with BlogPosting JSON-LD, an OG image, related comparisons, and a sources list |
| `/blog/feed.xml` | Atom feed of the latest 20 posts, linked from every page's `<head>` |

SEO and performance features:

- per-page `<title>`, meta description, and canonical URL
- Open Graph and Twitter cards with a per-page 1200×630 PNG
- JSON-LD (BreadcrumbList, TechArticle, FAQPage, plus WebSite/ItemList/CollectionPage where relevant)
- `sitemap.xml`, `robots.txt`, and a `noindex` 404 page
- system fonts only, with no layout shift
- content pages ship one ~300-byte inline script; the matrix JS (~6 KB) loads only on `/`, and drawer data (`/data/rows-<category>.json`) loads only when the drawer is first opened for that category

## Data layout (one file per category, PR-friendly)

```
data/
  providers.yaml          # provider registry (aws, azure, gcp, oci*); *disabled
  exams.yaml              # certification exams, status (current/beta/retiring/retired), notes
  services/<provider>/<category>.yaml   # one entry per service: slug, name, status, status_note, summary, docs, pricing
                                        # (slugs are unique per provider across all files)
  categories/<category>.yaml            # category metadata (id, name, short, order, groups) and the mapping rows
  exam-guides/<code>.yaml               # exam guide for AWS engineers: domains (name, weight, official areas, aws, rows), gotchas,
                                        # closest_aws, sources, last_verified (row ids and exam codes are validated)
```

A row (`data/categories/*.yaml`):

```yaml
- id: foundation-model-api          # stable id (used for anchors and "related")
  slug: optional-override           # optional; default is aws-<svc>-vs-azure-<svc>
  group: genai
  capability: Foundation model API platform
  what_for: One plain-language sentence about what you'd use it for.
  match: direct | partial | none
  answer: One-sentence direct answer first. Optional extra sentences.
  providers: { aws: [bedrock], azure: [foundry-models, foundry] }   # service slugs, primary first
  differences: [ ... ]
  pricing: { aws: "...model, no numbers...", azure: "..." }
  exams: { aws: [AIF-C01], azure: [AI-103] }
  faq: [ { q: ..., a: ... } ]       # optional; 2-3 FAQs are also derived automatically
  related: [model-customization]
  sources: [ https://docs.aws.amazon.com/..., https://learn.microsoft.com/... ]
  flags: [ "Anything not fully verified goes here" ]   # shown as "Verification notes"
```

Service URL segments drop a redundant provider prefix (`azure-language` becomes `/azure/language/`). `npm run validate` fails the build on any of these:

- an unknown service, exam, group, or related id
- an unused service
- a missing required field
- a duplicate compare slug

## Adding a provider (GCP, OCI, …)

Google Cloud is added per category, through a `gcp:` block on each row, so AWS↔Azure data and URLs never change:

```yaml
category:
  gcp_last_verified: "2026-10-27"   # turns on the GCP column for this category; every row then needs a gcp block
rows:
  - id: ml-platform
    # ...existing AWS/Azure fields...
    gcp:
      services: [agent-platform]     # slugs from data/services/gcp/<category>.yaml ([] when match is none)
      match: direct                  # direct | partial | none, rated against the AWS service
      answer: One or two sentences.
      differences: [ ... ]
      pricing: Pricing model only, no prices.
      sources: [ https://docs.cloud.google.com/... ]   # official Google (or AWS) URLs only
      flags: [ ... ]                 # optional verification notes
      slug: aws-x-vs-gcp-y           # optional; defaults to aws-<aws service>-vs-gcp-<gcp service>
```

Each GCP-mapped row gets an extra page at `/compare/aws-<service>-vs-gcp-<service>/`, a third column on its AWS↔Azure compare page, and a GCP cell (with its own match badge) in the matrix. GCP service hubs live under `/gcp/<service>/`. Categories without `gcp_last_verified` keep the two-column layout.

A future provider follows the same steps: services in `data/services/<id>/`, `enabled: true` in `data/providers.yaml`, and the id in `activeProviders`.

## Adding a category

Create `data/categories/<id>.yaml` with a `category:` block (`id`, `name`, `short`, `order`, `description`, optional `seo_description`, `last_verified`, `groups`) and `rows:`. Put new services in `data/services/<provider>/<id>.yaml`. Group ids must be unique across all categories. A service already defined in another category's file can be reused by slug. The nav, home matrix, category pages, hubs, exams page, and sitemap pick up the new category automatically.

## Blog

Posts are Markdown files in `content/blog/`, built into `/blog/<slug>/`, the `/blog/` index, the Atom feed at `/blog/feed.xml`, and the sitemap.

### Post format

File name: `content/blog/YYYY-MM-DD-slug.md`. The slug (lowercase letters, digits, hyphens) becomes the URL `/blog/slug/`, and the date in the file name must match `date:`.

```markdown
---
title: "AWS, Azure and Google Cloud: week of Nov 2, 2026"
date: 2026-11-02
description: "50-160 characters. Used as the meta description, the social card text, and the lead paragraph."
tags: [weekly, aws, azure, gcp]          # lowercase
compares: [object-storage, key-management]  # optional: row ids from data/categories/*.yaml, shown as "Related comparisons"
sources:                                 # required: every source the post relies on, shown as a "Sources" list
  - title: "Amazon S3 now supports ..."
    url: https://aws.amazon.com/about-aws/whats-new/2026/11/...
  - title: "Azure Updates: ..."
    url: https://azure.microsoft.com/en-us/updates/...
updated: 2026-11-03                      # optional, YYYY-MM-DD
draft: true                              # optional; see Drafts
---

Opening paragraph. Start sections at "## " (the title is the page's only h1).

## What changed

Link comparison pages with root-relative links: [Amazon S3 vs Azure Blob Storage](/compare/aws-s3-vs-azure-blob-storage/).
```

- Body is GitHub-flavored Markdown (tables, fenced code, lists, links). Raw HTML is escaped, not rendered.
- Internal links (`/compare/...`, `/aws/...`, `/exams/...`) are checked by `scripts/check-site.mjs`, so a broken link fails the checks.
- `npm run validate` rejects a published post that is missing a field, has a description outside 50-160 characters, has no sources or a non-https source, references an unknown `compares` row, uses a `# ` heading, or still contains `TODO` or `example.com` placeholders.
- Posts dated in the future (UTC build date) are skipped until that date. `BUILD_DATE=YYYY-MM-DD npm run build` overrides the date for a preview.

### Drafts

A post is a draft, and is never built, listed, or added to the feed or sitemap, if any of these is true:

- its front matter has `draft: true`
- it lives under `content/blog/drafts/`
- its file name starts with `_`

Drafts are still checked by `npm run validate`, but problems are printed as warnings and never fail the build. To publish a draft, remove `draft: true` (or move the file out of `drafts/`) and fix any warnings.

### Publishing flow

Drafting happens on a branch named `blog/YYYY-MM-DD`; publishing means merging that branch to `main`. Only `main` deploys. The `Check` workflow builds every `blog/**` push and pull request and uploads the built site as a `site-preview` artifact for review.

```bash
D=$(TZ=America/Chicago date +%F)                 # e.g. 2026-11-02
git fetch origin && git switch -c "blog/$D" origin/main
npm ci
npm run news -- --check                          # all feeds reachable and valid
npm run news -- --days 7 > /tmp/news-$D.md       # or --json; feed text is untrusted, verify on the linked page
npm run new-post -- "AWS, Azure and Google Cloud: week of $(TZ=America/Chicago date '+%b %-d, %Y')" --tags weekly,aws,azure,gcp
# ...write the post in content/blog/$D-<slug>.md (or start with --draft and remove draft: true when ready)...
npm run validate && npm run build && node scripts/check-site.mjs && npm run check-links
npm run preview                                  # http://localhost:4173/blog/<slug>/
git add content/blog && git commit -m "Blog: <title>"
git push -u origin "blog/$D"
gh pr create --base main --head "blog/$D" --title "Blog: <title>" --body "Draft for review"
# after approval:
gh pr merge "blog/$D" --merge --delete-branch     # merging to main publishes (Pages deploy + IndexNow)
```

### News feeds

`data/news-feeds.yaml` lists official provider feeds (AWS What's New, AWS News Blog, Azure Updates, Azure Blog, Microsoft Skills Hub certification news, Google Cloud release notes, Google Cloud Blog, and more), each with its `format` (rss or atom), `kind`, and the date it was last verified. `npm run news` reads them:

| command | output |
|---|---|
| `npm run news` | Markdown digest of the last 7 days, grouped by provider |
| `npm run news -- --days 14 --json` | JSON array of `{feed, provider, kind, date, title, link, summary}` |
| `npm run news -- --since 2026-10-21 --provider aws,gcp --kind announcements,release-notes` | Filtered digest |
| `npm run news -- --check` | Verifies every feed parses and has entries (exit 1 otherwise) |

Add only feeds the provider publishes itself, and record `verified:` after checking them with `--check`.

## Verification policy

- Every claim must be traceable to an official AWS or Microsoft page listed in `sources`, `docs`, or `pricing`.
- Lifecycle states come from vendor lifecycle and retirement pages. Retired services stay listed (marked retired), because people migrating still meet them.
- Never quote prices. Describe the billing model and link the official pricing page.
- If something can't be confirmed, add a `flags:` entry instead of stating it as fact.
- Bump `last_verified` only after re-checking the row's sources.

## Disclaimer

Community-maintained and not affiliated with Amazon Web Services or Microsoft. Product names are trademarks of their owners. Verify against the official documentation before making architecture, purchasing, or exam decisions.

## License

MIT (see `LICENSE`). Copyright (c) 2026 Cameron Keene.

## Change log, newsletter, analytics and AI agents

- **What changed** (`/changes/`, Atom at `/changes/feed.xml`): add an entry to `data/changes.yaml` (`date: 'YYYY-MM-DD'`, `title`, `summary`, optional `links` and `commit`). One entry per date; `npm run validate` checks it.
- **Newsletter signup** (blog, blog posts, change log): set `site.config.json` → `"newsletter": { "provider": "buttondown", "url": "https://buttondown.com/api/emails/embed-subscribe/<username>" }`. Empty provider renders nothing.
- **Analytics**: `"analytics": { "provider": "goatcounter", "code": "<site code>" }` adds GoatCounter's script to every page (`https://<code>.goatcounter.com/count`). `aiReferrers` lists AI assistant hosts; `npm run ai-referrers -- export.csv` counts AI-referred visits in a GoatCounter CSV export.
- **For AI agents**: `robots.txt` explicitly allows search and AI crawlers, `/llms.txt` points to the dataset, hubs, exams, blog and change log, and `/api/v1/mappings.json` / `.csv` hold all mappings. IndexNow is pinged after every deploy.
