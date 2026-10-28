import { loadData } from './data.mjs';
const d = loadData();
if (d.errors.length) { console.error(d.errors.join('\n')); process.exit(1); }
console.log(`OK: ${d.rowsById.size} rows, ${d.providers.map((p) => `${d.services[p.id].size} ${p.name} services`).join(', ')}, ${d.exams.size} exams, ${d.examGuides.size} exam guides`);
