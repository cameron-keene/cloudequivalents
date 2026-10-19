// Build-time Open Graph image generator (SVG -> PNG with resvg). No external services.
import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function wrap(text, max, lines) {
  const words = String(text).split(/\s+/); const out = []; let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) { out.push(cur); cur = w; } else cur = (cur + ' ' + w).trim();
  }
  if (cur) out.push(cur);
  if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, '') + '…'; }
  return out;
}

export function makeOgRenderer(root) {
  const fontFiles = ['DejaVuSans.ttf', 'DejaVuSans-Bold.ttf'].map((f) => path.join(root, 'assets/fonts', f));
  return function render({ kicker, title, subtitle, badge, siteName }, outFile) {
    const tl = wrap(title, 30, 3);
    const sl = wrap(subtitle || '', 62, 3);
    const titleY = 230;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b1220"/><stop offset="1" stop-color="#131c2e"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="0" y="0" width="600" height="10" fill="#ff9900"/><rect x="600" y="0" width="600" height="10" fill="#3b8eea"/>
  <text x="72" y="120" font-family="DejaVu Sans" font-weight="bold" font-size="30" fill="#8fb4ff">${esc(kicker)}</text>
  ${tl.map((l, i) => `<text x="72" y="${titleY + i * 74}" font-family="DejaVu Sans" font-weight="bold" font-size="62" fill="#f2f5fa">${esc(l)}</text>`).join('\n  ')}
  ${sl.map((l, i) => `<text x="72" y="${titleY + tl.length * 74 + 20 + i * 40}" font-family="DejaVu Sans" font-size="30" fill="#b7c2d3">${esc(l)}</text>`).join('\n  ')}
  <text x="72" y="580" font-family="DejaVu Sans" font-weight="bold" font-size="30" fill="#f2f5fa">${esc(siteName)}</text>
  ${badge ? `<rect x="${1128 - badge.length * 19 - 40}" y="545" rx="22" width="${badge.length * 19 + 40}" height="48" fill="#1f2a40" stroke="#3a4a68"/><text x="${1128 - 20}" y="579" text-anchor="end" font-family="DejaVu Sans" font-weight="bold" font-size="28" fill="#f2f5fa">${esc(badge)}</text>` : ''}
</svg>`;
    const png = new Resvg(svg, { font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'DejaVu Sans' }, fitTo: { mode: 'width', value: 1200 } }).render().asPng();
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, png);
  };
}
