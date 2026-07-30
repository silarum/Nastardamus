import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const output = new URL('../images/cards/minor/', import.meta.url);
const suits = [
  { id: 'wands', name: 'Жезлы', symbol: '✦', accent: '#f3a05b', glow: '#b647aa' },
  { id: 'cups', name: 'Кубки', symbol: '♢', accent: '#f0c56d', glow: '#744dd3' },
  { id: 'swords', name: 'Мечи', symbol: '†', accent: '#cbd5ff', glow: '#5e63d7' },
  { id: 'pentacles', name: 'Пентакли', symbol: '⛤', accent: '#e8bc59', glow: '#9b4bb9' }
];
const ranks = [
  ['ace', 'Туз', 1], ['two', 'Двойка', 2], ['three', 'Тройка', 3], ['four', 'Четвёрка', 4],
  ['five', 'Пятёрка', 5], ['six', 'Шестёрка', 6], ['seven', 'Семёрка', 7], ['eight', 'Восьмёрка', 8],
  ['nine', 'Девятка', 9], ['ten', 'Десятка', 10], ['page', 'Паж', 1], ['knight', 'Рыцарь', 2],
  ['queen', 'Королева', 3], ['king', 'Король', 4]
];

function points(count) {
  const layouts = {
    1: [[180, 280]],
    2: [[180, 220], [180, 340]],
    3: [[180, 180], [115, 330], [245, 330]],
    4: [[110, 205], [250, 205], [110, 345], [250, 345]],
    5: [[110, 190], [250, 190], [180, 280], [110, 370], [250, 370]],
    6: [[110, 175], [250, 175], [110, 280], [250, 280], [110, 385], [250, 385]],
    7: [[110, 160], [250, 160], [180, 245], [110, 320], [250, 320], [140, 405], [220, 405]],
    8: [[105, 155], [180, 155], [255, 155], [125, 260], [235, 260], [105, 365], [180, 365], [255, 365]],
    9: [[105, 150], [180, 150], [255, 150], [105, 260], [180, 260], [255, 260], [105, 370], [180, 370], [255, 370]],
    10: [[95, 145], [180, 145], [265, 145], [120, 235], [240, 235], [120, 325], [240, 325], [95, 415], [180, 415], [265, 415]]
  };
  return layouts[count] || layouts[Math.min(count, 10)];
}

function cardSvg(suit, rank, rankIndex) {
  const [id, label, count] = rank;
  const court = rankIndex >= 10;
  const glyphs = points(count).map(([x, y], index) =>
    `<text x="${x}" y="${y}" text-anchor="middle" class="sigil" opacity="${0.78 + (index % 3) * 0.08}">${suit.symbol}</text>`
  ).join('');
  const courtGlyph = court
    ? `<circle cx="180" cy="276" r="106" fill="none" stroke="url(#gold)" stroke-width="1.5" opacity=".68"/>
       <circle cx="180" cy="276" r="82" fill="none" stroke="${suit.glow}" stroke-width="1" opacity=".55"/>
       <text x="180" y="309" text-anchor="middle" class="court">${suit.symbol}</text>`
    : glyphs;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="600" viewBox="0 0 360 600" role="img" aria-label="${label} — ${suit.name}">
  <defs>
    <radialGradient id="bg"><stop stop-color="#281138"/><stop offset=".6" stop-color="#100a1d"/><stop offset="1" stop-color="#050710"/></radialGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0b3"/><stop offset=".45" stop-color="${suit.accent}"/><stop offset="1" stop-color="#79501d"/></linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="stars" width="53" height="61" patternUnits="userSpaceOnUse"><circle cx="8" cy="13" r=".8" fill="#fff1ba"/><circle cx="39" cy="44" r=".65" fill="#a77ef1"/></pattern>
    <style>
      .sigil{font:46px Georgia,serif;fill:url(#gold);filter:url(#glow)}
      .court{font:126px Georgia,serif;fill:url(#gold);filter:url(#glow)}
      .rank{font:600 24px Georgia,serif;fill:#ffe6a1;letter-spacing:1px}
      .suit{font:500 16px system-ui,sans-serif;fill:#c7b8d3;letter-spacing:3px;text-transform:uppercase}
    </style>
  </defs>
  <rect width="360" height="600" rx="22" fill="url(#bg)"/>
  <rect x="8" y="8" width="344" height="584" rx="17" fill="url(#stars)" opacity=".52" stroke="url(#gold)" stroke-width="2"/>
  <rect x="20" y="20" width="320" height="560" rx="12" fill="none" stroke="${suit.glow}" stroke-width="1" opacity=".7"/>
  <path d="M45 92Q180 28 315 92M45 508Q180 572 315 508" fill="none" stroke="url(#gold)" opacity=".56"/>
  <circle cx="180" cy="300" r="138" fill="${suit.glow}" opacity=".06"/>
  ${courtGlyph}
  <text x="180" y="67" text-anchor="middle" class="rank">${label}</text>
  <text x="180" y="548" text-anchor="middle" class="suit">${suit.name}</text>
  <text x="36" y="53" class="sigil" font-size="20">${suit.symbol}</text>
  <text x="324" y="565" text-anchor="end" class="sigil" font-size="20">${suit.symbol}</text>
</svg>`;
}

await mkdir(output, { recursive: true });
for (const suit of suits) {
  for (const [index, rank] of ranks.entries()) {
    await writeFile(join(output.pathname, `${rank[0]}-of-${suit.id}.svg`), cardSvg(suit, rank, index));
  }
}
