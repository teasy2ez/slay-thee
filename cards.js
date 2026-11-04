// ============================================================================
// CARDS.JS — 108 Distinct Cards with Full Upgrade (+) Definitions
// ============================================================================

/**
 * Universal card builder & action executor.
 * Every card in CARD_REGISTRY has a base definition and an `upgrade` delta object.
 * When `resolveCard(cardInstanceOrId, forceUpgraded)` is called, it returns the
 * effective card definition (merging `upgrade` properties if upgraded) and binds
 * `onPlay(ctx)` to those resolved numbers!
 */

const RAW_CARDS = [
  // ==========================================================================
  // ARCHETYPE 1: STARTER & BALLISTICS / MULTI-HIT (20 Cards)
  // ==========================================================================
  {
    id: 'strike', name: 'STRIKE', cost: 1, type: 'attack', rarity: 'starter',
    baseDamage: 6,
    description: 'Deal 6 damage.',
    upgrade: { baseDamage: 9, description: 'Deal 9 damage.' }
  },
  {
    id: 'defend', name: 'DEFEND', cost: 1, type: 'skill', rarity: 'starter',
    baseShield: 5,
    description: 'Gain 5 Shield.',
    upgrade: { baseShield: 8, description: 'Gain 8 Shield.' }
  },
  {
    id: 'expose', name: 'EXPOSE', cost: 1, type: 'skill', rarity: 'starter',
    applyStatus: { vulnerable: 2, weak: 1 },
    description: 'Apply 2 Vulnerable and 1 Weak.',
    upgrade: { applyStatus: { vulnerable: 3, weak: 2 }, description: 'Apply 3 Vulnerable and 2 Weak.' }
  },
  {
    id: 'heavy_strike', name: 'HEAVY STRIKE', cost: 2, type: 'attack', rarity: 'common',
    baseDamage: 12, strengthMultiplier: 2,
    description: 'Deal 12 damage. STR affects this 2x.',
    upgrade: { baseDamage: 15, strengthMultiplier: 3, description: 'Deal 15 damage. STR affects this 3x.' }
  },
  {
    id: 'flurry', name: 'TWIN BARRAGE', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 4, hits: 2,
    description: 'Deal 4 damage 2 times.',
    upgrade: { baseDamage: 6, hits: 2, description: 'Deal 6 damage 2 times.' }
  },
  {
    id: 'gatling_protocol', name: 'GATLING PROTOCOL', cost: 2, type: 'attack', rarity: 'uncommon',
    baseDamage: 3, hits: 4,
    description: 'Deal 3 damage 4 times.',
    upgrade: { baseDamage: 4, hits: 5, description: 'Deal 4 damage 5 times.' }
  },
  {
    id: 'railgun_slug', name: 'RAILGUN SLUG', cost: 2, type: 'attack', rarity: 'common',
    baseDamage: 16, applyStatus: { vulnerable: 1 },
    description: 'Deal 16 damage. Apply 1 Vulnerable.',
    upgrade: { baseDamage: 22, applyStatus: { vulnerable: 2 }, description: 'Deal 22 damage. Apply 2 Vulnerable.' }
  },
  {
    id: 'ricochet_burst', name: 'RICOCHET BURST', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 3, hits: 3,
    description: 'Deal 3 damage 3 times.',
    upgrade: { baseDamage: 4, hits: 3, description: 'Deal 4 damage 3 times.' }
  },
  {
    id: 'ricochet_storm', name: 'BULLET STORM', cost: 2, type: 'attack', rarity: 'rare',
    baseDamage: 3, hits: 6, exhaust: true,
    description: 'Deal 3 damage 6 times. Exhaust.',
    upgrade: { baseDamage: 4, hits: 6, exhaust: false, description: 'Deal 4 damage 6 times.' }
  },
  {
    id: 'hyper_beam', name: 'HYPER BEAM', cost: 3, type: 'attack', rarity: 'rare',
    baseDamage: 28, selfStatus: { weak: 1 },
    description: 'Deal 28 damage. Gain 1 Weak.',
    upgrade: { baseDamage: 38, selfStatus: {}, description: 'Deal 38 damage.' }
  },
  {
    id: 'shrapnel_cone', name: 'SHRAPNEL CONE', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 7, applyStatus: { weak: 1 },
    description: 'Deal 7 damage. Apply 1 Weak.',
    upgrade: { baseDamage: 10, applyStatus: { weak: 2 }, description: 'Deal 10 damage. Apply 2 Weak.' }
  },
  {
    id: 'double_tap', name: 'QUICK DRAW', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 6, draw: 1,
    description: 'Deal 6 damage. Draw 1 card.',
    upgrade: { baseDamage: 9, draw: 2, description: 'Deal 9 damage. Draw 2 cards.' }
  },
  {
    id: 'finisher_protocol', name: 'FINISHER', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 5,
    description: 'Deal 5 damage per Attack played this turn.',
    customPlay(ctx, card) {
      const count = Math.max(1, (ctx.player.turnAttacksPlayed || 0) + 1);
      for (let i = 0; i < count; i++) {
        ctx.dealDamage(ctx.player, ctx.target, card.baseDamage, { card });
      }
    },
    upgrade: { baseDamage: 7, description: 'Deal 7 damage per Attack played this turn.' }
  },
  {
    id: 'point_blank', name: 'POINT BLANK', cost: 0, type: 'attack', rarity: 'common',
    baseDamage: 4,
    description: 'Deal 4 damage.',
    upgrade: { baseDamage: 7, description: 'Deal 7 damage.' }
  },
  {
    id: 'piercing_lance', name: 'PIERCING LANCE', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 8,
    description: 'Strip enemy Shield, then deal 8 damage.',
    customPlay(ctx, card) {
      if (ctx.target && ctx.target.shield > 0) {
        ctx.log(`[CARD] ${card.name} shattered ${ctx.target.shield} enemy Shield!`);
        ctx.target.shield = 0;
      }
      ctx.dealDamage(ctx.player, ctx.target, card.baseDamage, { card });
    },
    upgrade: { baseDamage: 12, description: 'Strip enemy Shield, then deal 12 damage.' }
  },
  {
    id: 'auto_turret', name: 'AUTO TURRET', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 5, baseShield: 4,
    description: 'Deal 5 damage. Gain 4 Shield.',
    upgrade: { baseDamage: 8, baseShield: 6, description: 'Deal 8 damage. Gain 6 Shield.' }
  },
  {
    id: 'chain_lightning', name: 'ARC VOLLEY', cost: 2, type: 'attack', rarity: 'uncommon',
    baseDamage: 5, hits: 3, applyStatus: { vulnerable: 1 },
    description: 'Deal 5 damage 3 times. Apply 1 Vulnerable.',
    upgrade: { baseDamage: 6, hits: 3, applyStatus: { vulnerable: 2 }, description: 'Deal 6 damage 3 times. Apply 2 Vulnerable.' }
  },
  {
    id: 'orbital_laser', name: 'ORBITAL STRIKE', cost: 3, type: 'attack', rarity: 'rare',
    baseDamage: 32, applyStatus: { vulnerable: 3, weak: 3 }, exhaust: true,
    description: 'Deal 32 damage. Apply 3 Vuln & 3 Weak. Exhaust.',
    upgrade: { cost: 2, baseDamage: 36, description: 'Deal 36 damage. Apply 3 Vuln & 3 Weak. Exhaust.' }
  },
  {
    id: 'glass_cannon', name: 'GLASS CANNON', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 16, selfStatus: { vulnerable: 1 },
    description: 'Deal 16 damage. Gain 1 Vulnerable.',
    upgrade: { baseDamage: 22, selfStatus: { vulnerable: 1 }, description: 'Deal 22 damage. Gain 1 Vulnerable.' }
  },
  {
    id: 'omega_slash', name: 'OMEGA CLEAVE', cost: 2, type: 'attack', rarity: 'rare',
    baseDamage: 10, strengthMultiplier: 4,
    description: 'Deal 10 damage. STR affects this 4x.',
    upgrade: { baseDamage: 14, strengthMultiplier: 5, description: 'Deal 14 damage. STR affects this 5x.' }
  },

  // ==========================================================================
  // ARCHETYPE 2: BASTION & BLOCK-SCALING (18 Cards)
  // ==========================================================================
  {
    id: 'shield_slam', name: 'BASTION SLAM', cost: 1, type: 'attack', rarity: 'uncommon',
    baseShield: 3,
    dynamicDamage(player) { return (player?.shield || 0) + (this.baseShield || 3); },
    description: 'Gain 3 Shield. Deal damage equal to your Shield.',
    customPlay(ctx, card) {
      ctx.gainBlock(ctx.player, card.baseShield, { card });
      ctx.dealDamage(ctx.player, ctx.target, ctx.player.shield || 0, { card });
    },
    upgrade: { cost: 0, baseShield: 5, description: 'Gain 5 Shield. Deal damage equal to your Shield.' }
  },
  {
    id: 'fortify', name: 'FORTIFY', cost: 2, type: 'skill', rarity: 'uncommon',
    baseShield: 4,
    description: 'Gain 4 Shield, then double your Shield.',
    customPlay(ctx, card) {
      ctx.gainBlock(ctx.player, card.baseShield, { card });
      const cur = ctx.player.shield || 0;
      if (cur > 0) {
        ctx.player.shield += cur;
        ctx.log(`[CARD] ${card.name} doubled Shield to ${ctx.player.shield}.`);
      }
    },
    upgrade: { cost: 1, baseShield: 6, description: 'Gain 6 Shield, then double your Shield.' }
  },
  {
    id: 'reactive_plating', name: 'REACTIVE PLATING', cost: 1, type: 'skill', rarity: 'common',
    baseShield: 7, selfStatus: { thorns: 1 },
    description: 'Gain 7 Shield and 1 Thorns.',
    upgrade: { baseShield: 10, selfStatus: { thorns: 2 }, description: 'Gain 10 Shield and 2 Thorns.' }
  },
  {
    id: 'aegis_dome', name: 'AEGIS DOME', cost: 2, type: 'skill', rarity: 'common',
    baseShield: 14,
    description: 'Gain 14 Shield.',
    upgrade: { baseShield: 19, description: 'Gain 19 Shield.' }
  },
  {
    id: 'barricade_core', name: 'CITADEL PROTOCOL', cost: 2, type: 'skill', rarity: 'rare',
    baseShield: 12, selfStatus: { dexterity: 2 }, exhaust: true,
    description: 'Gain 12 Shield and 2 DEX. Exhaust.',
    upgrade: { cost: 1, baseShield: 16, selfStatus: { dexterity: 3 }, description: 'Gain 16 Shield and 3 DEX. Exhaust.' }
  },
  {
    id: 'iron_wave', name: 'IRON WAVE', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 6, baseShield: 6,
    description: 'Gain 6 Shield. Deal 6 damage.',
    upgrade: { baseDamage: 8, baseShield: 8, description: 'Gain 8 Shield. Deal 8 damage.' }
  },
  {
    id: 'mirror_coat', name: 'MIRROR COAT', cost: 1, type: 'skill', rarity: 'uncommon',
    baseShield: 6,
    description: 'Gain 6 Shield. Copy enemy Shield onto yourself.',
    customPlay(ctx, card) {
      ctx.gainBlock(ctx.player, card.baseShield, { card });
      const enemyShd = ctx.target?.shield || 0;
      if (enemyShd > 0) {
        ctx.gainBlock(ctx.player, enemyShd, { raw: true, sourceName: card.name });
      }
    },
    upgrade: { baseShield: 10, description: 'Gain 10 Shield. Copy enemy Shield onto yourself.' }
  },
  {
    id: 'kinetic_barrier', name: 'KINETIC BARRIER', cost: 1, type: 'skill', rarity: 'common',
    baseShield: 6, draw: 1,
    description: 'Gain 6 Shield. Draw 1 card.',
    upgrade: { baseShield: 9, draw: 2, description: 'Gain 9 Shield. Draw 2 cards.' }
  },
  {
    id: 'phalanx_stance', name: 'PHALANX STANCE', cost: 1, type: 'skill', rarity: 'uncommon',
    baseShield: 4,
    description: 'Gain 4 Shield for each card in your hand.',
    customPlay(ctx, card) {
      const count = Math.max(1, (ctx.player.hand?.length || 0) + 1);
      ctx.gainBlock(ctx.player, card.baseShield * count, { card });
    },
    upgrade: { baseShield: 6, description: 'Gain 6 Shield for each card in your hand.' }
  },
  {
    id: 'thorn_burst', name: 'FLECHETTE BURST', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 4, selfStatus: { thorns: 2 },
    description: 'Gain 2 Thorns. Deal 4 + (3x Thorns) damage.',
    customPlay(ctx, card) {
      ctx.applyStatus(ctx.player, ctx.player, 'thorns', card.selfStatus.thorns);
      const t = ctx.player.statuses?.thorns || 0;
      ctx.dealDamage(ctx.player, ctx.target, card.baseDamage + t * 3, { card });
    },
    upgrade: { baseDamage: 6, selfStatus: { thorns: 3 }, description: 'Gain 3 Thorns. Deal 6 + (3x Thorns) damage.' }
  },
  {
    id: 'bunker_down', name: 'BUNKER DOWN', cost: 0, type: 'skill', rarity: 'common',
    baseShield: 4,
    description: 'Gain 4 Shield.',
    upgrade: { baseShield: 7, description: 'Gain 7 Shield.' }
  },
  {
    id: 'entrench_protocol', name: 'TRIPLE BULWARK', cost: 2, type: 'skill', rarity: 'rare',
    exhaust: true,
    description: 'Triple your current Shield. Exhaust.',
    customPlay(ctx, card) {
      const cur = ctx.player.shield || 0;
      if (cur > 0) {
        ctx.player.shield = cur * 3;
        ctx.log(`[CARD] ${card.name} tripled Shield to ${ctx.player.shield}!`);
      }
    },
    upgrade: { cost: 1, exhaust: false, description: 'Triple your current Shield.' }
  },
  {
    id: 'titanium_shell', name: 'TITANIUM SHELL', cost: 2, type: 'skill', rarity: 'uncommon',
    baseShield: 11, selfStatus: { thorns: 2, dexterity: 1 },
    description: 'Gain 11 Shield, 2 Thorns, and 1 DEX.',
    upgrade: { baseShield: 15, selfStatus: { thorns: 3, dexterity: 2 }, description: 'Gain 15 Shield, 3 Thorns, and 2 DEX.' }
  },
  {
    id: 'capacitor_shield', name: 'CAPACITOR SHIELD', cost: 1, type: 'skill', rarity: 'uncommon',
    baseShield: 7, energyGain: 1,
    description: 'Gain 7 Shield and 1 Energy.',
    upgrade: { baseShield: 10, energyGain: 1, description: 'Gain 10 Shield and 1 Energy.' }
  },
  {
    id: 'counter_matrix', name: 'COUNTER MATRIX', cost: 1, type: 'skill', rarity: 'common',
    baseShield: 6, applyStatus: { weak: 2 },
    description: 'Gain 6 Shield. Apply 2 Weak.',
    upgrade: { baseShield: 9, applyStatus: { weak: 3 }, description: 'Gain 9 Shield. Apply 3 Weak.' }
  },
  {
    id: 'juggernaut_ram', name: 'JUGGERNAUT RAM', cost: 2, type: 'attack', rarity: 'rare',
    baseShield: 10,
    dynamicDamage(player) { return (player?.shield || 0) + (this.baseShield || 10); },
    description: 'Gain 10 Shield. Deal damage equal to your Shield.',
    customPlay(ctx, card) {
      ctx.gainBlock(ctx.player, card.baseShield, { card });
      ctx.dealDamage(ctx.player, ctx.target, ctx.player.shield || 0, { card });
    },
    upgrade: { baseShield: 15, description: 'Gain 15 Shield. Deal damage equal to your Shield.' }
  },
  {
    id: 'steel_tempest', name: 'STEEL TEMPEST', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 4, hits: 2, baseShield: 4,
    description: 'Gain 4 Shield. Deal 4 damage 2 times.',
    upgrade: { baseDamage: 5, hits: 2, baseShield: 7, description: 'Gain 7 Shield. Deal 5 damage 2 times.' }
  },
  {
    id: 'EMERGENCY_BULKHEAD', name: 'PANIC BULKHEAD', cost: 1, type: 'skill', rarity: 'uncommon',
    baseShield: 16, exhaust: true,
    description: 'Gain 16 Shield. Exhaust.',
    upgrade: { baseShield: 22, description: 'Gain 22 Shield. Exhaust.' }
  },

  // ==========================================================================
  // ARCHETYPE 3: BIO-CORROSION & STATUS-STACKING (18 Cards)
  // ==========================================================================
  {
    id: 'venom_blade', name: 'CORROSIVE STRIKE', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 5, applyStatus: { corrode: 3 },
    description: 'Deal 5 damage. Apply 3 Corrode.',
    upgrade: { baseDamage: 7, applyStatus: { corrode: 5 }, description: 'Deal 7 damage. Apply 5 Corrode.' }
  },
  {
    id: 'nanite_cloud', name: 'NANITE CLOUD', cost: 1, type: 'skill', rarity: 'uncommon',
    applyStatus: { corrode: 5, weak: 1 }, exhaust: true,
    description: 'Apply 5 Corrode and 1 Weak. Exhaust.',
    upgrade: { applyStatus: { corrode: 8, weak: 2 }, exhaust: true, description: 'Apply 8 Corrode and 2 Weak. Exhaust.' }
  },
  {
    id: 'catalyze', name: 'CATALYZE', cost: 1, type: 'skill', rarity: 'rare',
    exhaust: true, multFactor: 2,
    description: 'Double enemy Corrode stacks. Exhaust.',
    customPlay(ctx, card) {
      const cur = ctx.target?.statuses?.corrode || 0;
      if (cur > 0) {
        ctx.applyStatus(ctx.player, ctx.target, 'corrode', cur * (card.multFactor - 1));
      }
    },
    upgrade: { multFactor: 3, description: 'Triple enemy Corrode stacks. Exhaust.' }
  },
  {
    id: 'neuro_toxin', name: 'NEURO TOXIN', cost: 0, type: 'skill', rarity: 'common',
    applyStatus: { corrode: 3 },
    description: 'Apply 3 Corrode.',
    upgrade: { applyStatus: { corrode: 5 }, description: 'Apply 5 Corrode.' }
  },
  {
    id: 'plague_burst', name: 'PLAGUE DETONATION', cost: 2, type: 'attack', rarity: 'rare',
    baseDamage: 6,
    description: 'Deal 6 damage + 2x enemy Corrode stacks.',
    customPlay(ctx, card) {
      const c = ctx.target?.statuses?.corrode || 0;
      ctx.dealDamage(ctx.player, ctx.target, card.baseDamage + c * 2, { card });
    },
    upgrade: { baseDamage: 9, description: 'Deal 9 damage + 2x enemy Corrode stacks.' }
  },
  {
    id: 'acid_rain', name: 'ACID SPRAY', cost: 1, type: 'skill', rarity: 'common',
    applyStatus: { corrode: 4, vulnerable: 1 },
    description: 'Apply 4 Corrode and 1 Vulnerable.',
    upgrade: { applyStatus: { corrode: 6, vulnerable: 2 }, description: 'Apply 6 Corrode and 2 Vulnerable.' }
  },
  {
    id: 'bio_leech', name: 'BIO-LEECH', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 6, applyStatus: { corrode: 2 },
    description: 'Deal 6 damage. Apply 2 Corrode. If enemy has Corrode, heal 3 HP.',
    customPlay(ctx, card) {
      const hadCorrode = (ctx.target?.statuses?.corrode || 0) > 0;
      ctx.dealDamage(ctx.player, ctx.target, card.baseDamage, { card });
      ctx.applyStatus(ctx.player, ctx.target, 'corrode', card.applyStatus.corrode);
      if (hadCorrode) ctx.healEntity(ctx.player, card.healBonus || 3, card.name);
    },
    upgrade: { baseDamage: 9, applyStatus: { corrode: 3 }, healBonus: 5, description: 'Deal 9 damage. Apply 3 Corrode. If enemy has Corrode, heal 5 HP.' }
  },
  {
    id: 'contagion_spread', name: 'CONTAGION', cost: 1, type: 'skill', rarity: 'uncommon',
    applyStatus: { corrode: 4 }, draw: 1,
    description: 'Apply 4 Corrode. Draw 1 card.',
    upgrade: { applyStatus: { corrode: 6 }, draw: 2, description: 'Apply 6 Corrode. Draw 2 cards.' }
  },
  {
    id: 'crippling_pulse', name: 'CRIPPLING PULSE', cost: 2, type: 'skill', rarity: 'uncommon',
    applyStatus: { weak: 3, vulnerable: 3 }, exhaust: true,
    description: 'Apply 3 Weak and 3 Vulnerable. Exhaust.',
    upgrade: { cost: 1, applyStatus: { weak: 4, vulnerable: 4 }, description: 'Apply 4 Weak and 4 Vulnerable. Exhaust.' }
  },
  {
    id: 'toxic_needle', name: 'TOXIC NEEDLE', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 3, hits: 2, applyStatus: { corrode: 2 },
    description: 'Deal 3 damage 2 times. Apply 2 Corrode.',
    upgrade: { baseDamage: 4, hits: 2, applyStatus: { corrode: 4 }, description: 'Deal 4 damage 2 times. Apply 4 Corrode.' }
  },
  {
    id: 'festering_wound', name: 'FESTERING STRIKE', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 7,
    description: 'Deal 7 damage. Deal 7 again if enemy is Vulnerable.',
    customPlay(ctx, card) {
      ctx.dealDamage(ctx.player, ctx.target, card.baseDamage, { card });
      if ((ctx.target?.statuses?.vulnerable || 0) > 0 && ctx.target.hp > 0) {
        ctx.dealDamage(ctx.player, ctx.target, card.baseDamage, { card });
      }
    },
    upgrade: { baseDamage: 10, description: 'Deal 10 damage. Deal 10 again if enemy is Vulnerable.' }
  },
  {
    id: 'pandemic_wave', name: 'PANDEMIC WAVE', cost: 2, type: 'skill', rarity: 'rare',
    applyStatus: { corrode: 9, weak: 2, vulnerable: 2 }, exhaust: true,
    description: 'Apply 9 Corrode, 2 Weak, and 2 Vulnerable. Exhaust.',
    upgrade: { applyStatus: { corrode: 13, weak: 3, vulnerable: 3 }, description: 'Apply 13 Corrode, 3 Weak, and 3 Vulnerable. Exhaust.' }
  },
  {
    id: 'viral_injection', name: 'VIRAL INJECTION', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 5, applyStatus: { corrode: 3 },
    description: 'Deal 5 damage. Apply 3 Corrode. Refund 1 Energy if enemy is Weak.',
    customPlay(ctx, card) {
      const wasWeak = (ctx.target?.statuses?.weak || 0) > 0;
      ctx.dealDamage(ctx.player, ctx.target, card.baseDamage, { card });
      ctx.applyStatus(ctx.player, ctx.target, 'corrode', card.applyStatus.corrode);
      if (wasWeak) ctx.gainEnergy(ctx.player, 1, card.name);
    },
    upgrade: { baseDamage: 8, applyStatus: { corrode: 5 }, description: 'Deal 8 damage. Apply 5 Corrode. Refund 1 Energy if enemy is Weak.' }
  },
  {
    id: 'corrosive_armor', name: 'CAUSTIC SHELL', cost: 1, type: 'skill', rarity: 'common',
    baseShield: 6, applyStatus: { corrode: 3 },
    description: 'Gain 6 Shield. Apply 3 Corrode.',
    upgrade: { baseShield: 9, applyStatus: { corrode: 5 }, description: 'Gain 9 Shield. Apply 5 Corrode.' }
  },
  {
    id: 'blight_harvest', name: 'BLIGHT HARVEST', cost: 1, type: 'skill', rarity: 'uncommon',
    description: 'Gain Shield equal to 2x enemy Corrode stacks.',
    customPlay(ctx, card) {
      const c = ctx.target?.statuses?.corrode || 0;
      const mult = card.multFactor || 2;
      ctx.gainBlock(ctx.player, Math.max(4, c * mult), { card });
    },
    upgrade: { multFactor: 3, description: 'Gain Shield equal to 3x enemy Corrode stacks (min 4).' }
  },
  {
    id: 'necrotic_touch', name: 'NECROTIC TOUCH', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 6, applyStatus: { weak: 2 },
    description: 'Deal 6 damage. Apply 2 Weak.',
    upgrade: { baseDamage: 9, applyStatus: { weak: 3 }, description: 'Deal 9 damage. Apply 3 Weak.' }
  },
  {
    id: 'meltdown_toxin', name: 'MELTDOWN TOXIN', cost: 1, type: 'skill', rarity: 'rare',
    description: 'Trigger enemy Corrode damage immediately without reducing stacks.',
    customPlay(ctx, card) {
      const c = ctx.target?.statuses?.corrode || 0;
      const times = card.triggers || 1;
      for (let i = 0; i < times; i++) {
        if (c > 0 && ctx.target?.hp > 0) {
          ctx.dealDirectHpLoss(ctx.target, c, card.name);
        }
      }
    },
    upgrade: { triggers: 2, description: 'Trigger enemy Corrode damage 2 times immediately.' }
  },
  {
    id: 'hex_scanner', name: 'HEX SCANNER', cost: 0, type: 'skill', rarity: 'common',
    applyStatus: { vulnerable: 1, corrode: 2 }, exhaust: true,
    description: 'Apply 1 Vulnerable and 2 Corrode. Exhaust.',
    upgrade: { applyStatus: { vulnerable: 2, corrode: 4 }, description: 'Apply 2 Vulnerable and 4 Corrode. Exhaust.' }
  },

  // ==========================================================================
  // ARCHETYPE 4: OVERCLOCK, ENERGY & DRAW ENGINE (18 Cards)
  // ==========================================================================
  {
    id: 'overclock', name: 'OVERCLOCK', cost: 0, type: 'skill', rarity: 'rare',
    energyGain: 2, draw: 2, exhaust: true,
    description: 'Gain 2 Energy. Draw 2 cards. Exhaust.',
    upgrade: { energyGain: 3, draw: 3, exhaust: true, description: 'Gain 3 Energy. Draw 3 cards. Exhaust.' }
  },
  {
    id: 'turbo_charge', name: 'TURBO CHARGE', cost: 0, type: 'skill', rarity: 'uncommon',
    energyGain: 1, draw: 1,
    description: 'Gain 1 Energy. Draw 1 card.',
    upgrade: { energyGain: 2, draw: 1, description: 'Gain 2 Energy. Draw 1 card.' }
  },
  {
    id: 'neural_sync', name: 'NEURAL SYNC', cost: 1, type: 'skill', rarity: 'common',
    draw: 3,
    description: 'Draw 3 cards.',
    upgrade: { draw: 4, description: 'Draw 4 cards.' }
  },
  {
    id: 'memory_leak', name: 'MEMORY OVERFLOW', cost: 0, type: 'skill', rarity: 'common',
    draw: 2, exhaust: true,
    description: 'Draw 2 cards. Exhaust.',
    upgrade: { draw: 3, exhaust: false, description: 'Draw 3 cards.' }
  },
  {
    id: 'quantum_draw', name: 'QUANTUM CACHE', cost: 1, type: 'skill', rarity: 'uncommon',
    draw: 2, baseShield: 5,
    description: 'Gain 5 Shield. Draw 2 cards.',
    upgrade: { draw: 3, baseShield: 8, description: 'Gain 8 Shield. Draw 3 cards.' }
  },
  {
    id: 'cache_flush', name: 'REBOOT HAND', cost: 1, type: 'skill', rarity: 'uncommon',
    description: 'Discard your hand, then draw 5 cards.',
    customPlay(ctx, card) {
      const count = card.drawCount || 5;
      ctx.player.discard.push(...ctx.player.hand);
      ctx.player.hand = [];
      ctx.drawCards(ctx.player, count);
    },
    upgrade: { cost: 0, drawCount: 5, description: 'Discard your hand, then draw 5 cards.' }
  },
  {
    id: 'surge_reactor', name: 'SURGE REACTOR', cost: 1, type: 'skill', rarity: 'uncommon',
    energyGain: 3, exhaust: true,
    description: 'Gain 3 Energy. Exhaust.',
    upgrade: { cost: 0, energyGain: 3, description: 'Gain 3 Energy. Exhaust.' }
  },
  {
    id: 'zero_cool', name: 'ZERO COOL', cost: 0, type: 'attack', rarity: 'uncommon',
    baseDamage: 4, draw: 1,
    description: 'Deal 4 damage. Draw 1 card.',
    upgrade: { baseDamage: 7, draw: 1, description: 'Deal 7 damage. Draw 1 card.' }
  },
  {
    id: 'parallel_thread', name: 'PARALLEL THREAD', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 7, energyGain: 1,
    description: 'Deal 7 damage. Gain 1 Energy.',
    upgrade: { baseDamage: 10, energyGain: 1, description: 'Deal 10 damage. Gain 1 Energy.' }
  },
  {
    id: 'deep_scan', name: 'DEEP SCAN', cost: 1, type: 'skill', rarity: 'common',
    draw: 2, applyStatus: { vulnerable: 1 },
    description: 'Apply 1 Vulnerable. Draw 2 cards.',
    upgrade: { draw: 3, applyStatus: { vulnerable: 2 }, description: 'Apply 2 Vulnerable. Draw 3 cards.' }
  },
  {
    id: 'adrenaline_pump', name: 'ADRENALINE INJECTOR', cost: 0, type: 'skill', rarity: 'rare',
    energyGain: 2, draw: 2, selfStatus: { strength: 1 }, exhaust: true,
    description: 'Gain 2 Energy, +1 STR, and draw 2 cards. Exhaust.',
    upgrade: { energyGain: 2, draw: 3, selfStatus: { strength: 2 }, description: 'Gain 2 Energy, +2 STR, and draw 3 cards. Exhaust.' }
  },
  {
    id: 'hyper_loop', name: 'HYPER LOOP', cost: 1, type: 'skill', rarity: 'uncommon',
    baseShield: 4, draw: 2, energyGain: 1,
    description: 'Gain 4 Shield, 1 Energy, and draw 2 cards.',
    upgrade: { baseShield: 7, draw: 2, energyGain: 1, description: 'Gain 7 Shield, 1 Energy, and draw 2 cards.' }
  },
  {
    id: 'flux_capacitor', name: 'ENERGY DOUBLER', cost: 1, type: 'skill', rarity: 'rare',
    exhaust: true,
    description: 'Double your current Energy. Exhaust.',
    customPlay(ctx, card) {
      const cur = ctx.player.energy || 0;
      if (cur > 0) ctx.gainEnergy(ctx.player, cur, card.name);
    },
    upgrade: { exhaust: false, description: 'Double your current Energy.' }
  },
  {
    id: 'skimming_routine', name: 'DATA SKIM', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 5, draw: 2,
    description: 'Deal 5 damage. Draw 2 cards.',
    upgrade: { baseDamage: 8, draw: 2, description: 'Deal 8 damage. Draw 2 cards.' }
  },
  {
    id: 'gambit_protocol', name: 'ALL-IN GAMBIT', cost: 0, type: 'attack', rarity: 'uncommon',
    baseDamage: 9, draw: 1, exhaust: true,
    description: 'Deal 9 damage. Draw 1 card. Exhaust.',
    upgrade: { baseDamage: 13, draw: 2, description: 'Deal 13 damage. Draw 2 cards. Exhaust.' }
  },
  {
    id: 'infinite_bus', name: 'OVERDRIVE BUS', cost: 1, type: 'skill', rarity: 'rare',
    draw: 3,
    description: 'Draw 3 cards. Upgrade all cards in your hand for this combat.',
    customPlay(ctx, card) {
      ctx.drawCards(ctx.player, card.draw);
      for (const c of ctx.player.hand || []) {
        c.upgraded = true;
      }
      ctx.log(`[CARD] ${card.name} upgraded all cards in hand!`);
    },
    upgrade: { cost: 0, draw: 3, description: 'Draw 3 cards. Upgrade all cards in your hand for this combat.' }
  },
  {
    id: 'tactical_reload', name: 'TACTICAL RELOAD', cost: 1, type: 'skill', rarity: 'common',
    baseShield: 5, energyGain: 1, draw: 1,
    description: 'Gain 5 Shield, 1 Energy, and draw 1 card.',
    upgrade: { baseShield: 8, energyGain: 1, draw: 1, description: 'Gain 8 Shield, 1 Energy, and draw 1 card.' }
  },
  {
    id: 'clock_cycle', name: 'CLOCK CYCLE', cost: 0, type: 'skill', rarity: 'common',
    baseShield: 2, draw: 1,
    description: 'Gain 2 Shield. Draw 1 card.',
    upgrade: { baseShield: 5, draw: 1, description: 'Gain 5 Shield. Draw 1 card.' }
  },

  // ==========================================================================
  // ARCHETYPE 5: SCRAP & EXHAUST SYNERGY (16 Cards)
  // ==========================================================================
  {
    id: 'emp_blast', name: 'EMP DETONATION', cost: 2, type: 'attack', rarity: 'rare',
    baseDamage: 14, applyStatus: { weak: 2, vulnerable: 2 }, exhaust: true,
    description: 'Deal 14 damage. Apply 2 Weak & 2 Vulnerable. Exhaust.',
    upgrade: { baseDamage: 20, applyStatus: { weak: 3, vulnerable: 3 }, description: 'Deal 20 damage. Apply 3 Weak & 3 Vulnerable. Exhaust.' }
  },
  {
    id: 'siphon_strike', name: 'BLOOD SIPHON', cost: 2, type: 'attack', rarity: 'uncommon',
    baseDamage: 8, heal: 4, exhaust: true,
    description: 'Deal 8 damage. Heal 4 HP. Exhaust.',
    upgrade: { baseDamage: 12, heal: 6, description: 'Deal 12 damage. Heal 6 HP. Exhaust.' }
  },
  {
    id: 'scrap_cannon', name: 'SCRAP CANNON', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 11,
    description: 'Exhaust a random card in hand. Deal 11 damage.',
    customPlay(ctx, card) {
      if (ctx.player.hand.length > 0) {
        const idx = Math.floor(Math.random() * ctx.player.hand.length);
        const [exCard] = ctx.player.hand.splice(idx, 1);
        ctx.exhaustCard(ctx.player, exCard);
      }
      ctx.dealDamage(ctx.player, ctx.target, card.baseDamage, { card });
    },
    upgrade: { baseDamage: 16, description: 'Exhaust a random card in hand. Deal 16 damage.' }
  },
  {
    id: 'incinerate', name: 'INCINERATE', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 11, exhaust: true,
    description: 'Deal 11 damage. Exhaust.',
    upgrade: { baseDamage: 16, description: 'Deal 16 damage. Exhaust.' }
  },
  {
    id: 'soul_burn', name: 'PLASMA TORCH', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 8, applyStatus: { corrode: 4 }, exhaust: true,
    description: 'Deal 8 damage. Apply 4 Corrode. Exhaust.',
    upgrade: { baseDamage: 12, applyStatus: { corrode: 6 }, description: 'Deal 12 damage. Apply 6 Corrode. Exhaust.' }
  },
  {
    id: 'phoenix_protocol', name: 'PHOENIX REBIRTH', cost: 2, type: 'skill', rarity: 'rare',
    baseShield: 10, heal: 6, exhaust: true,
    description: 'Gain 10 Shield and heal 6 HP. Exhaust.',
    upgrade: { baseShield: 14, heal: 9, description: 'Gain 14 Shield and heal 9 HP. Exhaust.' }
  },
  {
    id: 'void_rift', name: 'VOID RIFT', cost: 2, type: 'attack', rarity: 'rare',
    baseDamage: 8,
    description: 'Deal 8 damage + 4 damage for each card in your Exhaust pile.',
    customPlay(ctx, card) {
      const exCount = ctx.player.exhaust?.length || 0;
      const bonus = (card.perExhaust || 4) * exCount;
      ctx.dealDamage(ctx.player, ctx.target, card.baseDamage + bonus, { card });
    },
    upgrade: { baseDamage: 10, perExhaust: 6, description: 'Deal 10 damage + 6 damage for each card in your Exhaust pile.' }
  },
  {
    id: 'sacrifice_core', name: 'CORE SACRIFICE', cost: 0, type: 'skill', rarity: 'uncommon',
    energyGain: 2, draw: 2, exhaust: true,
    description: 'Lose 3 HP. Gain 2 Energy and draw 2 cards. Exhaust.',
    customPlay(ctx, card) {
      ctx.dealDirectHpLoss(ctx.player, 3, card.name);
      ctx.gainEnergy(ctx.player, card.energyGain, card.name);
      ctx.drawCards(ctx.player, card.draw);
    },
    upgrade: { energyGain: 3, draw: 3, description: 'Lose 3 HP. Gain 3 Energy and draw 3 cards. Exhaust.' }
  },
  {
    id: 'ash_shield', name: 'ASHES TO ARMOR', cost: 1, type: 'skill', rarity: 'uncommon',
    baseShield: 8,
    description: 'Exhaust 1 random card in hand. Gain 8 Shield and draw 1 card.',
    customPlay(ctx, card) {
      if (ctx.player.hand.length > 0) {
        const [exCard] = ctx.player.hand.splice(0, 1);
        ctx.exhaustCard(ctx.player, exCard);
      }
      ctx.gainBlock(ctx.player, card.baseShield, { card });
      ctx.drawCards(ctx.player, 1);
    },
    upgrade: { baseShield: 12, description: 'Exhaust 1 random card in hand. Gain 12 Shield and draw 1 card.' }
  },
  {
    id: 'reclaim_data', name: 'DATA RECOVERY', cost: 1, type: 'skill', rarity: 'uncommon',
    exhaust: true,
    description: 'Return a random Exhausted card to your hand (it costs 0). Exhaust.',
    customPlay(ctx, card) {
      if (ctx.player.exhaust && ctx.player.exhaust.length > 0) {
        const idx = Math.floor(Math.random() * ctx.player.exhaust.length);
        const [rec] = ctx.player.exhaust.splice(idx, 1);
        rec.upgraded = true;
        ctx.player.hand.push(rec);
        ctx.log(`[CARD] ${card.name} recovered ${rec.defId.toUpperCase()}+ from Exhaust!`);
      }
    },
    upgrade: { cost: 0, description: 'Return a random Exhausted card to your hand (upgraded). Exhaust.' }
  },
  {
    id: 'entropy_strike', name: 'ENTROPY STRIKE', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 9, draw: 1, exhaust: true,
    description: 'Deal 9 damage. Draw 1 card. Exhaust.',
    upgrade: { baseDamage: 13, draw: 2, description: 'Deal 13 damage. Draw 2 cards. Exhaust.' }
  },
  {
    id: 'dark_pact', name: 'VOID PACT', cost: 1, type: 'skill', rarity: 'uncommon',
    baseShield: 7, selfStatus: { strength: 1, dexterity: 1 }, exhaust: true,
    description: 'Gain 7 Shield, +1 STR, and +1 DEX. Exhaust.',
    upgrade: { baseShield: 10, selfStatus: { strength: 2, dexterity: 2 }, description: 'Gain 10 Shield, +2 STR, and +2 DEX. Exhaust.' }
  },
  {
    id: 'oblivion_ray', name: 'OBLIVION RAY', cost: 2, type: 'attack', rarity: 'rare',
    baseDamage: 24, exhaust: true,
    description: 'Deal 24 damage. Exhaust.',
    upgrade: { baseDamage: 32, description: 'Deal 32 damage. Exhaust.' }
  },
  {
    id: 'salvage_yard', name: 'SALVAGE PROTOCOL', cost: 1, type: 'skill', rarity: 'uncommon',
    baseShield: 4,
    description: 'Gain 4 Shield + 3 Shield per card in your Exhaust pile.',
    customPlay(ctx, card) {
      const ex = ctx.player.exhaust?.length || 0;
      ctx.gainBlock(ctx.player, card.baseShield + ex * (card.perEx || 3), { card });
    },
    upgrade: { baseShield: 6, perEx: 5, description: 'Gain 6 Shield + 5 Shield per card in your Exhaust pile.' }
  },
  {
    id: 'final_gambit', name: 'SUPERNOVA', cost: 2, type: 'attack', rarity: 'rare',
    baseDamage: 7, exhaust: true,
    description: 'Exhaust your hand. Deal 7 damage for each card Exhausted + 10 base damage. Exhaust.',
    customPlay(ctx, card) {
      const count = ctx.player.hand.length;
      while (ctx.player.hand.length > 0) {
        const c = ctx.player.hand.pop();
        ctx.exhaustCard(ctx.player, c);
      }
      ctx.dealDamage(ctx.player, ctx.target, 10 + count * card.baseDamage, { card });
    },
    upgrade: { baseDamage: 10, description: 'Exhaust your hand. Deal 10 damage for each card Exhausted + 10 base damage. Exhaust.' }
  },
  {
    id: 'singularity', name: 'SINGULARITY', cost: 1, type: 'skill', rarity: 'rare',
    energyGain: 1, selfStatus: { strength: 2 }, exhaust: true,
    description: 'Gain 1 Energy and +2 STR. Exhaust.',
    upgrade: { energyGain: 2, selfStatus: { strength: 3 }, description: 'Gain 2 Energy and +3 STR. Exhaust.' }
  },

  // ==========================================================================
  // ARCHETYPE 6: CYBER-AUGMENTS & SCALING POWERS (18 Cards)
  // ==========================================================================
  {
    id: 'servo_boost', name: 'SERVO OVERDRIVE', cost: 1, type: 'skill', rarity: 'common',
    selfStatus: { strength: 2 },
    description: 'Gain 2 Strength.',
    upgrade: { selfStatus: { strength: 3 }, description: 'Gain 3 Strength.' }
  },
  {
    id: 'gyro_stabilizer', name: 'GYRO STABILIZER', cost: 1, type: 'skill', rarity: 'common',
    selfStatus: { dexterity: 2 },
    description: 'Gain 2 Dexterity.',
    upgrade: { selfStatus: { dexterity: 3 }, description: 'Gain 3 Dexterity.' }
  },
  {
    id: 'berserk_chip', name: 'BERSERK CHIP', cost: 0, type: 'skill', rarity: 'uncommon',
    selfStatus: { strength: 2, vulnerable: 1 },
    description: 'Gain 2 Strength and 1 Vulnerable.',
    upgrade: { selfStatus: { strength: 3, vulnerable: 1 }, description: 'Gain 3 Strength and 1 Vulnerable.' }
  },
  {
    id: 'combat_stim', name: 'COMBAT STIM', cost: 1, type: 'skill', rarity: 'uncommon',
    selfStatus: { strength: 1, dexterity: 1 }, draw: 1,
    description: 'Gain 1 STR, 1 DEX, and draw 1 card.',
    upgrade: { selfStatus: { strength: 2, dexterity: 2 }, draw: 1, description: 'Gain 2 STR, 2 DEX, and draw 1 card.' }
  },
  {
    id: 'limit_break', name: 'LIMIT BREAK', cost: 1, type: 'skill', rarity: 'rare',
    exhaust: true,
    description: 'Double your current Strength. Exhaust.',
    customPlay(ctx, card) {
      const cur = ctx.player.statuses?.strength || 0;
      if (cur > 0) {
        ctx.applyStatus(ctx.player, ctx.player, 'strength', cur);
      }
    },
    upgrade: { exhaust: false, description: 'Double your current Strength.' }
  },
  {
    id: 'nano_repair', name: 'NANO REPAIR', cost: 1, type: 'skill', rarity: 'uncommon',
    heal: 5, baseShield: 4, exhaust: true,
    description: 'Heal 5 HP and gain 4 Shield. Exhaust.',
    upgrade: { heal: 8, baseShield: 7, description: 'Heal 8 HP and gain 7 Shield. Exhaust.' }
  },
  {
    id: 'vampire_fangs', name: 'CRIMSON DRAIN', cost: 2, type: 'attack', rarity: 'rare',
    baseDamage: 10, heal: 5, exhaust: true,
    description: 'Deal 10 damage. Heal 5 HP. Exhaust.',
    upgrade: { baseDamage: 14, heal: 8, description: 'Deal 14 damage. Heal 8 HP. Exhaust.' }
  },
  {
    id: 'fortress_mode', name: 'FORTRESS MATRIX', cost: 2, type: 'skill', rarity: 'rare',
    baseShield: 8, selfStatus: { dexterity: 2, thorns: 3 },
    description: 'Gain 8 Shield, 2 DEX, and 3 Thorns.',
    upgrade: { baseShield: 12, selfStatus: { dexterity: 3, thorns: 4 }, description: 'Gain 12 Shield, 3 DEX, and 4 Thorns.' }
  },
  {
    id: 'zenith_core', name: 'ZENITH ASCENSION', cost: 2, type: 'skill', rarity: 'rare',
    selfStatus: { strength: 3, dexterity: 3 }, exhaust: true,
    description: 'Gain 3 STR and 3 DEX. Exhaust.',
    upgrade: { cost: 1, selfStatus: { strength: 4, dexterity: 4 }, description: 'Gain 4 STR and 4 DEX. Exhaust.' }
  },
  {
    id: 'shadow_meld', name: 'PHASE CLOAK', cost: 1, type: 'skill', rarity: 'uncommon',
    baseShield: 8, selfStatus: { dexterity: 1 },
    description: 'Gain 8 Shield and 1 DEX.',
    upgrade: { baseShield: 11, selfStatus: { dexterity: 2 }, description: 'Gain 11 Shield and 2 DEX.' }
  },
  {
    id: 'overdrive_aura', name: 'WARRIOR PROTOCOL', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 6, selfStatus: { strength: 1 },
    description: 'Deal 6 damage. Gain 1 Strength.',
    upgrade: { baseDamage: 9, selfStatus: { strength: 2 }, description: 'Deal 9 damage. Gain 2 Strength.' }
  },
  {
    id: 'blood_forge', name: 'BLOOD FORGE', cost: 0, type: 'skill', rarity: 'uncommon',
    selfStatus: { strength: 2 },
    description: 'Lose 2 HP. Gain 2 Strength and 1 Energy.',
    customPlay(ctx, card) {
      ctx.dealDirectHpLoss(ctx.player, 2, card.name);
      ctx.applyStatus(ctx.player, ctx.player, 'strength', card.selfStatus.strength);
      ctx.gainEnergy(ctx.player, 1, card.name);
    },
    upgrade: { selfStatus: { strength: 3 }, description: 'Lose 2 HP. Gain 3 Strength and 1 Energy.' }
  },
  {
    id: 'titan_frame', name: 'TITAN CHASSIS', cost: 2, type: 'skill', rarity: 'uncommon',
    baseShield: 10, selfStatus: { thorns: 3 },
    description: 'Gain 10 Shield and 3 Thorns.',
    upgrade: { baseShield: 14, selfStatus: { thorns: 5 }, description: 'Gain 14 Shield and 5 Thorns.' }
  },
  {
    id: 'god_mode', name: 'APOTHEOSIS PROTOCOL', cost: 2, type: 'skill', rarity: 'rare',
    exhaust: true,
    description: 'Upgrade ALL cards in your hand, deck, and discard pile for this combat. Exhaust.',
    customPlay(ctx, card) {
      for (const pile of [ctx.player.hand, ctx.player.deck, ctx.player.discard]) {
        for (const c of pile || []) c.upgraded = true;
      }
      ctx.log(`[CARD] ${card.name} upgraded every card in combat!`);
    },
    upgrade: { cost: 1, description: 'Upgrade ALL cards in your hand, deck, and discard pile for this combat. Exhaust.' }
  },
  {
    id: 'razor_coil', name: 'RAZOR COIL', cost: 1, type: 'skill', rarity: 'common',
    selfStatus: { thorns: 3 }, draw: 1,
    description: 'Gain 3 Thorns. Draw 1 card.',
    upgrade: { selfStatus: { thorns: 5 }, draw: 1, description: 'Gain 5 Thorns. Draw 1 card.' }
  },
  {
    id: 'power_surge', name: 'POWER SURGE', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 7, selfStatus: { dexterity: 1 },
    description: 'Deal 7 damage. Gain 1 Dexterity.',
    upgrade: { baseDamage: 10, selfStatus: { dexterity: 2 }, description: 'Deal 10 damage. Gain 2 Dexterity.' }
  },
  {
    id: 'reflex_booster', name: 'REFLEX BOOSTER', cost: 0, type: 'skill', rarity: 'uncommon',
    selfStatus: { dexterity: 2 }, exhaust: true,
    description: 'Gain 2 Dexterity. Exhaust.',
    upgrade: { selfStatus: { dexterity: 3 }, description: 'Gain 3 Dexterity. Exhaust.' }
  },
  {
    id: 'wrath_engine', name: 'WRATH ENGINE', cost: 0, type: 'skill', rarity: 'uncommon',
    selfStatus: { strength: 2 }, exhaust: true,
    description: 'Gain 2 Strength. Exhaust.',
    upgrade: { selfStatus: { strength: 3 }, description: 'Gain 3 Strength. Exhaust.' }
  },

  // ==========================================================================
  // ARCHETYPE 7: TACTICAL, CONDITIONAL & ALCHEMY TECH (18 Cards)
  // ==========================================================================
  {
    id: 'mind_spike', name: 'COUNTER STRIKE', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 8, baseShield: 7,
    description: 'Deal 8 damage. If enemy intends to Attack, gain 7 Shield.',
    customPlay(ctx, card) {
      ctx.dealDamage(ctx.player, ctx.target, card.baseDamage, { card });
      if (ctx.target?.intent?.value > 0) {
        ctx.gainBlock(ctx.player, card.baseShield, { card });
      }
    },
    upgrade: { baseDamage: 11, baseShield: 10, description: 'Deal 11 damage. If enemy intends to Attack, gain 10 Shield.' }
  },
  {
    id: 'ambush_protocol', name: 'OPENING AMBUSH', cost: 0, type: 'attack', rarity: 'uncommon',
    baseDamage: 10, applyStatus: { vulnerable: 2 }, exhaust: true,
    description: 'Deal 10 damage and apply 2 Vulnerable. Exhaust.',
    upgrade: { baseDamage: 14, applyStatus: { vulnerable: 3 }, description: 'Deal 14 damage and apply 3 Vulnerable. Exhaust.' }
  },
  {
    id: 'desperate_strike', name: 'LAST STAND', cost: 1, type: 'attack', rarity: 'uncommon',
    baseDamage: 8,
    description: 'Deal 8 damage (deals double damage if you are <= 50% HP).',
    customPlay(ctx, card) {
      const low = ctx.player.hp <= ctx.player.maxHp * 0.5;
      ctx.dealDamage(ctx.player, ctx.target, low ? card.baseDamage * 2 : card.baseDamage, { card });
    },
    upgrade: { baseDamage: 12, description: 'Deal 12 damage (deals double damage if you are <= 50% HP).' }
  },
  {
    id: 'hoarder_slam', name: 'DECK AVALANCHE', cost: 2, type: 'attack', rarity: 'uncommon',
    baseDamage: 6,
    description: 'Deal 6 damage + 1 damage for each card in your draw & discard piles.',
    customPlay(ctx, card) {
      const count = (ctx.player.deck?.length || 0) + (ctx.player.discard?.length || 0);
      ctx.dealDamage(ctx.player, ctx.target, card.baseDamage + count, { card });
    },
    upgrade: { cost: 1, baseDamage: 9, description: 'Deal 9 damage + 1 damage for each card in your draw & discard piles.' }
  },
  {
    id: 'alchemist_toss', name: 'BREW POTION', cost: 1, type: 'skill', rarity: 'rare',
    baseShield: 5, exhaust: true,
    description: 'Gain 5 Shield and brew a random Potion into an empty slot. Exhaust.',
    customPlay(ctx, card) {
      ctx.gainBlock(ctx.player, card.baseShield, { card });
      ctx.grantRandomPotion(ctx.player, card.name);
    },
    upgrade: { cost: 0, baseShield: 8, description: 'Gain 8 Shield and brew a random Potion into an empty slot. Exhaust.' }
  },
  {
    id: 'field_upgrade', name: 'FIELD FORGE', cost: 1, type: 'skill', rarity: 'common',
    baseShield: 6,
    description: 'Gain 6 Shield. Upgrade all cards currently in your hand.',
    customPlay(ctx, card) {
      ctx.gainBlock(ctx.player, card.baseShield, { card });
      for (const c of ctx.player.hand || []) c.upgraded = true;
    },
    upgrade: { baseShield: 10, description: 'Gain 10 Shield. Upgrade all cards currently in your hand.' }
  },
  {
    id: 'emergency_patch', name: 'CLEANSE PATCH', cost: 1, type: 'skill', rarity: 'uncommon',
    baseShield: 8,
    description: 'Gain 8 Shield and clear Weak, Vulnerable, and Corrode from yourself.',
    customPlay(ctx, card) {
      ctx.gainBlock(ctx.player, card.baseShield, { card });
      if (ctx.player.statuses) {
        ctx.player.statuses.weak = 0;
        ctx.player.statuses.vulnerable = 0;
        ctx.player.statuses.corrode = 0;
      }
      ctx.log(`[CARD] ${card.name} purged all debuffs!`);
    },
    upgrade: { baseShield: 12, description: 'Gain 12 Shield and clear Weak, Vulnerable, and Corrode from yourself.' }
  },
  {
    id: 'executioner_axe', name: 'EXECUTIONER', cost: 2, type: 'attack', rarity: 'uncommon',
    baseDamage: 13,
    description: 'Deal 13 damage. If enemy HP is <= 50%, deal 22 instead.',
    customPlay(ctx, card) {
      const low = ctx.target && ctx.target.hp <= ctx.target.maxHp * 0.5;
      ctx.dealDamage(ctx.player, ctx.target, low ? (card.execDmg || 22) : card.baseDamage, { card });
    },
    upgrade: { baseDamage: 16, execDmg: 28, description: 'Deal 16 damage. If enemy HP is <= 50%, deal 28 instead.' }
  },
  {
    id: 'sunder_armor', name: 'SUNDER ARMOR', cost: 2, type: 'attack', rarity: 'uncommon',
    baseDamage: 14,
    description: 'Deal 14 damage. If this breaks or hits unshielded HP, refund 2 Energy.',
    customPlay(ctx, card) {
      const res = ctx.dealDamage(ctx.player, ctx.target, card.baseDamage, { card });
      if (res.hpDamage > 0) {
        ctx.gainEnergy(ctx.player, 2, card.name);
      }
    },
    upgrade: { baseDamage: 19, description: 'Deal 19 damage. If this hits HP, refund 2 Energy.' }
  },
  {
    id: 'Calculated_strike', name: 'HAND BARRAGE', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 3,
    description: 'Deal 3 damage for each card in your hand.',
    customPlay(ctx, card) {
      const count = Math.max(1, (ctx.player.hand?.length || 0) + 1);
      for (let i = 0; i < count; i++) {
        if (ctx.target && ctx.target.hp > 0) {
          ctx.dealDamage(ctx.player, ctx.target, card.baseDamage, { card });
        }
      }
    },
    upgrade: { baseDamage: 4, description: 'Deal 4 damage for each card in your hand.' }
  },
  {
    id: 'shield_bash_plus', name: 'AEGIS BASH', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 6, baseShield: 5, applyStatus: { vulnerable: 1 },
    description: 'Gain 5 Shield. Deal 6 damage. Apply 1 Vulnerable.',
    upgrade: { baseDamage: 8, baseShield: 7, applyStatus: { vulnerable: 2 }, description: 'Gain 7 Shield. Deal 8 damage. Apply 2 Vulnerable.' }
  },
  {
    id: 'venom_shield', name: 'SPORE BARRIER', cost: 1, type: 'skill', rarity: 'common',
    baseShield: 6, applyStatus: { corrode: 2, weak: 1 },
    description: 'Gain 6 Shield. Apply 2 Corrode and 1 Weak.',
    upgrade: { baseShield: 9, applyStatus: { corrode: 4, weak: 2 }, description: 'Gain 9 Shield. Apply 4 Corrode and 2 Weak.' }
  },
  {
    id: 'triplet_slash', name: 'TRIPLE SLASH', cost: 1, type: 'attack', rarity: 'common',
    baseDamage: 3, hits: 3,
    description: 'Deal 3 damage 3 times.',
    upgrade: { baseDamage: 4, hits: 3, description: 'Deal 4 damage 3 times.' }
  },
  {
    id: 'cyber_uppercut', name: 'CYBER UPPERCUT', cost: 2, type: 'attack', rarity: 'uncommon',
    baseDamage: 12, applyStatus: { weak: 2, vulnerable: 2 },
    description: 'Deal 12 damage. Apply 2 Weak and 2 Vulnerable.',
    upgrade: { baseDamage: 15, applyStatus: { weak: 3, vulnerable: 3 }, description: 'Deal 15 damage. Apply 3 Weak and 3 Vulnerable.' }
  },
  {
    id: 'leech_field', name: 'SIPHON MATRIX', cost: 1, type: 'skill', rarity: 'uncommon',
    baseShield: 6, heal: 3, exhaust: true,
    description: 'Gain 6 Shield and heal 3 HP. Exhaust.',
    upgrade: { baseShield: 9, heal: 5, description: 'Gain 9 Shield and heal 5 HP. Exhaust.' }
  },
  {
    id: 'relentless_flurry', name: 'RELENTLESS SALVO', cost: 2, type: 'attack', rarity: 'uncommon',
    baseDamage: 4, hits: 3, draw: 2,
    description: 'Deal 4 damage 3 times. Draw 2 cards.',
    upgrade: { baseDamage: 5, hits: 3, draw: 2, description: 'Deal 5 damage 3 times. Draw 2 cards.' }
  },
  {
    id: 'static_discharge', name: 'STATIC DISCHARGE', cost: 1, type: 'skill', rarity: 'common',
    baseShield: 5, selfStatus: { thorns: 2 }, draw: 1,
    description: 'Gain 5 Shield and 2 Thorns. Draw 1 card.',
    upgrade: { baseShield: 8, selfStatus: { thorns: 3 }, draw: 1, description: 'Gain 8 Shield and 3 Thorns. Draw 1 card.' }
  },
  {
    id: 'corrupted_payload', name: 'OVERLOAD PAYLOAD', cost: 0, type: 'attack', rarity: 'rare',
    baseDamage: 18, selfStatus: { vulnerable: 1 }, exhaust: true,
    description: 'Deal 18 damage. Gain 1 Vulnerable. Exhaust.',
    upgrade: { baseDamage: 25, selfStatus: {}, description: 'Deal 25 damage. Exhaust.' }
  }
];

