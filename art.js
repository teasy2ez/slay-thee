// ============================================================================
// ART.JS — Zero-Asset Procedural & Semantic Inline SVG Art Engine (<16 KB)
// Generates unique, deterministic, minimalist vector glyphs for every card,
// relic, potion, enemy, boss, operative class, event, room, status & intent.
// ============================================================================

const svgCache = new Map();

/**
 * Deterministic 32-bit FNV-1a hash so every entity ID produces unique geometry.
 */
function hashId(str = '') {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Extracts deterministic pseudo-random numbers in [0, 1) from a hash.
 */
function prng(seed, idx) {
  let x = (seed + idx * 0x9e3779b9) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function wrapSvg(body, cls = 'art-svg', vb = '0 0 48 48') {
  return `<svg class="${cls}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
}

function polyPoints(cx, cy, r, sides, rotDeg = 0) {
  const pts = [];
  const rad = (rotDeg * Math.PI) / 180;
  for (let i = 0; i < sides; i++) {
    const a = rad + (i * 2 * Math.PI) / sides;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function microCircuitLayer(h, accent, cx = 24, cy = 24) {
  const corners = [
    [6, 6], [42, 6], [6, 42], [42, 42],
    [24, 5], [24, 43], [5, 24], [43, 24]
  ];
  let out = '';
  const count = 2 + (h % 3);
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(prng(h, i + 10) * corners.length);
    const [px, py] = corners[idx];
    const r = (1.1 + prng(h, i + 20) * 1.1).toFixed(1);
    out += `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="${accent}" stroke-opacity="0.22" stroke-width="0.9" stroke-dasharray="2 2"/>`;
    out += `<circle cx="${px}" cy="${py}" r="${r}" fill="${accent}" fill-opacity="0.6"/>`;
  }
  return out;
}

// ----------------------------------------------------------------------------
// 1. CARDS (126 RAW_CARDS + 3 CURSE_CARDS) — Semantic + Unique Micro-Geometry
// ----------------------------------------------------------------------------
export function getCardArtSvg(cardDef, upgraded = false) {
  if (!cardDef) return '';
  const id = cardDef.id || 'unknown';
  const key = `card:${id}:${upgraded ? 1 : 0}`;
  if (svgCache.has(key)) return svgCache.get(key);

  const h = hashId(id);
  const type = cardDef.type || 'skill';
  const desc = (cardDef.description || '').toLowerCase();
  const isUp = upgraded || Boolean(cardDef.upgraded);

  // Semantic primary palette
  let primary = '#38bdf8'; // skill cyan
  let secondary = '#7dd3fc';
  if (type === 'attack') {
    primary = '#ef4444';
    secondary = '#fb923c';
  } else if (type === 'power') {
    primary = '#eab308';
    secondary = '#fde047';
  } else if (type === 'curse' || cardDef.unplayable) {
    primary = '#d946ef';
    secondary = '#ef4444';
  } else if (desc.includes('corrode') || desc.includes('poison')) {
    primary = '#84cc16';
    secondary = '#bef264';
  } else if (cardDef.exhaust || desc.includes('exhaust') || desc.includes('void')) {
    primary = '#a855f7';
    secondary = '#d8b4fe';
  }

  const rot = Math.round(prng(h, 1) * 360);
  const innerSides = 3 + (h % 4); // 3..6
  let motif = '';

  if (type === 'curse' || cardDef.unplayable) {
    // Glitch / Static fractured core
    const y1 = 12 + (h % 8);
    const y2 = 26 + ((h >> 3) % 8);
    motif = `
      <rect x="10" y="10" width="28" height="28" fill="${primary}" fill-opacity="0.1" stroke="${primary}" stroke-width="1.5" stroke-dasharray="4 2"/>
      <line x1="7" y1="${y1}" x2="41" y2="${y1 + 2}" stroke="${secondary}" stroke-width="2"/>
      <line x1="9" y1="${y2}" x2="39" y2="${y2 - 3}" stroke="${primary}" stroke-width="1.6"/>
      <polygon points="${polyPoints(24, 24, 8, innerSides, rot)}" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="1.4"/>
    `;
  } else if (type === 'attack') {
    const hits = cardDef.hits || (desc.includes('2 times') ? 2 : desc.includes('3 times') ? 3 : 1);
    const isAoe = desc.includes('all enemies') || desc.includes('aoe');
    const tilt = -35 + Math.round(prng(h, 2) * 70);
    if (hits >= 2) {
      // Multi-hit twin/triple vectors
      const n = Math.min(4, hits);
      let blades = '';
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 7;
        blades += `<line x1="${12 + off}" y1="36" x2="${32 + off}" y2="12" stroke="${i % 2 === 0 ? primary : secondary}" stroke-width="2.4" stroke-linecap="round"/>`;
      }
      motif = `
        <g transform="rotate(${Math.round(tilt * 0.35)} 24 24)">${blades}</g>
        <polygon points="${polyPoints(24, 24, 7, innerSides, rot)}" fill="${primary}" fill-opacity="0.22" stroke="${secondary}" stroke-width="1.2"/>
      `;
    } else if (isAoe) {
      // Shockwave / Sweeping arc
      motif = `
        <circle cx="24" cy="24" r="14" fill="none" stroke="${primary}" stroke-width="1.8" stroke-dasharray="10 4"/>
        <path d="M9 28 Q24 8 39 28" fill="none" stroke="${secondary}" stroke-width="2.4" stroke-linecap="round"/>
        <polygon points="${polyPoints(24, 24, 6, innerSides, rot)}" fill="${primary}" fill-opacity="0.35" stroke="#fff" stroke-width="1.1"/>
      `;
    } else {
      // Single precision strike / heavy blade
      const w = (cardDef.baseDamage || 6) >= 12 ? 3.2 : 2.2;
      motif = `
        <g transform="rotate(${tilt} 24 24)">
          <polygon points="24,6 28,28 24,33 20,28" fill="${primary}" fill-opacity="0.3" stroke="${primary}" stroke-width="1.6"/>
          <line x1="17" y1="31" x2="31" y2="31" stroke="${secondary}" stroke-width="${w}" stroke-linecap="round"/>
          <line x1="24" y1="31" x2="24" y2="41" stroke="${secondary}" stroke-width="2"/>
        </g>
        <circle cx="24" cy="21" r="${2.5 + (h % 3)}" fill="${secondary}" fill-opacity="0.5"/>
      `;
    }
  } else if (type === 'power') {
    // Persistent reactor / aura core
    const rOuter = 13 + (h % 4);
    motif = `
      <polygon points="${polyPoints(24, 24, rOuter, 6, rot)}" fill="${primary}" fill-opacity="0.14" stroke="${primary}" stroke-width="1.6"/>
      <polygon points="${polyPoints(24, 24, 8, innerSides, -rot)}" fill="${secondary}" fill-opacity="0.3" stroke="#fff" stroke-width="1.2"/>
      <circle cx="24" cy="24" r="3" fill="${secondary}"/>
    `;
  } else {
    // Skill: Shield, Draw, Energy, Corrode, or Exhaust
    if ((cardDef.baseShield || 0) > 0 || desc.includes('shield')) {
      const rHex = 13 + (h % 3);
      motif = `
        <path d="M24 8 L38 14 V25 C38 33 24 40 24 40 C24 40 10 33 10 25 V14 Z" fill="${primary}" fill-opacity="0.16" stroke="${primary}" stroke-width="1.8"/>
        <polygon points="${polyPoints(24, 24, rHex - 5, innerSides, rot)}" fill="none" stroke="${secondary}" stroke-width="1.4"/>
      `;
    } else if (desc.includes('energy') || desc.includes('draw')) {
      // Lightning / Circuit surge
      const dx = (h % 5) - 2;
      motif = `
        <polygon points="${26 + dx},7 14,25 23,25 20,41 34,21 25,21" fill="${primary}" fill-opacity="0.28" stroke="${secondary}" stroke-width="1.6" stroke-linejoin="round"/>
        <circle cx="24" cy="24" r="16" fill="none" stroke="${primary}" stroke-opacity="0.3" stroke-dasharray="3 4"/>
      `;
    } else {
      // Tactical / Debuff / Void skill
      motif = `
        <circle cx="24" cy="24" r="13" fill="${primary}" fill-opacity="0.14" stroke="${primary}" stroke-width="1.6"/>
        <polygon points="${polyPoints(24, 24, 9, innerSides, rot)}" fill="none" stroke="${secondary}" stroke-width="1.6"/>
        <circle cx="24" cy="24" r="2.8" fill="${secondary}"/>
      `;
    }
  }

  // Unique orbital pip & optional upgrade (+) corner crest
  const pipAngle = prng(h, 5) * Math.PI * 2;
  const pipX = (24 + 17 * Math.cos(pipAngle)).toFixed(1);
  const pipY = (24 + 17 * Math.sin(pipAngle)).toFixed(1);
  const pip = `<circle cx="${pipX}" cy="${pipY}" r="1.8" fill="${secondary}"/>`;
  const upgBadge = isUp
    ? `<path d="M35 7 H41 V13 M38 10 L42 6" stroke="#4ade80" stroke-width="1.6" fill="none"/><circle cx="24" cy="24" r="19" fill="none" stroke="#4ade80" stroke-opacity="0.35" stroke-width="1"/>`
    : '';

  const svg = wrapSvg(microCircuitLayer(h, primary) + motif + pip + upgBadge, 'art-svg card-art-svg');
  svgCache.set(key, svg);
  return svg;
}

// ----------------------------------------------------------------------------
// 2. RELICS (65 Relics) — Unique Cyber-Artifact Sigils
// ----------------------------------------------------------------------------
export function getRelicArtSvg(relicDef) {
  if (!relicDef) return '';
  const id = relicDef.id || 'relic';
  const key = `relic:${id}`;
  if (svgCache.has(key)) return svgCache.get(key);

  const h = hashId(id);
  const hooks = relicDef.hooks ? Object.keys(relicDef.hooks).join(',') : '';
  let color = '#eab308'; // gold default
  if (hooks.includes('Damage') || hooks.includes('Attack')) color = '#ef4444';
  else if (hooks.includes('Shield') || hooks.includes('Block')) color = '#38bdf8';
  else if (hooks.includes('Exhaust') || hooks.includes('Void')) color = '#a855f7';
  else if (hooks.includes('Heal') || hooks.includes('Corrode')) color = '#4ade80';

  const outerSides = 5 + (h % 4); // 5..8
  const innerSides = 3 + ((h >> 3) % 4); // 3..6
  const rot = Math.round(prng(h, 1) * 360);
  const hasRing = (h & 1) === 1;

  const body = `
    ${microCircuitLayer(h, color)}
    <polygon points="${polyPoints(24, 24, 15, outerSides, rot)}" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-width="1.7"/>
    ${hasRing ? `<circle cx="24" cy="24" r="10" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="1.1" stroke-dasharray="4 2"/>` : ''}
    <polygon points="${polyPoints(24, 24, 7.5, innerSides, -rot)}" fill="${color}" fill-opacity="0.45" stroke="#fff" stroke-width="1.2"/>
    <circle cx="24" cy="24" r="2.2" fill="#fff"/>
  `;
  const svg = wrapSvg(body, 'art-svg relic-art-svg');
  svgCache.set(key, svg);
  return svg;
}

// ----------------------------------------------------------------------------
// 3. POTIONS (34 Potions) — Distinct Flask Silhouettes & Liquid Colors
// ----------------------------------------------------------------------------
export function getPotionArtSvg(potionDef) {
  if (!potionDef) return '';
  const id = potionDef.id || 'potion';
  const key = `potion:${id}`;
  if (svgCache.has(key)) return svgCache.get(key);

  const h = hashId(id);
  const desc = (potionDef.description || '').toLowerCase();
  let liquid = '#38bdf8';
  if (desc.includes('damage') || desc.includes('strength')) liquid = '#ef4444';
  else if (desc.includes('heal') || desc.includes('hp') || desc.includes('corrode')) liquid = '#4ade80';
  else if (desc.includes('energy') || desc.includes('gold') || desc.includes('upgrade')) liquid = '#eab308';
  else if (desc.includes('draw') || desc.includes('void') || desc.includes('exhaust')) liquid = '#a855f7';

  const shape = h % 3; // 0: round flask, 1: conical Erlenmeyer, 2: hex ampoule
  let glass = '';
  let fill = '';
  if (shape === 0) {
    glass = `<path d="M20 8 H28 V14 L36 24 A13 13 0 1 1 12 24 L20 14 Z" fill="none" stroke="#e4e4e7" stroke-width="1.7"/>`;
    fill = `<path d="M13 27 A11 11 0 0 0 35 27 Z" fill="${liquid}" fill-opacity="0.72"/>`;
  } else if (shape === 1) {
    glass = `<path d="M20 8 H28 V15 L38 38 H10 L20 15 Z" fill="none" stroke="#e4e4e7" stroke-width="1.7" stroke-linejoin="round"/>`;
    fill = `<polygon points="13,36 35,36 31,26 17,26" fill="${liquid}" fill-opacity="0.75"/>`;
  } else {
    glass = `<polygon points="20,8 28,8 28,13 36,19 36,34 24,41 12,34 12,19 20,13" fill="none" stroke="#e4e4e7" stroke-width="1.7"/>`;
    fill = `<polygon points="14,25 34,25 34,33 24,39 14,33" fill="${liquid}" fill-opacity="0.72"/>`;
  }

  const b1x = 19 + (h % 9);
  const b2x = 18 + ((h >> 2) % 10);
  const body = `
    <rect x="19" y="5" width="10" height="3" fill="${liquid}" fill-opacity="0.8"/>
    ${fill}
    ${glass}
    <circle cx="${b1x}" cy="31" r="1.6" fill="#fff" fill-opacity="0.8"/>
    <circle cx="${b2x}" cy="23" r="1.1" fill="${liquid}"/>
  `;
  const svg = wrapSvg(body, 'art-svg potion-art-svg');
  svgCache.set(key, svg);
  return svg;
}

// ----------------------------------------------------------------------------
// 4. ENEMIES & BOSSES (4 Archetypes + 3 Bosses + Elite/Anomaly Variants)
// ----------------------------------------------------------------------------
export function getEnemyArtSvg(enemy) {
  if (!enemy) return '';
  const name = (enemy.name || '').toUpperCase();
  const baseId = enemy.archetypeId || enemy.id?.replace(/_\d+$/, '') || 'sentinel_drone';
  const isBoss = Boolean(enemy.isBoss);
  const isAnomaly = name.includes('[ANOMALY]');
  const isElite = name.includes('[ELITE]');
  const key = `enemy:${baseId}:${isBoss ? 1 : 0}:${isAnomaly ? 1 : 0}:${isElite ? 1 : 0}`;
  if (svgCache.has(key)) return svgCache.get(key);

  let core = '';
  if (baseId === 'overlord_core') {
    core = `
      <polygon points="14,10 19,5 24,10 29,5 34,10 32,14 16,14" fill="#eab308"/>
      <polygon points="${polyPoints(24, 27, 15, 8, 22.5)}" fill="#ef4444" fill-opacity="0.18" stroke="#ef4444" stroke-width="1.8"/>
      <circle cx="24" cy="27" r="7" fill="#18181b" stroke="#fb923c" stroke-width="1.6"/>
      <circle cx="24" cy="27" r="3" fill="#ef4444"/>
    `;
  } else if (baseId === 'hydra_hivemind') {
    core = `
      <path d="M12 36 Q10 20 15 12 M24 38 V10 M36 36 Q38 20 33 12" fill="none" stroke="#84cc16" stroke-width="2.4" stroke-linecap="round"/>
      <polygon points="15,8 19,14 11,14" fill="#bef264"/>
      <polygon points="24,6 28,13 20,13" fill="#eab308"/>
      <polygon points="33,8 37,14 29,14" fill="#bef264"/>
      <ellipse cx="24" cy="36" rx="13" ry="6" fill="#84cc16" fill-opacity="0.25" stroke="#84cc16" stroke-width="1.6"/>
    `;
  } else if (baseId === 'chrono_warden') {
    core = `
      <circle cx="24" cy="24" r="17" fill="none" stroke="#a855f7" stroke-width="1.5" stroke-dasharray="5 3"/>
      <polygon points="14,11 34,11 24,24 34,37 14,37 24,24" fill="#a855f7" fill-opacity="0.24" stroke="#d8b4fe" stroke-width="1.7"/>
      <circle cx="24" cy="24" r="2.6" fill="#fde047"/>
    `;
  } else if (baseId === 'swarm_stalker') {
    core = `
      <polygon points="24,9 41,23 30,27 24,39 18,27 7,23" fill="#f97316" fill-opacity="0.2" stroke="#f97316" stroke-width="1.7"/>
      <line x1="17" y1="21" x2="22" y2="24" stroke="#fff" stroke-width="1.8"/>
      <line x1="31" y1="21" x2="26" y2="24" stroke="#fff" stroke-width="1.8"/>
    `;
  } else if (baseId === 'enforcer_mech') {
    core = `
      <rect x="11" y="12" width="26" height="25" fill="#ef4444" fill-opacity="0.16" stroke="#ef4444" stroke-width="1.8"/>
      <rect x="7" y="16" width="4" height="12" fill="#94a3b8"/>
      <rect x="37" y="16" width="4" height="12" fill="#94a3b8"/>
      <rect x="16" y="19" width="16" height="4" fill="#fb923c"/>
      <line x1="16" y1="30" x2="32" y2="30" stroke="#ef4444" stroke-width="2"/>
    `;
  } else if (baseId === 'plague_weaver') {
    core = `
      <circle cx="24" cy="24" r="10" fill="#84cc16" fill-opacity="0.22" stroke="#84cc16" stroke-width="1.8"/>
      <path d="M14 20 L6 13 M14 28 L6 35 M34 20 L42 13 M34 28 L42 35" stroke="#bef264" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="20" cy="22" r="2" fill="#ef4444"/>
      <circle cx="28" cy="22" r="2" fill="#ef4444"/>
      <circle cx="24" cy="27" r="1.6" fill="#fde047"/>
    `;
  } else {
    // sentinel_drone
    core = `
      <polygon points="${polyPoints(24, 24, 13, 6, 30)}" fill="#38bdf8" fill-opacity="0.16" stroke="#38bdf8" stroke-width="1.7"/>
      <line x1="6" y1="24" x2="12" y2="24" stroke="#7dd3fc" stroke-width="2"/>
      <line x1="36" y1="24" x2="42" y2="24" stroke="#7dd3fc" stroke-width="2"/>
      <circle cx="24" cy="24" r="4.5" fill="#ef4444"/>
    `;
  }

  let overlay = '';
  if (isAnomaly) {
    overlay = `<line x1="5" y1="15" x2="43" y2="17" stroke="#d946ef" stroke-width="1.3" stroke-dasharray="6 3"/><rect x="4" y="4" width="40" height="40" fill="none" stroke="#d946ef" stroke-opacity="0.55" stroke-dasharray="4 3"/>`;
  } else if (isElite) {
    overlay = `<polygon points="24,3 27,8 21,8" fill="#eab308"/><rect x="4" y="4" width="40" height="40" fill="none" stroke="#eab308" stroke-opacity="0.45"/>`;
  }

  const svg = wrapSvg(core + overlay, 'art-svg enemy-art-svg');
  svgCache.set(key, svg);
  return svg;
}

// ----------------------------------------------------------------------------
// 5. OPERATIVE CLASSES (4 Classes) — Distinct Helmet / Crest Portraits
// ----------------------------------------------------------------------------
export function getClassArtSvg(classId = 'vanguard') {
  const key = `class:${classId}`;
  if (svgCache.has(key)) return svgCache.get(key);

  let body = '';
  if (classId === 'spectre') {
    body = `
      <polygon points="24,6 39,18 35,40 13,40 9,18" fill="#38bdf8" fill-opacity="0.15" stroke="#38bdf8" stroke-width="1.8"/>
      <line x1="15" y1="22" x2="22" y2="24" stroke="#fde047" stroke-width="2.2"/>
      <line x1="33" y1="22" x2="26" y2="24" stroke="#fde047" stroke-width="2.2"/>
      <path d="M18 33 L24 30 L30 33" fill="none" stroke="#7dd3fc" stroke-width="1.5"/>
    `;
  } else if (classId === 'plaguebringer') {
    body = `
      <circle cx="24" cy="23" r="14" fill="#84cc16" fill-opacity="0.16" stroke="#84cc16" stroke-width="1.8"/>
      <circle cx="18" cy="20" r="3.2" fill="#bef264"/>
      <circle cx="30" cy="20" r="3.2" fill="#bef264"/>
      <rect x="19" y="28" width="10" height="7" fill="#18181b" stroke="#84cc16" stroke-width="1.5"/>
      <line x1="24" y1="28" x2="24" y2="35" stroke="#84cc16" stroke-width="1.4"/>
    `;
  } else if (classId === 'voidmancer') {
    body = `
      <path d="M24 6 L39 38 H9 Z" fill="#a855f7" fill-opacity="0.18" stroke="#a855f7" stroke-width="1.8"/>
      <circle cx="24" cy="25" r="5.5" fill="#18181b" stroke="#d8b4fe" stroke-width="1.6"/>
      <circle cx="24" cy="25" r="2.2" fill="#fde047"/>
    `;
  } else {
    // vanguard
    body = `
      <path d="M11 12 L24 7 L37 12 V27 C37 35 24 41 24 41 C24 41 11 35 11 27 Z" fill="#ef4444" fill-opacity="0.16" stroke="#e4e4e7" stroke-width="1.8"/>
      <rect x="15" y="19" width="18" height="4" fill="#38bdf8"/>
      <line x1="24" y1="26" x2="24" y2="36" stroke="#ef4444" stroke-width="2"/>
    `;
  }

  const svg = wrapSvg(body, 'art-svg class-art-svg');
  svgCache.set(key, svg);
  return svg;
}

// ----------------------------------------------------------------------------
// 6. INTERACTIONS — Mystery Events, Map Rooms, Shop Services, Statuses, Intents
// ----------------------------------------------------------------------------
export function getInteractionArtSvg(kind, id) {
  const key = `int:${kind}:${id}`;
  if (svgCache.has(key)) return svgCache.get(key);

  let body = '';

  if (kind === 'event') {
    if (id === 'rogue_ai_shrine') {
      body = `<polygon points="${polyPoints(24, 24, 15, 6, 0)}" fill="#eab308" fill-opacity="0.16" stroke="#eab308" stroke-width="1.8"/><circle cx="24" cy="24" r="5" fill="#ef4444"/><line x1="24" y1="7" x2="24" y2="41" stroke="#eab308" stroke-opacity="0.4"/>`;
    } else if (id === 'cyber_surgeon') {
      body = `<rect x="10" y="10" width="28" height="28" fill="#ef4444" fill-opacity="0.14" stroke="#e4e4e7" stroke-width="1.7"/><path d="M24 15 V33 M15 24 H33" stroke="#ef4444" stroke-width="3.5"/>`;
    } else if (id === 'mirror_duplicator') {
      body = `<polygon points="10,12 22,8 22,40 10,36" fill="#38bdf8" fill-opacity="0.22" stroke="#38bdf8" stroke-width="1.6"/><polygon points="38,12 26,8 26,40 38,36" fill="#a855f7" fill-opacity="0.22" stroke="#a855f7" stroke-width="1.6"/>`;
    } else if (id === 'gamblers_terminal') {
      body = `<rect x="9" y="9" width="30" height="30" rx="4" fill="#eab308" fill-opacity="0.15" stroke="#eab308" stroke-width="1.8"/><circle cx="17" cy="17" r="2.2" fill="#fff"/><circle cx="24" cy="24" r="2.2" fill="#eab308"/><circle cx="31" cy="31" r="2.2" fill="#fff"/>`;
    } else if (id === 'alchemist_lab') {
      body = `<path d="M16 10 H24 V18 L30 35 H10 L16 18 Z" fill="#4ade80" fill-opacity="0.25" stroke="#4ade80" stroke-width="1.7"/><circle cx="35" cy="20" r="6" fill="#38bdf8" fill-opacity="0.25" stroke="#38bdf8" stroke-width="1.6"/>`;
    } else {
      // void_altar
      body = `<circle cx="24" cy="24" r="14" fill="#a855f7" fill-opacity="0.18" stroke="#a855f7" stroke-width="1.8"/><circle cx="24" cy="24" r="6" fill="#09090b" stroke="#d8b4fe" stroke-width="1.5"/>`;
    }
  } else if (kind === 'room') {
    if (id === 'combat') {
      body = `<line x1="12" y1="36" x2="36" y2="12" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/><line x1="36" y1="36" x2="12" y2="12" stroke="#fb923c" stroke-width="3" stroke-linecap="round"/>`;
    } else if (id === 'elite') {
      body = `<polygon points="${polyPoints(24, 24, 15, 6, 30)}" fill="#fb923c" fill-opacity="0.2" stroke="#fb923c" stroke-width="2"/><circle cx="19" cy="22" r="2.4" fill="#fff"/><circle cx="29" cy="22" r="2.4" fill="#fff"/><line x1="19" y1="30" x2="29" y2="30" stroke="#fb923c" stroke-width="2"/>`;
    } else if (id === 'event') {
      body = `<circle cx="24" cy="24" r="15" fill="#38bdf8" fill-opacity="0.15" stroke="#38bdf8" stroke-width="2"/><path d="M19 18 A5 5 0 1 1 26 23 L24 27" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="33" r="1.8" fill="#38bdf8"/>`;
    } else if (id === 'shop') {
      body = `<rect x="10" y="16" width="28" height="20" fill="#eab308" fill-opacity="0.18" stroke="#eab308" stroke-width="2"/><path d="M16 16 V12 A8 8 0 0 1 32 12 V16" fill="none" stroke="#fde047" stroke-width="2"/><circle cx="24" cy="26" r="3" fill="#eab308"/>`;
    } else if (id === 'anomaly') {
      body = `<polygon points="24,8 40,38 8,38" fill="#a855f7" fill-opacity="0.2" stroke="#d946ef" stroke-width="2"/><line x1="24" y1="18" x2="24" y2="28" stroke="#fff" stroke-width="2.6"/><circle cx="24" cy="33" r="1.8" fill="#fff"/>`;
    } else if (id === 'upgrade') {
      body = `<polygon points="12,34 36,34 32,26 16,26" fill="#4ade80" fill-opacity="0.25" stroke="#4ade80" stroke-width="2"/><line x1="24" y1="10" x2="24" y2="24" stroke="#4ade80" stroke-width="2.6"/><line x1="18" y1="16" x2="30" y2="16" stroke="#4ade80" stroke-width="2.6"/>`;
    } else if (id === 'treasure') {
      body = `<rect x="10" y="14" width="28" height="22" fill="#eab308" fill-opacity="0.2" stroke="#eab308" stroke-width="2"/><line x1="10" y1="23" x2="38" y2="23" stroke="#eab308" stroke-width="1.8"/><rect x="21" y="20" width="6" height="6" fill="#fde047"/>`;
    } else {
      // boss
      body = `<polygon points="9,34 12,14 20,23 24,10 28,23 36,14 39,34" fill="#ef4444" fill-opacity="0.28" stroke="#ef4444" stroke-width="2" stroke-linejoin="round"/>`;
    }
  } else if (kind === 'shop') {
    if (id === 'purge') {
      body = `<rect x="14" y="14" width="20" height="24" fill="#ef4444" fill-opacity="0.16" stroke="#ef4444" stroke-width="1.8"/><line x1="11" y1="14" x2="37" y2="14" stroke="#ef4444" stroke-width="2"/><line x1="19" y1="20" x2="29" y2="32" stroke="#fff" stroke-width="2"/><line x1="29" y1="20" x2="19" y2="32" stroke="#fff" stroke-width="2"/>`;
    } else if (id === 'forge') {
      body = `<polygon points="10,33 38,33 33,24 15,24" fill="#4ade80" fill-opacity="0.22" stroke="#4ade80" stroke-width="1.8"/><path d="M24 9 L28 19 H20 Z" fill="#fde047"/>`;
    } else {
      body = `<polygon points="${polyPoints(24, 24, 15, 6, 0)}" fill="#eab308" fill-opacity="0.16" stroke="#eab308" stroke-width="1.8"/><text x="24" y="29" text-anchor="middle" fill="#eab308" font-size="14" font-weight="900">$</text>`;
    }
  } else if (kind === 'status') {
    if (id === 'strength') body = `<polygon points="24,8 38,36 24,30 10,36" fill="#eab308"/>`;
    else if (id === 'dexterity') body = `<path d="M24 8 L38 15 V27 C38 35 24 40 24 40 C24 40 10 35 10 27 V15 Z" fill="#2dd4bf" fill-opacity="0.35" stroke="#2dd4bf" stroke-width="2.5"/>`;
    else if (id === 'vulnerable') body = `<circle cx="24" cy="24" r="13" fill="none" stroke="#f97316" stroke-width="2.5"/><line x1="14" y1="14" x2="34" y2="34" stroke="#f97316" stroke-width="2.5"/>`;
    else if (id === 'weak') body = `<polygon points="12,14 36,14 24,36" fill="none" stroke="#a855f7" stroke-width="2.5"/>`;
    else if (id === 'corrode') body = `<path d="M24 8 C34 20 36 28 24 38 C12 28 14 20 24 8 Z" fill="#84cc16" fill-opacity="0.4" stroke="#84cc16" stroke-width="2.2"/>`;
    else body = `<polygon points="10,34 17,12 24,28 31,12 38,34" fill="none" stroke="#fb7185" stroke-width="2.5"/>`;
  } else if (kind === 'intent') {
    if (id === 'attack') body = `<line x1="10" y1="38" x2="38" y2="10" stroke="#ef4444" stroke-width="4" stroke-linecap="round"/><polygon points="38,10 28,12 36,20" fill="#ef4444"/>`;
    else if (id === 'defend') body = `<path d="M24 8 L38 14 V26 C38 34 24 40 24 40 C24 40 10 34 10 26 V14 Z" fill="#38bdf8" fill-opacity="0.35" stroke="#38bdf8" stroke-width="2.5"/>`;
    else if (id === 'debuff') body = `<circle cx="24" cy="24" r="12" fill="#a855f7" fill-opacity="0.35" stroke="#a855f7" stroke-width="2.5"/><circle cx="24" cy="24" r="4" fill="#fff"/>`;
    else body = `<line x1="10" y1="36" x2="34" y2="12" stroke="#f97316" stroke-width="3.5"/><circle cx="34" cy="34" r="6" fill="#a855f7"/>`;
  }

  const svg = wrapSvg(body, `art-svg int-${kind}-svg`);
  svgCache.set(key, svg);
  return svg;
}
