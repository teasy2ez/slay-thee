// ============================================================================
// REPLAYABILITY.JS — Classes, Mutators, Mystery Events, Shop, Curses & Meta-Stats
// ============================================================================

import { CARD_REGISTRY, resolveCard } from "./cards.js";
import { RELIC_REGISTRY } from "./relics.js";
import { POTION_REGISTRY } from "./potions.js";

// ----------------------------------------------------------------------------
// 1. Playable Operative Classes (4 Distinct Starting Loadouts & Passives)
// ----------------------------------------------------------------------------

export const OPERATIVE_CLASSES = {
  vanguard: {
    id: 'vanguard',
    name: 'PALADIN',
    icon: '🛡️',
    title: 'SILVER HAND BASTION',
    subtitle: 'BASTION // THORNS & SHIELD-SLAM',
    maxHp: 58,
    maxEnergy: 3,
    startingCredits: 75,
    starterPotions: ['block_potion', null, null],
    signatureCards: ['shield_slam', 'reactive_plating'],
    passiveDesc: 'Start each battle with +5 Block and +1 Thorns.',
    onBattleStart(player, ctx) {
      ctx.gainBlock(player, 5, { raw: true, sourceName: 'Paladin Bulwark' });
      ctx.applyStatus(player, player, 'thorns', 1);
    }
  },
  spectre: {
    id: 'spectre',
    name: 'SHADOWBLADE',
    icon: '🗡️',
    title: 'NIGHTWATCH ASSASSIN',
    subtitle: 'ASSASSIN // MULTI-HIT & COMBO DRAW',
    maxHp: 48,
    maxEnergy: 3,
    startingCredits: 85,
    starterPotions: ['swift_potion', null, null],
    signatureCards: ['flurry', 'zero_cool'],
    passiveDesc: 'Draw +1 extra spell on Turn 1 of every battle.',
    onBattleStart(player, ctx) {
      ctx.drawCards(player, 1);
      ctx.log('[HERO] Shadowblade Reflexes drew +1 card.');
    }
  },
  plaguebringer: {
    id: 'plaguebringer',
    name: 'NECROMANCER',
    icon: '☣️',
    title: 'SCOURGE PLAGUEWEAVER',
    subtitle: 'PLAGUE // CORRODE & HEXES',
    maxHp: 50,
    maxEnergy: 3,
    startingCredits: 80,
    starterPotions: ['poison_potion', null, null],
    signatureCards: ['venom_blade', 'acid_rain'],
    passiveDesc: 'At battle start, inflict 3 Corrode on all foes.',
    onBattleStart(player, ctx) {
      for (const e of ctx.state.enemies || []) {
        if (e.hp > 0) ctx.applyStatus(player, e, 'corrode', 3);
      }
    }
  },
  voidmancer: {
    id: 'voidmancer',
    name: 'ARCHMAGE',
    icon: '🔮',
    title: 'KIRIN TOR CONJURER',
    subtitle: 'ARCANE // EXHAUST & MANA SURGE',
    maxHp: 46,
    maxEnergy: 3,
    startingCredits: 90,
    starterPotions: ['energy_potion', null, null],
    signatureCards: ['overclock', 'scrap_cannon'],
    passiveDesc: 'Start Turn 1 with +1 Mana. Exhausting cards grants +2 Block.',
    onBattleStart(player, ctx) {
      ctx.gainEnergy(player, 1, 'Arcane Font');
    },
    onCardExhausted(player, ctx) {
      ctx.gainBlock(player, 2, { raw: true, sourceName: 'Arcane Ward' });
    }
  }
};

// ----------------------------------------------------------------------------
// 2. Toggleable Realm Mutators (Custom Modifiers for Infinite Replayability)
// ----------------------------------------------------------------------------

