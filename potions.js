// ============================================================================
// POTIONS.JS — 34+ Potions & 3-Slot Potion System
// ============================================================================

export const POTION_REGISTRY = {
  // --- OFFENSIVE POTIONS ---
  fire_potion: {
    id: 'fire_potion', name: 'THERMITE VIAL', icon: '🧪',
    description: 'Deal 20 damage to the enemy.',
    onUse(ctx) { ctx.dealRawDamage(ctx.player, ctx.target, 20, 'Thermite Vial'); }
  },
  explosive_ampoule: {
    id: 'explosive_ampoule', name: 'PLASMA GRENADE', icon: '💥',
    description: 'Deal 14 damage and apply 2 Vulnerable.',
    onUse(ctx) {
      ctx.dealRawDamage(ctx.player, ctx.target, 14, 'Plasma Grenade');
      ctx.applyStatus(ctx.player, ctx.target, 'vulnerable', 2);
    }
  },
  shrapnel_flask: {
    id: 'shrapnel_flask', name: 'FLECHETTE FLASK', icon: '🧪',
    description: 'Deal 6 damage 3 times (affected by STR/VULN).',
    onUse(ctx) {
      for (let i = 0; i < 3; i++) {
        if (ctx.target && ctx.target.hp > 0) ctx.dealDamage(ctx.player, ctx.target, 6, { sourceName: 'Flechette Flask' });
      }
    }
  },
  shield_breaker_vial: {
    id: 'shield_breaker_vial', name: 'EMP SOLVENT', icon: '⚡',
    description: 'Destroy all enemy Shield and deal 12 damage.',
    onUse(ctx) {
      if (ctx.target) ctx.target.shield = 0;
      ctx.dealRawDamage(ctx.player, ctx.target, 12, 'EMP Solvent');
    }
  },
  execution_tonic: {
    id: 'execution_tonic', name: 'REAPER SERUM', icon: '☠️',
    description: 'Deal 15 damage (30 damage if enemy HP <= 50%).',
    onUse(ctx) {
      const low = ctx.target && ctx.target.hp <= ctx.target.maxHp * 0.5;
      ctx.dealRawDamage(ctx.player, ctx.target, low ? 30 : 15, 'Reaper Serum');
    }
  },

  // --- DEFENSIVE & SUSTAIN POTIONS ---
  block_potion: {
    id: 'block_potion', name: 'AEGIS AMPOULE', icon: '🛡️',
    description: 'Gain 14 Shield.',
    onUse(ctx) { ctx.gainBlock(ctx.player, 14, { raw: true, sourceName: 'Aegis Ampoule' }); }
  },
  titanium_draught: {
    id: 'titanium_draught', name: 'TITANIUM DRAUGHT', icon: '🛡️',
    description: 'Gain 10 Shield and +2 Dexterity.',
    onUse(ctx) {
      ctx.gainBlock(ctx.player, 10, { raw: true, sourceName: 'Titanium Draught' });
      ctx.applyStatus(ctx.player, ctx.player, 'dexterity', 2);
    }
  },
  liquid_bronze: {
    id: 'liquid_bronze', name: 'LIQUID THORNS', icon: '🌵',
    description: 'Gain 4 Thorns and 6 Shield.',
    onUse(ctx) {
      ctx.applyStatus(ctx.player, ctx.player, 'thorns', 4);
      ctx.gainBlock(ctx.player, 6, { raw: true, sourceName: 'Liquid Thorns' });
    }
  },
  regen_potion: {
    id: 'regen_potion', name: 'NANO-MED VIAL', icon: '❤️',
    description: 'Heal 12 HP.',
    onUse(ctx) { ctx.healEntity(ctx.player, 12, 'Nano-Med Vial'); }
  },
  blood_potion: {
    id: 'blood_potion', name: 'CRIMSON INFUSION', icon: '🩸',
    description: 'Heal 25% of your Max HP.',
    onUse(ctx) {
      const amt = Math.max(8, Math.floor((ctx.player.maxHp || 56) * 0.25));
      ctx.healEntity(ctx.player, amt, 'Crimson Infusion');
    }
  },
  fruit_juice_cell: {
    id: 'fruit_juice_cell', name: 'VITALITY NECTAR', icon: '🧬',
    description: 'Permanently gain +6 Max HP and heal 6 HP.',
    onUse(ctx) {
      ctx.player.maxHp = (ctx.player.maxHp || 56) + 6;
      ctx.healEntity(ctx.player, 6, 'Vitality Nectar');
    }
  },
  cleanse_tonic: {
    id: 'cleanse_tonic', name: 'PURITY ELIXIR', icon: '✨',
    description: 'Clear all debuffs from yourself and gain 10 Shield.',
    onUse(ctx) {
      if (ctx.player.statuses) {
        ctx.player.statuses.weak = 0;
        ctx.player.statuses.vulnerable = 0;
        ctx.player.statuses.corrode = 0;
      }
      ctx.gainBlock(ctx.player, 10, { raw: true, sourceName: 'Purity Elixir' });
    }
  },
  fortify_brew: {
    id: 'fortify_brew', name: 'BASTION BREW', icon: '🛡️',
    description: 'Gain 6 Shield, then double your current Shield.',
    onUse(ctx) {
      ctx.gainBlock(ctx.player, 6, { raw: true, sourceName: 'Bastion Brew' });
      ctx.player.shield = (ctx.player.shield || 0) * 2;
      ctx.log(`[POTION] Bastion Brew doubled Shield to ${ctx.player.shield}.`);
    }
  },

  // --- STATUS & DEBUFF POTIONS ---
  poison_potion: {
    id: 'poison_potion', name: 'CORROSIVE VIAL', icon: '☣️',
    description: 'Apply 7 Corrode to the enemy.',
    onUse(ctx) { ctx.applyStatus(ctx.player, ctx.target, 'corrode', 7); }
  },
  catalyst_potion: {
    id: 'catalyst_potion', name: 'MUTAGEN CATALYST', icon: '☣️',
    description: 'Apply 3 Corrode, then double enemy Corrode stacks.',
    onUse(ctx) {
      ctx.applyStatus(ctx.player, ctx.target, 'corrode', 3);
      const cur = ctx.target?.statuses?.corrode || 0;
      if (cur > 0) ctx.applyStatus(ctx.player, ctx.target, 'corrode', cur);
    }
  },
  fear_potion: {
    id: 'fear_potion', name: 'TERROR GAS', icon: '🟠',
    description: 'Apply 4 Vulnerable to the enemy.',
    onUse(ctx) { ctx.applyStatus(ctx.player, ctx.target, 'vulnerable', 4); }
  },
  weak_potion: {
    id: 'weak_potion', name: 'NEURAL DAMPENER', icon: '🟣',
    description: 'Apply 4 Weak to the enemy.',
    onUse(ctx) { ctx.applyStatus(ctx.player, ctx.target, 'weak', 4); }
  },
  crippling_cloud_vial: {
    id: 'crippling_cloud_vial', name: 'SMOG CANISTER', icon: '☁️',
    description: 'Apply 5 Corrode, 2 Weak, and 2 Vulnerable.',
    onUse(ctx) {
      ctx.applyStatus(ctx.player, ctx.target, 'corrode', 5);
      ctx.applyStatus(ctx.player, ctx.target, 'weak', 2);
      ctx.applyStatus(ctx.player, ctx.target, 'vulnerable', 2);
    }
  },

  // --- BUFF & SCALING POTIONS ---
  strength_potion: {
    id: 'strength_potion', name: 'MIGHT SERUM', icon: '💪',
    description: 'Gain +2 Strength.',
    onUse(ctx) { ctx.applyStatus(ctx.player, ctx.player, 'strength', 2); }
  },
  dexterity_potion: {
    id: 'dexterity_potion', name: 'REFLEX SERUM', icon: '⚡',
    description: 'Gain +2 Dexterity.',
    onUse(ctx) { ctx.applyStatus(ctx.player, ctx.player, 'dexterity', 2); }
  },
  cultist_potion: {
    id: 'cultist_potion', name: 'OVERDRIVE SERUM', icon: '🔥',
    description: 'Gain +3 Strength and +1 Energy.',
    onUse(ctx) {
      ctx.applyStatus(ctx.player, ctx.player, 'strength', 3);
      ctx.gainEnergy(ctx.player, 1, 'Overdrive Serum');
    }
  },
  heart_of_iron: {
    id: 'heart_of_iron', name: 'IRONCORE ELIXIR', icon: '⚙️',
    description: 'Gain +2 Dexterity, +2 Thorns, and 8 Shield.',
    onUse(ctx) {
      ctx.applyStatus(ctx.player, ctx.player, 'dexterity', 2);
      ctx.applyStatus(ctx.player, ctx.player, 'thorns', 2);
      ctx.gainBlock(ctx.player, 8, { raw: true, sourceName: 'Ironcore Elixir' });
    }
  },
  steroid_surge: {
    id: 'steroid_surge', name: 'HYPER STIM', icon: '💉',
    description: 'Double your current Strength (minimum +2 STR).',
    onUse(ctx) {
      const cur = ctx.player.statuses?.strength || 0;
      ctx.applyStatus(ctx.player, ctx.player, 'strength', Math.max(2, cur));
    }
  },

  // --- ENERGY, DRAW & CARD UPGRADE POTIONS ---
  energy_potion: {
    id: 'energy_potion', name: 'PLASMA BATTERY', icon: '🔋',
    description: 'Gain +2 Energy.',
    onUse(ctx) { ctx.gainEnergy(ctx.player, 2, 'Plasma Battery'); }
  },
  super_energy_vial: {
    id: 'super_energy_vial', name: 'REACTOR COOLANT', icon: '🔋',
    description: 'Gain +3 Energy and draw 1 card.',
    onUse(ctx) {
      ctx.gainEnergy(ctx.player, 3, 'Reactor Coolant');
      ctx.drawCards(ctx.player, 1);
    }
  },
  swift_potion: {
    id: 'swift_potion', name: 'NEURAL BOOST', icon: '🃏',
    description: 'Draw 3 cards.',
    onUse(ctx) { ctx.drawCards(ctx.player, 3); }
  },
  snecko_oil: {
    id: 'snecko_oil', name: 'QUANTUM OIL', icon: '🌀',
    description: 'Draw 4 cards and gain +1 Energy.',
    onUse(ctx) {
      ctx.drawCards(ctx.player, 4);
      ctx.gainEnergy(ctx.player, 1, 'Quantum Oil');
    }
  },
  blessing_of_the_forge: {
    id: 'blessing_of_the_forge', name: 'FORGE TONIC', icon: '🔨',
    description: 'Upgrade ALL cards in your hand for the rest of combat (and 1 permanently in Master Deck).',
    onUse(ctx) {
      for (const c of ctx.player.hand || []) c.upgraded = true;
      const unup = (ctx.player.masterDeck || []).filter(c => !c.upgraded);
      if (unup.length > 0) {
        const pick = unup[Math.floor(Math.random() * unup.length)];
        pick.upgraded = true;
      }
      ctx.log('[POTION] Forge Tonic upgraded your hand and 1 Master Deck card!');
    }
  },
  gamblers_brew: {
    id: 'gamblers_brew', name: 'GAMBLER BREW', icon: '🎲',
    description: 'Discard your hand, then draw 5 cards and gain 5 Shield.',
    onUse(ctx) {
      ctx.player.discard.push(...ctx.player.hand);
      ctx.player.hand = [];
      ctx.drawCards(ctx.player, 5);
      ctx.gainBlock(ctx.player, 5, { raw: true, sourceName: 'Gambler Brew' });
    }
  },
  elixir_of_ash: {
    id: 'elixir_of_ash', name: 'VOID SOLVENT', icon: '🔮',
    description: 'Exhaust 1 random card in hand, gain +2 Energy, and draw 2 cards.',
    onUse(ctx) {
      if (ctx.player.hand.length > 0) {
        const [ex] = ctx.player.hand.splice(0, 1);
        ctx.exhaustCard(ctx.player, ex);
      }
      ctx.gainEnergy(ctx.player, 2, 'Void Solvent');
      ctx.drawCards(ctx.player, 2);
    }
  },
  liquid_memories: {
    id: 'liquid_memories', name: 'MEMORY EXTRACT', icon: '🧠',
    description: 'Return up to 2 cards from your Discard pile to your hand (upgraded) and gain +1 Energy.',
    onUse(ctx) {
      for (let i = 0; i < 2; i++) {
        if (ctx.player.discard.length > 0) {
          const c = ctx.player.discard.pop();
          c.upgraded = true;
          ctx.player.hand.push(c);
        }
      }
      ctx.gainEnergy(ctx.player, 1, 'Memory Extract');
    }
  },
  ambrosia_charge: {
    id: 'ambrosia_charge', name: 'DIVINE AMBROSIA', icon: '🌟',
    description: 'Gain +2 Energy, +2 STR, +2 DEX, and draw 2 cards.',
    onUse(ctx) {
      ctx.gainEnergy(ctx.player, 2, 'Divine Ambrosia');
      ctx.applyStatus(ctx.player, ctx.player, 'strength', 2);
      ctx.applyStatus(ctx.player, ctx.player, 'dexterity', 2);
      ctx.drawCards(ctx.player, 2);
    }
  },
  vampire_draught: {
    id: 'vampire_draught', name: 'SIPHON ELIXIR', icon: '🧛',
    description: 'Deal 12 damage to the enemy and heal 8 HP.',
    onUse(ctx) {
      ctx.dealRawDamage(ctx.player, ctx.target, 12, 'Siphon Elixir');
      ctx.healEntity(ctx.player, 8, 'Siphon Elixir');
    }
  },
  entropic_brew: {
    id: 'entropic_brew', name: 'ENTROPIC BREW', icon: '⚗️',
    description: 'Gain 8 Shield, +1 Energy, and brew random Potions into your other empty slots.',
    onUse(ctx) {
      ctx.gainBlock(ctx.player, 8, { raw: true, sourceName: 'Entropic Brew' });
      ctx.gainEnergy(ctx.player, 1, 'Entropic Brew');
      ctx.grantRandomPotion(ctx.player, 'Entropic Brew');
      ctx.grantRandomPotion(ctx.player, 'Entropic Brew');
    }
  }
};
