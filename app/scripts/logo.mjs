// Ever After mark: a heart drawn by two interlocking rings (blush + champagne) with a diamond glint.
// Geometry in a 200×200 box; tangent points computed so the heart sides meet the rings smoothly.

const C1 = { x: 78, y: 84 }, C2 = { x: 122, y: 84 }, R = 34, P = { x: 100, y: 158 };

function outerTangent(c, sign) {
  const dx = P.x - c.x, dy = P.y - c.y;
  const d = Math.hypot(dx, dy);
  const base = Math.atan2(dy, dx);
  const off = Math.acos(R / d);
  const a = base + sign * off;
  return { x: +(c.x + R * Math.cos(a)).toFixed(2), y: +(c.y + R * Math.sin(a)).toFixed(2) };
}

export function markSvg({ stroke = 12, glow = true, sparkle = true, id = "m", interlock = false } = {}) {
  const tl = outerTangent(C1, +1); // left ring, outer-left tangent
  const tr = outerTangent(C2, -1); // right ring, outer-right tangent
  // Intersection points of the two rings (x = 100)
  const h = Math.sqrt(R * R - ((C2.x - C1.x) / 2) ** 2);
  const bottomY = C1.y + h;
  // Short arc of the right ring around the lower intersection, redrawn on top for the interlock.
  const arcFrom = { x: 100 - 9, y: +(C2.y + Math.sqrt(R * R - (100 - 9 - C2.x) ** 2)).toFixed(2) };
  const arcTo = { x: 100 + 9, y: +(C2.y + Math.sqrt(R * R - (100 + 9 - C2.x) ** 2)).toFixed(2) };
  return `
  <defs>
    <linearGradient id="${id}-blush" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFD3DD"/><stop offset="1" stop-color="#EE8FA6"/>
    </linearGradient>
    <linearGradient id="${id}-gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFF0C9"/><stop offset="0.55" stop-color="#EBCB8B"/><stop offset="1" stop-color="#C99A4E"/>
    </linearGradient>
    ${glow ? `<filter id="${id}-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="5" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.6" flood-color="#1A0E26" flood-opacity="0.55"/>
    </filter>` : ""}
  </defs>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round" ${glow ? `filter="url(#${id}-glow)"` : ""}>
    <circle cx="${C2.x}" cy="${C2.y}" r="${R}" stroke="url(#${id}-gold)" stroke-width="${stroke}"/>
    <path d="M${tr.x} ${tr.y} L${P.x} ${P.y}" stroke="url(#${id}-gold)" stroke-width="${stroke}"/>
    <g ${glow ? `filter="url(#${id}-shadow)"` : ""}>
      <circle cx="${C1.x}" cy="${C1.y}" r="${R}" stroke="url(#${id}-blush)" stroke-width="${stroke}"/>
      <path d="M${tl.x} ${tl.y} L${P.x} ${P.y}" stroke="url(#${id}-blush)" stroke-width="${stroke}"/>
    </g>
    ${interlock ? `<path d="M${arcFrom.x} ${arcFrom.y} A${R} ${R} 0 0 1 ${arcTo.x} ${arcTo.y}" stroke="url(#${id}-gold)" stroke-width="${stroke}" ${glow ? `filter="url(#${id}-shadow)"` : ""}/>` : ""}
  </g>
  ${sparkle ? `<path d="M152 34 C153.4 42.6 155.4 44.6 164 46 C155.4 47.4 153.4 49.4 152 58 C150.6 49.4 148.6 47.4 140 46 C148.6 44.6 150.6 42.6 152 34 Z" fill="#FFFFFF" opacity="0.95"/>
  <circle cx="152" cy="46" r="2.2" fill="#FFFFFF"/>` : ""}`;
}

export function iconSvg(size = 1024, { maskable = false } = {}) {
  const pad = maskable ? 0.2 : 0.12;
  const markScale = (1 - pad * 2) * size / 200;
  const offset = size * pad;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5A2E5E"/><stop offset="0.55" stop-color="#36203F"/><stop offset="1" stop-color="#1B1229"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.42" r="0.5">
      <stop offset="0" stop-color="#F2A7B8" stop-opacity="0.38"/><stop offset="1" stop-color="#F2A7B8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <rect width="${size}" height="${size}" fill="url(#halo)"/>
  <g transform="translate(${offset} ${offset + size * 0.01}) scale(${markScale})">${markSvg({ id: "i" })}</g>
</svg>`;
}

export function splashSvg(w, h) {
  const mark = Math.min(w, h) * 0.34;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#3A1E3F"/><stop offset="1" stop-color="#1E1430"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.5" cy="0.45" r="0.45">
      <stop offset="0" stop-color="#F2A7B8" stop-opacity="0.25"/><stop offset="1" stop-color="#F2A7B8" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
  <rect width="${w}" height="${h}" fill="url(#halo)"/>
  <g transform="translate(${(w - mark) / 2} ${h * 0.45 - mark / 2}) scale(${mark / 200})">${markSvg({ id: "s" })}</g>
</svg>`;
}
