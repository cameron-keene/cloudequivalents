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
  for (const p of providers) {
    const list = read(`data/services/${p.id}.yaml`) || [];
    services[p.id] = new Map(list.map((s) => [s.slug, { ...s, provider: p.id, seg: serviceSeg(p.id, s.slug) }]));
  }
  const categories = fs.readdirSync(path.join(ROOT, 'data/categories')).filter((f) => f.endsWith('.yaml')).sort()
    .map((f) => { const d = read(`data/categories/${f}`); return { ...d.category, file: `data/categories/${f}`, rows: d.rows }; });

  const errors = [];
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
  return { ROOT, config, providers, allProviders, exams, services, categories, rowsById, errors };
}