export const RUN_MUTATORS = {
  draft_protocol: {
    id: 'draft_protocol',
    name: 'CHAOS GRIMOIRE',
    icon: '🎲',
    description: 'Replace starter Strikes & Defends with 10 random spells from all schools.'
  },
  glass_world: {
    id: 'glass_world',
    name: "BERSERKER'S WRATH",
    icon: '💥',
    description: 'All Heroes and Foes deal +40% outgoing Attack damage.'
  },
  volatile_compiler: {
    id: 'volatile_compiler',
    name: 'ARCANE SURGE',
    icon: '🌀',
    description: 'Draw +2 extra cards each turn, but Mana costs randomize (0–2) when drawn.'
  },
  elite_bounty: {
    id: 'elite_bounty',
    name: "WARLORD'S BOUNTY",
    icon: '💀',
    description: 'More Champions & Nether Rifts on the map. Slaying foes grants +50% Gold.'
  },
  hyper_regen: {
    id: 'hyper_regen',
    name: 'BLOOD PACT',
    icon: '🩸',
    description: 'Lose 2 HP at turn start, but heal 2 HP whenever you play an Attack.'
  }
};

// ----------------------------------------------------------------------------
// 3. Dark Hex / Curse Cards (Risk/Reward Hazards for Rifts & Encounters)
// ----------------------------------------------------------------------------

export const CURSE_CARDS = [
  {
    id: 'glitch_static',
    name: 'HEX: WITHERING STATIC',
    cost: 1,
    type: 'curse',
    rarity: 'curse',
    exhaust: true,
    description: 'Dark hex: Pay 1 Mana to Burn (Exhaust) this curse from your hand.',
    onPlay(ctx) {
      ctx.log(`[CURSE] ${ctx.player.name} banished Hex: Withering Static.`);
    },
    upgrade: { cost: 0, description: 'Pay 0 Mana to Burn this Hex.' }
  },
  {
    id: 'parasite_code',
    name: 'HEX: DEMONIC LEECH',
    cost: 1,
    type: 'curse',
    rarity: 'curse',
    exhaust: true,
    description: 'Lose 3 HP and draw 1 card. Exhaust.',
    onPlay(ctx) {
      ctx.dealDirectHpLoss(ctx.player, 3, 'Hex: Demonic Leech');
      ctx.drawCards(ctx.player, 1);
    },
    upgrade: { cost: 0, description: 'Lose 2 HP and draw 1 card. Exhaust.' }
  },
  {
    id: 'system_lag',
    name: 'HEX: FROSTBOUND SHACKLE',
    cost: 2,
    type: 'curse',
    rarity: 'curse',
    exhaust: true,
    description: 'Gain 1 Weak. Exhaust.',
    onPlay(ctx) {
      ctx.applyStatus(ctx.player, ctx.player, 'weak', 1);
    },
    upgrade: { cost: 1, description: 'Gain 1 Weak. Exhaust.' }
  }
];

for (const c of CURSE_CARDS) {
  CARD_REGISTRY[c.id] = c;
}

// ----------------------------------------------------------------------------
// 4. Narrative Mystery Events (`EVENT_REGISTRY` — 12 Interactive Events)
// ----------------------------------------------------------------------------

