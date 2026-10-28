// Loads and validates all YAML data. Shared by build.mjs and validate.mjs.
import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => yaml.load(fs.readFileSync(path.join(ROOT, p), 'utf8'));

// URL segment for a service: drop a redundant provider prefix ("azure-language" -> "language").
export function serviceSeg(provider, slug) {
  const prefixes = { aws: ['aws-', 'amazon-'], azure: ['azure-'], gcp: ['gcp-', 'google-'], oci: ['oci-', 'oracle-'] }[provider] || [];
  for (const p of prefixes) if (slug.startsWith(p) && slug.length > p.length) return slug.slice(p.length);
  return slug;
}

export function loadData() {
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
  const allProviders = read('data/providers.yaml');
  const providers = allProviders.filter((p) => p.enabled && config.activeProviders.includes(p.id));
  const exams = new Map(read('data/exams.yaml').map((e) => [e.code, e]));
  const services = {};
  const errors = [];
  for (const p of providers) {
    // Services live in data/services/<provider>.yaml and/or data/services/<provider>/*.yaml (one file per category).
    const files = [];
    if (fs.existsSync(path.join(ROOT, `data/services/${p.id}.yaml`))) files.push(`data/services/${p.id}.yaml`);
    const dir = path.join(ROOT, `data/services/${p.id}`);
    if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.yaml')).sort()) files.push(`data/services/${p.id}/${f}`);
    services[p.id] = new Map();
    for (const file of files) for (const s of read(file) || []) {
      if (services[p.id].has(s.slug)) errors.push(`${p.id}: duplicate service slug ${s.slug} (${file})`);
      services[p.id].set(s.slug, { ...s, provider: p.id, seg: serviceSeg(p.id, s.slug), file });
    }
  }
  const categories = fs.readdirSync(path.join(ROOT, 'data/categories')).filter((f) => f.endsWith('.yaml')).sort()
    .map((f) => { const d = read(`data/categories/${f}`); return { ...d.category, file: `data/categories/${f}`, rows: d.rows }; })
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const gids = new Set();
  for (const c of categories) for (const g of c.groups) { if (gids.has(g.id)) errors.push(`duplicate group id ${g.id} (${c.id})`); gids.add(g.id); }

  const [pa, pb] = providers; // primary comparison pair (AWS, Azure)
  const slugs = new Map();
  const rowIds = new Set();
  for (const cat of categories) {
    const groupIds = new Set(cat.groups.map((g) => g.id));
    for (const r of cat.rows) {
      r.category = cat.id;
      if (rowIds.has(r.id)) errors.push(`duplicate row id ${r.id}`);
      rowIds.add(r.id);
      if (!groupIds.has(r.group)) errors.push(`${r.id}: unknown group ${r.group}`);
      if (!['direct', 'partial', 'none'].includes(r.match)) errors.push(`${r.id}: bad match ${r.match}`);
      for (const f of ['capability', 'what_for', 'answer', 'differences', 'pricing', 'sources']) if (!r[f] || (Array.isArray(r[f]) && !r[f].length)) errors.push(`${r.id}: missing ${f}`);
      // Google Cloud column: a per-row "gcp:" block, required in categories that set gcp_last_verified.
      const gcpOn = providers.some((p) => p.id === 'gcp');
      if (r.gcp && !cat.gcp_last_verified) errors.push(`${r.id}: has a gcp block but category ${cat.id} has no gcp_last_verified`);
      if (gcpOn && cat.gcp_last_verified && !r.gcp) errors.push(`${r.id}: missing gcp block (category ${cat.id} is GCP-verified)`);
      if (r.gcp) {
        if (!['direct', 'partial', 'none'].includes(r.gcp.match)) errors.push(`${r.id}: bad gcp.match ${r.gcp.match}`);
        for (const f of ['answer', 'differences', 'pricing', 'sources']) if (!r.gcp[f] || (Array.isArray(r.gcp[f]) && !r.gcp[f].length)) errors.push(`${r.id}: missing gcp.${f}`);
        if (r.gcp.match !== 'none' && !(r.gcp.services || []).length) errors.push(`${r.id}: gcp.match ${r.gcp.match} needs gcp.services`);
        for (const u of r.gcp.sources || []) if (!/^https:\/\/([a-z0-9-]+\.)*(cloud\.google\.com|google\.com|antigravity\.google|aws\.amazon\.com)\//.test(u)) errors.push(`${r.id}: gcp source not an official Google/AWS URL: ${u}`);
        r.providers = { ...r.providers, gcp: r.gcp.services || [] };
        r.pricing = { ...r.pricing, gcp: r.gcp.pricing };
      }
      r.svc = {};
      for (const p of providers) {
        r.svc[p.id] = (r.providers?.[p.id] || []).map((s) => {
          const svc = services[p.id].get(s);
          if (!svc) errors.push(`${r.id}: unknown ${p.id} service ${s}`);
          return svc;
        }).filter(Boolean);
      }
      for (const p of Object.keys(r.exams || {})) for (const e of r.exams[p] || []) if (!exams.has(e)) errors.push(`${r.id}: unknown exam ${e}`);
      if (!r.slug) {
        const a = r.svc[pa.id][0], b = r.svc[pb.id][0];
        r.slug = `${pa.id}-${a ? a.seg : 'none'}-vs-${pb.id}${b ? '-' + b.seg : ''}`;
      }
      if (slugs.has(r.slug)) errors.push(`compare slug collision ${r.slug}: ${slugs.get(r.slug)} and ${r.id}. Add "slug:" to one row.`);
      slugs.set(r.slug, r.id);
      r.url = `/compare/${r.slug}/`;
      if (r.gcp && gcpOn) {
        const a = r.svc[pa.id][0], g = r.svc.gcp[0];
        let gs = r.gcp.slug || `${pa.id}-${a ? a.seg : 'none'}-vs-gcp${g ? '-' + g.seg : ''}`;
        if (!r.gcp.slug && slugs.has(gs)) gs = `${r.id}-${pa.id}-vs-gcp`;
        if (slugs.has(gs)) errors.push(`gcp compare slug collision ${gs}: ${slugs.get(gs)} and ${r.id}. Add "gcp.slug:".`);
        slugs.set(gs, r.id);
        r.gcpSlug = gs; r.gcpUrl = `/compare/${gs}/`;
      }
    }
  }
  const rowsById = new Map(categories.flatMap((c) => c.rows).map((r) => [r.id, r]));
  for (const r of rowsById.values()) for (const rel of r.related || []) if (!rowsById.has(rel)) errors.push(`${r.id}: unknown related ${rel}`);
  for (const p of providers) {
    const segs = new Set();
    for (const s of services[p.id].values()) {
      if (segs.has(s.seg)) errors.push(`${p.id}: duplicate service URL segment ${s.seg}`);
      segs.add(s.seg);
      s.url = `/${p.id}/${s.seg}/`;
      s.rows = [...rowsById.values()].filter((r) => (r.providers?.[p.id] || []).includes(s.slug));
      if (!s.rows.length) errors.push(`${p.id}: service ${s.slug} is not used by any row`);
    }
  }
  // Exam guides for cloud switchers: data/exam-guides/<code>.yaml -> /exams/<code>-for-aws-engineers/
  const examGuides = new Map();
  const gdir = path.join(ROOT, 'data/exam-guides');
  if (fs.existsSync(gdir)) for (const f of fs.readdirSync(gdir).filter((f) => f.endsWith('.yaml')).sort()) {
    const g = read(`data/exam-guides/${f}`);
    const where = `exam guide ${f}`;
    if (!exams.has(g.code)) errors.push(`${where}: unknown exam ${g.code}`);
    for (const k of ['title', 'last_verified', 'study_guide', 'summary', 'audience', 'domains', 'gotchas', 'sources']) if (!g[k] || (Array.isArray(g[k]) && !g[k].length)) errors.push(`${where}: missing ${k}`);
    for (const d of g.domains || []) {
      if (!d.name || !/^\d+–\d+%$/.test(d.weight || '')) errors.push(`${where}: domain needs name and weight like 20–25% (${d.name})`);
      for (const id of d.rows || []) if (!rowsById.has(id)) errors.push(`${where}: unknown row ${id}`);
    }
    for (const c of g.closest_aws || []) if (!exams.has(c.code)) errors.push(`${where}: unknown AWS exam ${c.code}`);
    g.file = `data/exam-guides/${f}`;
    g.slug = `${g.code.toLowerCase()}-for-aws-engineers`;
    g.url = `/exams/${g.slug}/`;
    if (examGuides.has(g.code)) errors.push(`${where}: duplicate guide for ${g.code}`);
    examGuides.set(g.code, g);
  }
  const sortedGuides = new Map([...examGuides.entries()].sort((a, b) => (a[1].order ?? 99) - (b[1].order ?? 99)));
  return { ROOT, config, providers, allProviders, exams, services, categories, rowsById, examGuides: sortedGuides, errors };
}
