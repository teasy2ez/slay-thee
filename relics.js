// ============================================================================
// RELICS.JS — 56+ Relics Subscribing to Lifecycle Hooks (Including Starter Relics)
// ============================================================================

export const RELIC_REGISTRY = {
  // ==========================================================================
  // TIER 0: POWERFUL STARTER / BOSS RELICS (Chosen at Beginning of Run)
  // ==========================================================================
  fusion_reactor: {
    id: 'fusion_reactor',
    name: 'FUSION REACTOR',
    tier: 'starter',
    description: 'Gain +1 Max Energy every turn (4 Energy per turn).',
    hooks: {
      onPickup({ player }) {
        player.maxEnergy = (player.maxEnergy || 3) + 1;
        player.energy = player.maxEnergy;
      },
      onBattleStart({ player, ctx }) {
        if ((player.maxEnergy || 3) < 4) player.maxEnergy = 4;
        ctx.log('[RELIC] Fusion Reactor humming (+1 Max Energy).');
      }
    }
  },
  pandoras_compiler: {
    id: 'pandoras_compiler',
    name: 'PANDORA COMPILER',
    tier: 'starter',
    description: 'Upgrade 4 random starter cards immediately. Start each battle with +1 STR & +1 DEX.',
    hooks: {
      onPickup({ player }) {
        const unupgraded = (player.masterDeck || []).filter(c => !c.upgraded);
        const picks = unupgraded.sort(() => Math.random() - 0.5).slice(0, 4);
        for (const c of picks) c.upgraded = true;
      },
      onBattleStart({ player, ctx }) {
        ctx.applyStatus(player, player, 'strength', 1);
        ctx.applyStatus(player, player, 'dexterity', 1);
      }
    }
  },
  titan_heart: {
    id: 'titan_heart',
    name: 'TITAN HEART',
    tier: 'starter',
    description: 'Gain +20 Max HP. Start every battle with 12 Shield and 2 Thorns.',
    hooks: {
      onPickup({ player }) {
        player.maxHp = (player.maxHp || 56) + 20;
        player.hp = (player.hp || 56) + 20;
      },
      onBattleStart({ player, ctx }) {
        ctx.gainBlock(player, 12, { raw: true, sourceName: 'Titan Heart' });
        ctx.applyStatus(player, player, 'thorns', 2);
      }
    }
  },
  void_harvester: {
    id: 'void_harvester',
    name: 'VOID HARVESTER',
    tier: 'starter',
    description: 'Whenever a card is Exhausted, deal 5 damage to the enemy, gain 4 Shield, and draw 1 card.',
    hooks: {
      onCardExhausted({ player, ctx }) {
        if (ctx.target && ctx.target.hp > 0) {
          ctx.dealRawDamage(player, ctx.target, 5, 'Void Harvester');
        }
        ctx.gainBlock(player, 4, { raw: true, sourceName: 'Void Harvester' });
        ctx.drawCards(player, 1);
      }
    }
  },
  alchemical_crucible: {
    id: 'alchemical_crucible',
    name: 'ALCHEMICAL CRUCIBLE',
    tier: 'starter',
    description: 'Fill all 3 Potion Slots immediately. Using any Potion grants +6 Shield and +1 Energy.',
    hooks: {
      onPickup({ player, ctx }) {
        if (ctx) {
          ctx.grantRandomPotion(player, 'Alchemical Crucible');
          ctx.grantRandomPotion(player, 'Alchemical Crucible');
          ctx.grantRandomPotion(player, 'Alchemical Crucible');
        }
      },
      onPotionUsed({ player, ctx }) {
        ctx.gainBlock(player, 6, { raw: true, sourceName: 'Alchemical Crucible' });
        ctx.gainEnergy(player, 1, 'Alchemical Crucible');
      }
    }
  },
  bio_plague_core: {
    id: 'bio_plague_core',
    name: 'BIO-PLAGUE CORE',
    tier: 'starter',
    description: 'Start every battle by applying 5 Corrode, 2 Weak, and 2 Vulnerable to all enemies.',
    hooks: {
      onBattleStart({ player, ctx }) {
        for (const e of ctx.state.enemies || []) {
          if (e.hp > 0) {
            ctx.applyStatus(player, e, 'corrode', 5);
            ctx.applyStatus(player, e, 'weak', 2);
            ctx.applyStatus(player, e, 'vulnerable', 2);
          }
        }
      }
    }
  },
  chrono_singularity: {
    id: 'chrono_singularity',
    name: 'CHRONO SINGULARITY',
    tier: 'starter',
    description: 'Start each turn by drawing +1 extra card. Every 4th card played in a turn refunds 1 Energy.',
    hooks: {
      onTurnStart({ player, relicState, ctx }) {
        relicState.counter = 0;
        ctx.drawCards(player, 1);
      },
      onCardPlayed({ player, relicState, ctx }) {
        relicState.counter = (relicState.counter || 0) + 1;
        if (relicState.counter >= 4) {
          relicState.counter = 0;
          ctx.gainEnergy(player, 1, 'Chrono Singularity');
        }
      }
    }
  },
  omni_blade_matrix: {
    id: 'omni_blade_matrix',
    name: 'OMNI-BLADE MATRIX',
    tier: 'starter',
    description: 'Start every combat with +3 Strength. Deal +1 extra outgoing Attack damage.',
    hooks: {
      onBattleStart({ player, ctx }) {
        ctx.applyStatus(player, player, 'strength', 3);
      },
      modifyOutgoingDamage(dmg) {
        return dmg + 1;
      }
    }
  },
  aegis_citadel: {
    id: 'aegis_citadel',
    name: 'AEGIS CITADEL',
    tier: 'starter',
    description: 'Start each turn with +6 Shield and +1 Dexterity on Turn 1.',
    hooks: {
      onBattleStart({ player, ctx }) {
        ctx.applyStatus(player, player, 'dexterity', 1);
      },
      onTurnStart({ player, ctx }) {
        ctx.gainBlock(player, 6, { raw: true, sourceName: 'Aegis Citadel' });
      }
    }
  },

  // ==========================================================================
  // TIER 1-3: COMMON, UNCOMMON, RARE & ANOMALY RELICS (48+ Relics)
  // ==========================================================================
  anchor_module: {
    id: 'anchor_module', name: 'ANCHOR MODULE', tier: 'common',
    description: 'Start each combat with +10 Shield.',
    hooks: {
      onBattleStart({ player, ctx }) { ctx.gainBlock(player, 10, { raw: true, sourceName: 'Anchor Module' }); }
    }
  },
  vampiric_siphon: {
    id: 'vampiric_siphon', name: 'VAMPIRIC SIPHON', tier: 'common',
    description: 'At the end of combat, heal 6 HP.',
    hooks: {
      onBattleVictory({ player, ctx }) { ctx.healEntity(player, 6, 'Vampiric Siphon'); }
    }
  },
  rage_capacitor: {
    id: 'rage_capacitor', name: 'RAGE CAPACITOR', tier: 'uncommon',
    description: 'Every 3rd Attack played in a turn grants +1 STR and deals 4 damage.',
    hooks: {
      onBattleStart({ relicState }) { relicState.counter = 0; },
      onTurnStart({ relicState }) { relicState.counter = 0; },
      onCardPlayed({ player, cardDef, relicState, ctx }) {
        if (cardDef.type === 'attack') {
          relicState.counter = (relicState.counter || 0) + 1;
          if (relicState.counter >= 3) {
            relicState.counter = 0;
            ctx.applyStatus(player, player, 'strength', 1);
            if (ctx.target && ctx.target.hp > 0) ctx.dealRawDamage(player, ctx.target, 4, 'Rage Capacitor');
          }
        }
      }
    }
  },
  kinetic_converter: {
    id: 'kinetic_converter', name: 'KINETIC CONVERTER', tier: 'uncommon',
    description: 'Whenever a card is Exhausted, gain 4 Shield and draw 1 card.',
    hooks: {
      onCardExhausted({ player, ctx }) {
        ctx.gainBlock(player, 4, { raw: true, sourceName: 'Kinetic Converter' });
        ctx.drawCards(player, 1);
      }
    }
  },
  overcharged_core: {
    id: 'overcharged_core', name: 'OVERCHARGED CORE', tier: 'uncommon',
    description: 'Start combat with +1 Energy on Turn 1. Deal +2 Attack damage while >=80% HP.',
    hooks: {
      onBattleStart({ player, ctx }) { ctx.gainEnergy(player, 1, 'Overcharged Core'); },
      modifyOutgoingDamage(dmg, { source }) {
        return source && source.hp >= source.maxHp * 0.8 ? dmg + 2 : dmg;
      }
    }
  },
  spiked_chassis: {
    id: 'spiked_chassis', name: 'SPIKED CHASSIS', tier: 'common',
    description: 'Start combat with 2 Thorns. First time you lose HP each combat, gain 6 Shield & 1 DEX.',
    hooks: {
      onBattleStart({ player, relicState, ctx }) {
        relicState.counter = 1;
        ctx.applyStatus(player, player, 'thorns', 2);
      },
      onDamageTaken({ target, player, hpLost, relicState, ctx }) {
        if (target === player && hpLost > 0 && relicState.counter > 0) {
          relicState.counter = 0;
          ctx.gainBlock(player, 6, { raw: true, sourceName: 'Spiked Chassis' });
          ctx.applyStatus(player, player, 'dexterity', 1);
        }
      }
    }
  },
  mercury_hourglass: {
    id: 'mercury_hourglass', name: 'CHRONO EMITTER', tier: 'uncommon',
    description: 'At the start of your turn, deal 3 damage and apply 1 Corrode to all enemies.',
    hooks: {
      onTurnStart({ player, ctx }) {
        for (const e of ctx.state.enemies || []) {
          if (e.hp > 0) {
            ctx.dealRawDamage(player, e, 3, 'Chrono Emitter');
            ctx.applyStatus(player, e, 'corrode', 1);
          }
        }
      }
    }
  },
  akabeko_coil: {
    id: 'akabeko_coil', name: 'SURGE COIL', tier: 'common',
    description: 'Your first Attack each combat deals +8 bonus damage.',
    hooks: {
      onBattleStart({ relicState }) { relicState.counter = 1; },
      modifyOutgoingDamage(dmg, { relicState }) {
        return relicState.counter > 0 ? dmg + 8 : dmg;
      },
      onCardPlayed({ cardDef, relicState }) {
        if (cardDef.type === 'attack' && relicState.counter > 0) relicState.counter = 0;
      }
    }
  },
  vajra_implant: {
    id: 'vajra_implant', name: 'MIGHT IMPLANT', tier: 'common',
    description: 'Start each combat with +1 Strength.',
    hooks: {
      onBattleStart({ player, ctx }) { ctx.applyStatus(player, player, 'strength', 1); }
    }
  },
  oddly_smooth_alloy: {
    id: 'oddly_smooth_alloy', name: 'SMOOTH ALLOY', tier: 'common',
    description: 'Start each combat with +1 Dexterity.',
    hooks: {
      onBattleStart({ player, ctx }) { ctx.applyStatus(player, player, 'dexterity', 1); }
    }
  },
  bag_of_marbles: {
    id: 'bag_of_marbles', name: 'TARGETING BEACON', tier: 'common',
    description: 'At the start of combat, apply 2 Vulnerable to all enemies.',
    hooks: {
      onBattleStart({ player, ctx }) {
        for (const e of ctx.state.enemies || []) ctx.applyStatus(player, e, 'vulnerable', 2);
      }
    }
  },
  red_mask_visor: {
    id: 'red_mask_visor', name: 'DREAD VISOR', tier: 'common',
    description: 'At the start of combat, apply 2 Weak to all enemies.',
    hooks: {
      onBattleStart({ player, ctx }) {
        for (const e of ctx.state.enemies || []) ctx.applyStatus(player, e, 'weak', 2);
      }
    }
  },
  twisted_funnel: {
    id: 'twisted_funnel', name: 'VENOM INJECTOR', tier: 'common',
    description: 'At the start of combat, apply 4 Corrode to all enemies.',
    hooks: {
      onBattleStart({ player, ctx }) {
        for (const e of ctx.state.enemies || []) ctx.applyStatus(player, e, 'corrode', 4);
      }
    }
  },
  ornamental_fan: {
    id: 'ornamental_fan', name: 'KINETIC FAN', tier: 'uncommon',
    description: 'Every 3rd Attack played in a turn grants +5 Shield.',
    hooks: {
      onTurnStart({ relicState }) { relicState.counter = 0; },
      onCardPlayed({ player, cardDef, relicState, ctx }) {
        if (cardDef.type === 'attack') {
          relicState.counter = (relicState.counter || 0) + 1;
          if (relicState.counter >= 3) {
            relicState.counter = 0;
            ctx.gainBlock(player, 5, { raw: true, sourceName: 'Kinetic Fan' });
          }
        }
      }
    }
  },
  kunai_processor: {
    id: 'kunai_processor', name: 'AGILITY PROCESSOR', tier: 'rare',
    description: 'Every 3rd Attack played in a turn grants +1 Dexterity.',
    hooks: {
      onTurnStart({ relicState }) { relicState.counter = 0; },
      onCardPlayed({ player, cardDef, relicState, ctx }) {
        if (cardDef.type === 'attack') {
          relicState.counter = (relicState.counter || 0) + 1;
          if (relicState.counter >= 3) {
            relicState.counter = 0;
            ctx.applyStatus(player, player, 'dexterity', 1);
          }
        }
      }
    }
  },
  letter_opener: {
    id: 'letter_opener', name: 'PULSE EMITTER', tier: 'uncommon',
    description: 'Every 3rd Skill played in a turn deals 6 damage to the enemy.',
    hooks: {
      onTurnStart({ relicState }) { relicState.counter = 0; },
      onCardPlayed({ player, cardDef, relicState, ctx }) {
        if (cardDef.type === 'skill') {
          relicState.counter = (relicState.counter || 0) + 1;
          if (relicState.counter >= 3) {
            relicState.counter = 0;
            if (ctx.target && ctx.target.hp > 0) ctx.dealRawDamage(player, ctx.target, 6, 'Pulse Emitter');
          }
        }
      }
    }
  },
  nunchaku_dynamo: {
    id: 'nunchaku_dynamo', name: 'COMBO DYNAMO', tier: 'common',
    description: 'Every 6th Attack played across combats grants +1 Energy.',
    hooks: {
      onCardPlayed({ player, cardDef, relicState, ctx }) {
        if (cardDef.type === 'attack') {
          relicState.counter = (relicState.counter || 0) + 1;
          if (relicState.counter >= 6) {
            relicState.counter = 0;
            ctx.gainEnergy(player, 1, 'Combo Dynamo');
          }
        }
      }
    }
  },
  ink_bottle_buffer: {
    id: 'ink_bottle_buffer', name: 'DATA BUFFER', tier: 'uncommon',
    description: 'Every 8th card played draws 1 card and grants +3 Shield.',
    hooks: {
      onCardPlayed({ player, relicState, ctx }) {
        relicState.counter = (relicState.counter || 0) + 1;
        if (relicState.counter >= 8) {
          relicState.counter = 0;
          ctx.drawCards(player, 1);
          ctx.gainBlock(player, 3, { raw: true, sourceName: 'Data Buffer' });
        }
      }
    }
  },
  orichalcum_plating: {
    id: 'orichalcum_plating', name: 'AUTO-BARRIER', tier: 'common',
    description: 'If you end your turn with 0 Shield, gain 6 Shield.',
    hooks: {
      onTurnEnd({ player, ctx }) {
        if ((player.shield || 0) === 0) {
          ctx.gainBlock(player, 6, { raw: true, sourceName: 'Auto-Barrier' });
        }
      }
    }
  },
  cloak_clasp: {
    id: 'cloak_clasp', name: 'NEURAL CLASP', tier: 'rare',
    description: 'At the end of your turn, gain 2 Shield for each card remaining in your hand.',
    hooks: {
      onTurnEnd({ player, ctx }) {
        const count = player.hand?.length || 0;
        if (count > 0) ctx.gainBlock(player, count * 2, { raw: true, sourceName: 'Neural Clasp' });
      }
    }
  },
  meat_on_the_bone: {
    id: 'meat_on_the_bone', name: 'EMERGENCY NANITES', tier: 'uncommon',
    description: 'At the end of combat, if your HP is <= 50%, heal 10 HP.',
    hooks: {
      onBattleVictory({ player, ctx }) {
        if (player.hp <= player.maxHp * 0.5) {
          ctx.healEntity(player, 10, 'Emergency Nanites');
        }
      }
    }
  },
  red_skull_module: {
    id: 'red_skull_module', name: 'ADRENALINE SKULL', tier: 'common',
    description: 'While your HP is <= 50%, deal +3 outgoing Attack damage.',
    hooks: {
      modifyOutgoingDamage(dmg, { source }) {
        return source && source.hp <= source.maxHp * 0.5 ? dmg + 3 : dmg;
      }
    }
  },
  paper_phrog_drone: {
    id: 'paper_phrog_drone', name: 'BREACH OPTICS', tier: 'uncommon',
    description: 'Enemies with Vulnerable take +3 additional Attack damage.',
    hooks: {
      modifyIncomingDamage(dmg, { target }) {
        return (target?.statuses?.vulnerable || 0) > 0 ? dmg + 3 : dmg;
      }
    }
  },
  snecko_skull_vat: {
    id: 'snecko_skull_vat', name: 'TOXIN AMPLIFIER', tier: 'common',
    description: 'Whenever you apply Corrode, apply +1 additional Corrode.',
    hooks: {
      onStatusApplied({ target, statusId }) {
        if (statusId === 'corrode' && target?.statuses) {
          target.statuses.corrode += 1;
        }
      }
    }
  },
  champion_belt: {
    id: 'champion_belt', name: 'CONCUSSION BELT', tier: 'rare',
    description: 'Whenever you apply Vulnerable to an enemy, also apply 1 Weak.',
    hooks: {
      onStatusApplied({ source, target, statusId, ctx }) {
        if (statusId === 'vulnerable' && target && target !== source) {
          target.statuses.weak = (target.statuses.weak || 0) + 1;
          ctx.log('[RELIC] Concussion Belt applied +1 WEAK.');
        }
      }
    }
  },
  sadistic_chip: {
    id: 'sadistic_chip', name: 'SADISTIC CHIP', tier: 'rare',
    description: 'Whenever you apply a debuff (Weak, Vulnerable, or Corrode) to an enemy, deal 4 damage.',
    hooks: {
      onStatusApplied({ source, target, statusId, ctx }) {
        if (['weak', 'vulnerable', 'corrode'].includes(statusId) && target && target !== source && target.hp > 0) {
          ctx.dealRawDamage(source, target, 4, 'Sadistic Chip');
        }
      }
    }
  },
  charons_ashes: {
    id: 'charons_ashes', name: 'PLASMA ASHES', tier: 'rare',
    description: 'Whenever a card is Exhausted, deal 4 damage to all enemies.',
    hooks: {
      onCardExhausted({ player, ctx }) {
        for (const e of ctx.state.enemies || []) {
          if (e.hp > 0) ctx.dealRawDamage(player, e, 4, 'Plasma Ashes');
        }
      }
    }
  },
  dead_branch_ai: {
    id: 'dead_branch_ai', name: 'QUANTUM GENERATOR', tier: 'rare',
    description: 'Whenever a card is Exhausted, draw 1 card and gain 2 Shield.',
    hooks: {
      onCardExhausted({ player, ctx }) {
        ctx.drawCards(player, 1);
        ctx.gainBlock(player, 2, { raw: true, sourceName: 'Quantum Generator' });
      }
    }
  },
  centennial_puzzle: {
    id: 'centennial_puzzle', name: 'NEURAL PUZZLE', tier: 'common',
    description: 'The first time you lose HP each combat, draw 3 cards.',
    hooks: {
      onBattleStart({ relicState }) { relicState.counter = 1; },
      onDamageTaken({ target, player, hpLost, relicState, ctx }) {
        if (target === player && hpLost > 0 && relicState.counter > 0) {
          relicState.counter = 0;
          ctx.drawCards(player, 3);
        }
      }
    }
  },
  self_forming_clay: {
    id: 'self_forming_clay', name: 'ADAPTIVE GEL', tier: 'uncommon',
    description: 'Whenever you lose HP, gain 4 Shield immediately.',
    hooks: {
      onDamageTaken({ target, player, hpLost, ctx }) {
        if (target === player && hpLost > 0) {
          ctx.gainBlock(player, 4, { raw: true, sourceName: 'Adaptive Gel' });
        }
      }
    }
  },
  runic_cube: {
    id: 'runic_cube', name: 'PAIN SENSOR', tier: 'rare',
    description: 'Whenever you lose HP, gain +1 Strength.',
    hooks: {
      onDamageTaken({ target, player, hpLost, ctx }) {
        if (target === player && hpLost > 0) {
          ctx.applyStatus(player, player, 'strength', 1);
        }
      }
    }
  },
  bronze_scales: {
    id: 'bronze_scales', name: 'RAZOR SCALES', tier: 'common',
    description: 'Start each combat with 3 Thorns.',
    hooks: {
      onBattleStart({ player, ctx }) { ctx.applyStatus(player, player, 'thorns', 3); }
    }
  },
  clockwork_souvenir: {
    id: 'clockwork_souvenir', name: 'IMMUNE BUFFER', tier: 'uncommon',
    description: 'Start each combat with 4 Shield and +1 STR & +1 DEX.',
    hooks: {
      onBattleStart({ player, ctx }) {
        ctx.gainBlock(player, 4, { raw: true, sourceName: 'Immune Buffer' });
        ctx.applyStatus(player, player, 'strength', 1);
        ctx.applyStatus(player, player, 'dexterity', 1);
      }
    }
  },
  mutagenic_strength: {
    id: 'mutagenic_strength', name: 'COMBAT MUTAGEN', tier: 'common',
    description: 'Start each combat with +2 Strength and 4 Shield.',
    hooks: {
      onBattleStart({ player, ctx }) {
        ctx.applyStatus(player, player, 'strength', 2);
        ctx.gainBlock(player, 4, { raw: true, sourceName: 'Combat Mutagen' });
      }
    }
  },
  bag_of_preparation: {
    id: 'bag_of_preparation', name: 'TACTICAL PACK', tier: 'common',
    description: 'At the start of each combat, draw 2 additional cards.',
    hooks: {
      onBattleStart({ player, ctx }) { ctx.drawCards(player, 2); }
    }
  },
  lantern_battery: {
    id: 'lantern_battery', name: 'SOLAR CELL', tier: 'common',
    description: 'Gain +1 Energy on the first turn of each combat.',
    hooks: {
      onBattleStart({ player, ctx }) { ctx.gainEnergy(player, 1, 'Solar Cell'); }
    }
  },
  ancient_tea_set: {
    id: 'ancient_tea_set', name: 'CRYO COOLANT', tier: 'common',
    description: 'Start each combat with +1 Energy and +5 Shield.',
    hooks: {
      onBattleStart({ player, ctx }) {
        ctx.gainEnergy(player, 1, 'Cryo Coolant');
        ctx.gainBlock(player, 5, { raw: true, sourceName: 'Cryo Coolant' });
      }
    }
  },
  horn_cleat_gyro: {
    id: 'horn_cleat_gyro', name: 'GYRO BULWARK', tier: 'uncommon',
    description: 'On Turn 2 of every combat, gain 14 Shield.',
    hooks: {
      onBattleStart({ relicState }) { relicState.counter = 0; },
      onTurnStart({ player, relicState, ctx }) {
        relicState.counter = (relicState.counter || 0) + 1;
        if (relicState.counter === 2) {
          ctx.gainBlock(player, 14, { raw: true, sourceName: 'Gyro Bulwark' });
        }
      }
    }
  },
  captains_wheel: {
    id: 'captains_wheel', name: 'AEGIS WHEEL', tier: 'rare',
    description: 'On Turn 3 of every combat, gain 18 Shield.',
    hooks: {
      onBattleStart({ relicState }) { relicState.counter = 0; },
      onTurnStart({ player, relicState, ctx }) {
        relicState.counter = (relicState.counter || 0) + 1;
        if (relicState.counter === 3) {
          ctx.gainBlock(player, 18, { raw: true, sourceName: 'Aegis Wheel' });
        }
      }
    }
  },
  stone_calendar: {
    id: 'stone_calendar', name: 'DOOMSDAY CLOCK', tier: 'rare',
    description: 'On Turn 4 of combat, deal 35 damage to all enemies.',
    hooks: {
      onBattleStart({ relicState }) { relicState.counter = 0; },
      onTurnStart({ player, relicState, ctx }) {
        relicState.counter = (relicState.counter || 0) + 1;
        if (relicState.counter === 4) {
          for (const e of ctx.state.enemies || []) {
            if (e.hp > 0) ctx.dealRawDamage(player, e, 35, 'Doomsday Clock');
          }
        }
      }
    }
  },
  toy_ornithopter: {
    id: 'toy_ornithopter', name: 'MED-DRONE', tier: 'common',
    description: 'Whenever you use a Potion, heal 5 HP.',
    hooks: {
      onPotionUsed({ player, ctx }) { ctx.healEntity(player, 5, 'Med-Drone'); }
    }
  },
  white_beast_statue: {
    id: 'white_beast_statue', name: 'CHEM SYNTHESIZER', tier: 'rare',
    description: 'At the end of every combat, brew a random Potion if you have an empty slot.',
    hooks: {
      onBattleVictory({ player, ctx }) { ctx.grantRandomPotion(player, 'Chem Synthesizer'); }
    }
  },
  bird_faced_urn: {
    id: 'bird_faced_urn', name: 'SIPHON URN', tier: 'rare',
    description: 'Every 4th Skill played heals 3 HP.',
    hooks: {
      onCardPlayed({ player, cardDef, relicState, ctx }) {
        if (cardDef.type === 'skill') {
          relicState.counter = (relicState.counter || 0) + 1;
          if (relicState.counter >= 4) {
            relicState.counter = 0;
            ctx.healEntity(player, 3, 'Siphon Urn');
          }
        }
      }
    }
  },
  mummified_hand: {
    id: 'mummified_hand', name: 'CYBER GAUNTLET', tier: 'uncommon',
    description: 'Every 4th Skill played grants +1 Energy.',
    hooks: {
      onCardPlayed({ player, cardDef, relicState, ctx }) {
        if (cardDef.type === 'skill') {
          relicState.counter = (relicState.counter || 0) + 1;
          if (relicState.counter >= 4) {
            relicState.counter = 0;
            ctx.gainEnergy(player, 1, 'Cyber Gauntlet');
          }
        }
      }
    }
  },
  pen_nib_laser: {
    id: 'pen_nib_laser', name: 'FOCUS LENS', tier: 'common',
    description: 'Every 8th Attack played deals +12 bonus damage.',
    hooks: {
      onCardPlayed({ cardDef, relicState }) {
        if (cardDef.type === 'attack') {
          relicState.counter = ((relicState.counter || 0) + 1) % 8;
        }
      },
      modifyOutgoingDamage(dmg, { relicState }) {
        return relicState.counter === 7 ? dmg + 12 : dmg;
      }
    }
  },
  happy_flower_cell: {
    id: 'happy_flower_cell', name: 'PULSE BATTERY', tier: 'common',
    description: 'Every 3rd turn, gain +1 Energy.',
    hooks: {
      onTurnStart({ player, relicState, ctx }) {
        relicState.counter = (relicState.counter || 0) + 1;
        if (relicState.counter >= 3) {
          relicState.counter = 0;
          ctx.gainEnergy(player, 1, 'Pulse Battery');
        }
      }
    }
  },
  incense_burner_field: {
    id: 'incense_burner_field', name: 'PHASE FIELD', tier: 'rare',
    description: 'Every 4th turn, gain 12 Shield and +1 STR.',
    hooks: {
      onTurnStart({ player, relicState, ctx }) {
        relicState.counter = (relicState.counter || 0) + 1;
        if (relicState.counter >= 4) {
          relicState.counter = 0;
          ctx.gainBlock(player, 12, { raw: true, sourceName: 'Phase Field' });
          ctx.applyStatus(player, player, 'strength', 1);
        }
      }
    }
  },
  war_paint_upgrade: {
    id: 'war_paint_upgrade', name: 'TACTICAL COATING', tier: 'common',
    description: 'Upon pickup, upgrade 2 random Skills in your Master Deck. Start combat with +3 Shield.',
    hooks: {
      onPickup({ player }) {
        const skills = (player.masterDeck || []).filter(c => !c.upgraded);
        for (const c of skills.sort(() => Math.random() - 0.5).slice(0, 2)) c.upgraded = true;
      },
      onBattleStart({ player, ctx }) { ctx.gainBlock(player, 3, { raw: true, sourceName: 'Tactical Coating' }); }
    }
  },
  whetstone_upgrade: {
    id: 'whetstone_upgrade', name: 'MONOMOLECULAR HONER', tier: 'common',
    description: 'Upon pickup, upgrade 2 random cards in your Master Deck. Deal +1 Attack damage.',
    hooks: {
      onPickup({ player }) {
        const cards = (player.masterDeck || []).filter(c => !c.upgraded);
        for (const c of cards.sort(() => Math.random() - 0.5).slice(0, 2)) c.upgraded = true;
      },
      modifyOutgoingDamage(dmg) { return dmg + 1; }
    }
  },
  strawberry_ration: {
    id: 'strawberry_ration', name: 'VITALITY CAPSULE', tier: 'common',
    description: 'Upon pickup, gain +10 Max HP and heal 10 HP.',
    hooks: {
      onPickup({ player }) {
        player.maxHp = (player.maxHp || 56) + 10;
        player.hp = Math.min(player.maxHp, (player.hp || 56) + 10);
      }
    }
  },
  pear_ration: {
    id: 'pear_ration', name: 'CRYO FRUIT', tier: 'uncommon',
    description: 'Upon pickup, gain +14 Max HP and heal 14 HP.',
    hooks: {
      onPickup({ player }) {
        player.maxHp = (player.maxHp || 56) + 14;
        player.hp = Math.min(player.maxHp, (player.hp || 56) + 14);
      }
    }
  },
  mango_ration: {
    id: 'mango_ration', name: 'GENESIS CORE', tier: 'rare',
    description: 'Upon pickup, gain +20 Max HP and heal 20 HP.',
    hooks: {
      onPickup({ player }) {
        player.maxHp = (player.maxHp || 56) + 20;
        player.hp = Math.min(player.maxHp, (player.hp || 56) + 20);
      }
    }
  },
  boot_override: {
    id: 'boot_override', name: 'FORCE AMPLIFIER', tier: 'common',
    description: 'Whenever an Attack would deal 1 to 5 damage, increase it to 6.',
    hooks: {
      modifyOutgoingDamage(dmg) {
        return dmg > 0 && dmg < 6 ? 6 : dmg;
      }
    }
  },
  torii_gate: {
    id: 'torii_gate', name: 'DAMPENING GATE', tier: 'rare',
    description: 'Reduce all incoming enemy Attack damage by 2 (minimum 0).',
    hooks: {
      modifyIncomingDamage(dmg) {
        return Math.max(0, dmg - 2);
      }
    }
  },
  tungsten_rod: {
    id: 'tungsten_rod', name: 'TUNGSTEN ARMOR', tier: 'rare',
    description: 'Increase all Shield gained from cards by +2.',
    hooks: {
      modifyBlockGained(block) {
        return block + 2;
      }
    }
  },
  cursed_reactor: {
    id: 'cursed_reactor', name: 'UNSTABLE ISOTOPE', tier: 'uncommon',
    description: 'At the start of your turn, gain +1 Strength and deal 5 damage to all enemies.',
    hooks: {
      onTurnStart({ player, ctx }) {
        ctx.applyStatus(player, player, 'strength', 1);
        for (const e of ctx.state.enemies || []) {
          if (e.hp > 0) ctx.dealRawDamage(player, e, 5, 'Unstable Isotope');
        }
      }
    }
  }
};