/**
 * Standard `onPlay` generator for any card definition.
 */
function buildOnPlay(resolvedDef) {
  return function onPlay(ctx) {
    if (typeof resolvedDef.customPlay === 'function') {
      resolvedDef.customPlay(ctx, resolvedDef);
      return;
    }

    // 1. Block / Shield
    if (resolvedDef.baseShield) {
      ctx.gainBlock(ctx.player, resolvedDef.baseShield, { card: resolvedDef });
    }

    // 2. Attack Damage (Single or Multi-Hit)
    if (resolvedDef.baseDamage !== undefined) {
      const hits = resolvedDef.hits || 1;
      for (let i = 0; i < hits; i++) {
        if (ctx.target && ctx.target.hp > 0) {
          ctx.dealDamage(ctx.player, ctx.target, resolvedDef.baseDamage, {
            card: resolvedDef,
            strengthMultiplier: resolvedDef.strengthMultiplier || 1
          });
        }
      }
    }

    // 3. Apply Statuses to Target
    if (resolvedDef.applyStatus && ctx.target) {
      for (const [sId, stacks] of Object.entries(resolvedDef.applyStatus)) {
        if (stacks > 0) ctx.applyStatus(ctx.player, ctx.target, sId, stacks);
      }
    }

    // 4. Apply Statuses to Self
    if (resolvedDef.selfStatus && ctx.player) {
      for (const [sId, stacks] of Object.entries(resolvedDef.selfStatus)) {
        if (stacks > 0) ctx.applyStatus(ctx.player, ctx.player, sId, stacks);
      }
    }

    // 5. Energy Gain
    if (resolvedDef.energyGain) {
      ctx.gainEnergy(ctx.player, resolvedDef.energyGain, resolvedDef.name);
    }

    // 6. Heal Self
    if (resolvedDef.heal) {
      ctx.healEntity(ctx.player, resolvedDef.heal, resolvedDef.name);
    }

    // 7. Draw Cards
    if (resolvedDef.draw) {
      ctx.drawCards(ctx.player, resolvedDef.draw);
    }
  };
}