export const EVENT_REGISTRY = {
  rogue_ai_shrine: {
    id: 'rogue_ai_shrine',
    title: 'FORGOTTEN MOONWELL',
    flavor: 'A humming monolith offers to rewrite your combat subroutines—at a biological cost.',
    choices: [
      {
        id: 'sacrifice_upgrade',
        label: '🩸 [BLOOD COMPILE] Lose 7 HP ➔ Upgrade 2 random cards in your Master Deck',
        resolve(player, state, ctx) {
          ctx.dealDirectHpLoss(player, Math.min(player.hp - 1, 7), 'Rogue AI Shrine');
          const unup = (player.masterDeck || []).filter(c => !c.upgraded);
          for (const c of unup.sort(() => Math.random() - 0.5).slice(0, 2)) c.upgraded = true;
          return 'Upgraded 2 cards in your Master Deck!';
        }
      },
      {
        id: 'accept_curse_relic',
        label: '⚠️ [DARK BARGAIN] Gain a random Relic + 50 CR, but add GLITCH: PARASITE to deck',
        resolve(player, state, ctx) {
          player.credits = (player.credits || 0) + 50;
          player.masterDeck.push({
            instanceId: 'C_' + Math.random().toString(36).substring(2, 8),
            defId: 'parasite_code',
            upgraded: false
          });
          grantRandomNonStarterRelic(player, ctx);
          return 'Gained a Relic, +50 CR, and Glitch: Parasite!';
        }
      },
      {
        id: 'leave_shrine',
        label: '🚶 [DISCONNECT] Gain +25 CR and leave safely',
        resolve(player) {
          player.credits = (player.credits || 0) + 25;
          return 'Collected +25 CR and moved on.';
        }
      }
    ]
  },

  cyber_surgeon: {
    id: 'cyber_surgeon',
    title: 'WANDERING APOTHECARY',
    flavor: 'An automated surgical bay whirs to life: "OPTICAL AND NEURAL AUGMENTS HALF OFF."',
    choices: [
      {
        id: 'buy_relic',
        label: '💰 [AUGMENTATION] Pay 45 CR (or all CR) ➔ Gain a Relic & heal 8 HP',
        resolve(player, state, ctx) {
          player.credits = Math.max(0, (player.credits || 0) - 45);
          ctx.healEntity(player, 8, 'Cyber Surgeon');
          grantRandomNonStarterRelic(player, ctx);
          return 'Installed a new Relic and healed 8 HP!';
        }
      },
      {
        id: 'purge_cards',
        label: '🗑️ [NEURAL WIPE] Lose 5 HP ➔ Remove 1 basic/curse card from your deck',
        resolve(player, state, ctx) {
          ctx.dealDirectHpLoss(player, Math.min(player.hp - 1, 5), 'Neural Wipe');
          purgeWeakestCard(player);
          return 'Purged 1 weak card from your Master Deck!';
        }
      },
      {
        id: 'full_patch',
        label: '❤️ [MED-PATCH] Heal 30% of your Max HP',
        resolve(player, state, ctx) {
          const amt = Math.max(10, Math.floor(player.maxHp * 0.3));
          ctx.healEntity(player, amt, 'Med-Patch');
          return `Restored +${amt} HP.`;
        }
      }
    ]
  },

  mirror_duplicator: {
    id: 'mirror_duplicator',
    title: 'SUNWELL MIRROR',
    flavor: 'A crystalline chamber reflects your strongest tactical memory and offers to replicate it.',
    choices: [
      {
        id: 'duplicate_best',
        label: '✨ [CLONE MEMORY] Duplicate your highest-rarity card (and Upgrade the copy!)',
        resolve(player) {
          const deck = player.masterDeck || [];
          const sorted = [...deck].sort((a, b) => rarityWeight(b.defId) - rarityWeight(a.defId));
          if (sorted[0]) {
            const copy = {
              instanceId: 'C_' + Math.random().toString(36).substring(2, 8),
              defId: sorted[0].defId,
              upgraded: true
            };
            player.masterDeck.push(copy);
            return `Cloned and upgraded ${resolveCard(copy)?.name}!`;
          }
          return 'No card available to clone.';
        }
      },
      {
        id: 'transform_starters',
        label: '🌀 [RECOMBINE] Transform 2 basic Strike/Defend cards into random upgraded cards',
        resolve(player) {
          transformStarterCards(player, 2, true);
          return 'Transformed 2 starter cards into upgraded cards!';
        }
      }
    ]
  },

  gamblers_terminal: {
    id: 'gamblers_terminal',
    title: 'GOBLIN DICE TAVERN',
    flavor: 'Neon dice spin across a holographic screen. "DOUBLE OR NOTHING, OPERATIVE."',
    choices: [
      {
        id: 'high_stakes',
        label: '🎲 [JACKPOT SPIN] 60% chance: +90 CR & a Relic | 40% chance: Lose 8 HP & gain +30 CR',
        resolve(player, state, ctx) {
          if (Math.random() < 0.60) {
            player.credits = (player.credits || 0) + 90;
            grantRandomNonStarterRelic(player, ctx);
            return 'JACKPOT! Won +90 CR and a Relic!';
          }
          ctx.dealDirectHpLoss(player, Math.min(player.hp - 1, 8), 'Rigged Terminal');
          player.credits = (player.credits || 0) + 30;
          return 'Shock trap! Took 8 damage but salvaged +30 CR.';
        }
      },
      {
        id: 'hack_terminal',
        label: '🔓 [SIPHON CREDITS] Safely extract +55 CR and 1 random Potion',
        resolve(player, state, ctx) {
          player.credits = (player.credits || 0) + 55;
          ctx.grantRandomPotion(player, 'Siphoned Terminal');
          return 'Extracted +55 CR and a Potion!';
        }
      }
    ]
  },

  alchemist_lab: {
    id: 'alchemist_lab',
    title: 'DALARAN ALCHEMY LAB',
    flavor: 'Rows of glowing vials bubble on an unattended centrifuge.',
    choices: [
      {
        id: 'fill_potions',
        label: '🧪 [BREW CACHE] Fill all 3 Potion Slots with random Potions',
        resolve(player, state, ctx) {
          if (!Array.isArray(player.potions)) player.potions = [null, null, null];
          const allIds = Object.keys(POTION_REGISTRY);
          for (let i = 0; i < 3; i++) {
            player.potions[i] = allIds[Math.floor(Math.random() * allIds.length)];
          }
          return 'Filled all 3 Potion Slots!';
        }
      },
      {
        id: 'drink_mutagen',
        label: '🧬 [DRINK MUTAGEN] Gain +10 Max HP, heal 10 HP, and Upgrade 1 card',
        resolve(player, state, ctx) {
          player.maxHp += 10;
          ctx.healEntity(player, 10, 'Mutagen');
          const unup = (player.masterDeck || []).filter(c => !c.upgraded);
          if (unup[0]) unup[0].upgraded = true;
          return 'Gained +10 Max HP, healed 10 HP, and upgraded 1 card!';
        }
      }
    ]
  },

  void_altar: {
    id: 'void_altar',
    title: 'TWISTING NETHER ALTAR',
    flavor: 'Whispers from the singularity promise immense power to those who shed their bulk.',
    choices: [
      {
        id: 'void_blessing',
        label: '🔮 [EMBRACE VOID] Purge 2 basic cards from deck & gain +40 CR',
        resolve(player) {
          purgeWeakestCard(player);
          purgeWeakestCard(player);
          player.credits = (player.credits || 0) + 40;
          return 'Purged 2 basic cards and gained +40 CR!';
        }
      },
      {
        id: 'rare_draft',
        label: '🌟 [SINGULARITY GIFT] Lose 6 Max HP ➔ Add 2 Upgraded Rare cards to your deck',
        resolve(player) {
          player.maxHp = Math.max(20, player.maxHp - 6);
          player.hp = Math.min(player.hp, player.maxHp);
          const rares = Object.values(CARD_REGISTRY).filter(c => c.rarity === 'rare');
          for (let i = 0; i < 2; i++) {
            const pick = rares[Math.floor(Math.random() * rares.length)];
            if (pick) {
              player.masterDeck.push({
                instanceId: 'C_' + Math.random().toString(36).substring(2, 8),
                defId: pick.id,
                upgraded: true
              });
            }
          }
          return 'Added 2 Upgraded Rare cards to your Master Deck!';
        }
      }
    ]
  }
};

