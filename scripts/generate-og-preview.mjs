import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');

const OG_W = 1200;
const OG_H = 630;

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function main() {
  const logoPath = path.join(PUBLIC_DIR, 'logo.svg');
  const outPngPath = path.join(PUBLIC_DIR, 'og-preview.png');

  const logoSvg = await fs.readFile(logoPath, 'utf8');
  const logoB64 = Buffer.from(logoSvg).toString('base64');

  const title = 'AgriResolve AI';
  const subtitle = 'Instant crop health diagnostics\nwith explainable multi-agent analysis';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#052e16"/>
      <stop offset="100%" stop-color="#166534"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#84cc16" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#f97316" stop-opacity="0.12"/>
    </linearGradient>
  </defs>

  <rect width="100%" height="100%" fill="url(#bg)"/>
  <rect x="0" y="0" width="100%" height="100%" fill="url(#glow)"/>

  <g opacity="0.25">
    <circle cx="980" cy="120" r="160" fill="#84cc16" opacity="0.18" />
    <circle cx="1060" cy="510" r="220" fill="#f97316" opacity="0.12" />
  </g>

  <g>
    <rect x="72" y="86" width="1056" height="458" rx="28" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" />
  </g>

  <image href="data:image/svg+xml;base64,${logoB64}" x="120" y="175" width="280" height="280" />

  <text x="430" y="245" fill="#ffffff" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" font-size="64" font-weight="800">
    ${escapeHtml(title)}
  </text>

  ${subtitle
    .split('\n')
    .map((line, i) => {
      const y = 305 + i * 44;
      return `<text x="430" y="${y}" fill="rgba(255,255,255,0.90)" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" font-size="34" font-weight="600">${escapeHtml(line)}</text>`;
    })
    .join('\n')}

  <g>
    <rect x="430" y="410" width="520" height="58" rx="29" fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.16)" />
    <text x="456" y="448" fill="#ffffff" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" font-size="24" font-weight="700">
      Upload a leaf photo → Get guidance
    </text>
  </g>

  <text x="120" y="560" fill="rgba(255,255,255,0.70)" font-family="Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif" font-size="20" font-weight="600">
    Multilingual • Safety-first • Farmer-friendly
  </text>
</svg>`;

  await sharp(Buffer.from(svg))
    .png({ quality: 92 })
    .toFile(outPngPath);

  // eslint-disable-next-line no-console
  console.log(`Generated ${path.relative(ROOT, outPngPath)}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to generate og-preview.png', err);
  process.exit(1);
});