export const CARD_REGISTRY = {};

for (const raw of RAW_CARDS) {
  const id = raw.id.toLowerCase();
  const baseCard = {
    ...raw,
    id,
    hits: raw.hits || 1
  };
  baseCard.onPlay = buildOnPlay(baseCard);
  CARD_REGISTRY[id] = baseCard;
}

// Legacy alias
CARD_REGISTRY.inflict_vuln = CARD_REGISTRY.expose;
export const CARD_CATALOG = CARD_REGISTRY;

/**
 * Resolves a card instance (`{ defId, upgraded }`) or card ID into its effective definition,
 * applying its `upgrade` modifications when `upgraded` is true.
 */
export function resolveCard(cardOrId, forceUpgraded = false) {
  const defId = typeof cardOrId === 'string' ? cardOrId : cardOrId?.defId;
  const isUpgraded = forceUpgraded || (typeof cardOrId === 'object' && Boolean(cardOrId?.upgraded));
  const base = CARD_REGISTRY[defId?.toLowerCase?.()] || CARD_REGISTRY[defId];
  if (!base) return null;
  if (!isUpgraded || !base.upgrade) return base;

  const merged = {
    ...base,
    ...base.upgrade,
    name: `${base.name}+`,
    upgraded: true
  };
  merged.onPlay = buildOnPlay(merged);
  return merged;
}