function rarityWeight(defId) {
  const r = CARD_REGISTRY[defId]?.rarity;
  if (r === 'rare') return 4;
  if (r === 'uncommon') return 3;
  if (r === 'common') return 2;
  if (r === 'starter') return 1;
  return 0;
}

export function grantRandomNonStarterRelic(player, ctx = null) {
  if (!player.relics) player.relics = [];
  const owned = new Set(player.relics.map(r => r.id));
  const pool = Object.values(RELIC_REGISTRY).filter(r => r.tier !== 'starter' && !owned.has(r.id));
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  const relicState = { id: pick.id, counter: 0 };
  player.relics.push(relicState);
  pick.hooks?.onPickup?.({ player, relicState, ctx });
  if (ctx) ctx.log(`[RELIC] ${player.name} acquired ${pick.name}!`);
  return pick;
}

export function purgeWeakestCard(player) {
  if (!player.masterDeck || player.masterDeck.length <= 5) return null;
  // Prioritize purging curses, then unupgraded strikes/defends, then any starter
  let idx = player.masterDeck.findIndex(c => CARD_REGISTRY[c.defId]?.type === 'curse');
  if (idx === -1) {
    idx = player.masterDeck.findIndex(c => (c.defId === 'strike' || c.defId === 'defend') && !c.upgraded);
  }
  if (idx === -1) {
    idx = 0;
  }
  const [removed] = player.masterDeck.splice(idx, 1);
  return removed;
}

export function transformStarterCards(player, count = 1, upgraded = false) {
  if (!player.masterDeck) return;
  const nonStarters = Object.values(CARD_REGISTRY).filter(
    c => c.rarity !== 'starter' && c.rarity !== 'curse' && c.id !== 'inflict_vuln'
  );
  let transformed = 0;
  for (let i = 0; i < player.masterDeck.length && transformed < count; i++) {
    const c = player.masterDeck[i];
    if (c.defId === 'strike' || c.defId === 'defend') {
      const pick = nonStarters[Math.floor(Math.random() * nonStarters.length)];
      if (pick) {
        c.defId = pick.id;
        c.upgraded = upgraded;
        transformed++;
      }
    }
  }
}

// ----------------------------------------------------------------------------
// 5. Black Market Shop Generator (`generateShopStock`)
// ----------------------------------------------------------------------------

export function generateShopStock(player, floor = 1) {
  const pool = Object.values(CARD_REGISTRY).filter(
    c => c.rarity !== 'starter' && c.rarity !== 'curse' && c.id !== 'inflict_vuln'
  );
  const shuffledCards = [...pool].sort(() => Math.random() - 0.5).slice(0, 4);

  const cardsForSale = shuffledCards.map((c, idx) => {
    const isUpgraded = idx === 0 || Math.random() < 0.35;
    const isOnSale = idx === 1;
    let basePrice = c.rarity === 'rare' ? 75 : (c.rarity === 'uncommon' ? 50 : 35);
    if (isUpgraded) basePrice += 20;
    if (isOnSale) basePrice = Math.floor(basePrice * 0.5);
    return {
      shopItemId: `shop_card_${idx}_${c.id}`,
      type: 'card',
      defId: c.id,
      upgraded: isUpgraded,
      onSale: isOnSale,
      costCredits: basePrice
    };
  });

  const ownedRelics = new Set((player.relics || []).map(r => r.id));
  const relicPool = Object.values(RELIC_REGISTRY)
    .filter(r => r.tier !== 'starter' && !ownedRelics.has(r.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, 2);

  const relicsForSale = relicPool.map((r, idx) => ({
    shopItemId: `shop_relic_${idx}_${r.id}`,
    type: 'relic',
    relicId: r.id,
    costCredits: r.tier === 'rare' ? 115 : (r.tier === 'uncommon' ? 85 : 65)
  }));

  const potionKeys = Object.keys(POTION_REGISTRY).sort(() => Math.random() - 0.5).slice(0, 2);
  const potionsForSale = potionKeys.map((pid, idx) => ({
    shopItemId: `shop_potion_${idx}_${pid}`,
    type: 'potion',
    potionId: pid,
    costCredits: 30
  }));

  const purgeCount = player.shopPurgesUsed || 0;
  const purgePrice = 40 + purgeCount * 20;

  return {
    floor,
    cards: cardsForSale,
    relics: relicsForSale,
    potions: potionsForSale,
    purgeAvailable: true,
    purgeCost: purgePrice,
    upgradeAvailable: true,
    upgradeCost: 35
  };
}

// ----------------------------------------------------------------------------
// 6. Persistent Career Profile & Achievement Unlocks (`localStorage`)
// ----------------------------------------------------------------------------

const PROFILE_STORAGE_KEY = 'SLAY_THEE_CAREER_PROFILE_V1';

export function loadCareerProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (_) {
    // Ignore storage errors in restricted environments
  }
  return {
    runsStarted: 0,
    sectorsCleared: 0,
    highestFloor: 1,
    highestThreatCleared: 0,
    enemiesDefeated: 0,
    cardsPlayed: 0,
    achievements: []
  };
}

export function saveCareerProfile(profile) {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch (_) {
    // Ignore storage errors
  }
}

export function updateCareerStat(updaterFn) {
  const prof = loadCareerProfile();
  updaterFn(prof);
  saveCareerProfile(prof);
  return prof;
}
