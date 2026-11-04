// ============================================================================
// REGISTRY.JS — Data-Driven Catalogs for Statuses, Cards, Relics & Enemy AI
// ============================================================================

/**
 * STATUS_REGISTRY
 * Defines stackable buffs and debuffs that participate in the hook pipeline.
 */
export const STATUS_REGISTRY = {
  strength: {
    id: 'strength',
    name: 'STR',
    type: 'buff',
    cssClass: 'str',
    description: 'Increases outgoing Attack damage by +1 per stack.',
    hooks: {
      modifyOutgoingDamage(dmg, { source, card, multiplier = 1 }) {
        const stacks = source?.statuses?.strength || 0;
        return dmg + stacks * multiplier;
      }
    }
  },
  dexterity: {
    id: 'dexterity',
    name: 'DEX',
    type: 'buff',
    cssClass: 'dex',
    description: 'Increases Shield gained from cards by +1 per stack.',
    hooks: {
      modifyBlockGained(block, { entity }) {
        const stacks = entity?.statuses?.dexterity || 0;
        return block + stacks;
      }
    }
  },
  weak: {
    id: 'weak',
    name: 'WEAK',
    type: 'debuff',
    cssClass: 'weak',
    description: 'Outgoing Attack damage is reduced by 25%. Decrements each turn.',
    hooks: {
      modifyOutgoingDamage(dmg, { source }) {
        if ((source?.statuses?.weak || 0) > 0) {
          return Math.floor(dmg * 0.75);
        }
        return dmg;
      },
      onTurnEnd({ entity }) {
        if ((entity?.statuses?.weak || 0) > 0) {
          entity.statuses.weak = Math.max(0, entity.statuses.weak - 1);
        }
      }
    }
  },
  vulnerable: {
    id: 'vulnerable',
    name: 'VULN',
    type: 'debuff',
    cssClass: 'vuln',
    description: 'Incoming Attack damage is increased by 50%. Decrements each turn.',
    hooks: {
      modifyIncomingDamage(dmg, { target }) {
        if ((target?.statuses?.vulnerable || 0) > 0) {
          return Math.floor(dmg * 1.5);
        }
        return dmg;
      },
      onTurnEnd({ entity }) {
        if ((entity?.statuses?.vulnerable || 0) > 0) {
          entity.statuses.vulnerable = Math.max(0, entity.statuses.vulnerable - 1);
        }
      }
    }
  },
  corrode: {
    id: 'corrode',
    name: 'CORR',
    type: 'debuff',
    cssClass: 'corrode',
    description: 'At the start of turn, lose HP equal to Corrode stacks, then reduce by 1.',
    hooks: {
      onTurnStart({ entity, ctx }) {
        const stacks = entity?.statuses?.corrode || 0;
        if (stacks > 0 && entity.hp > 0) {
          ctx.dealDirectHpLoss(entity, stacks, 'Corrode');
          entity.statuses.corrode = Math.max(0, stacks - 1);
        }
      }
    }
  },
  thorns: {
    id: 'thorns',
    name: 'THORN',
    type: 'buff',
    cssClass: 'thorns',
    description: 'When hit by an Attack, deal Thorns damage back to the attacker.',
    hooks: {
      onDamageTaken({ target, source, isAttack, ctx }) {
        const stacks = target?.statuses?.thorns || 0;
        if (stacks > 0 && isAttack && source && source !== target && source.hp > 0) {
          ctx.dealRawDamage(target, source, stacks, 'Thorns');
        }
      }
    }
  }
};

/**
 * CARD_REGISTRY
 * 14 distinct cards spanning basic, multi-hit, block-scaling, exhaust, and status-stacking archetypes.
 */
export const CARD_REGISTRY = {
  strike: {
    id: 'strike',
    name: 'STRIKE',
    cost: 1,
    type: 'attack',
    rarity: 'starter',
    tags: ['basic'],
    baseDamage: 6,
    hits: 1,
    description: 'Deal 6 damage.',
    onPlay(ctx) {
      ctx.dealDamage(ctx.player, ctx.target, 6, { card: this });
    }
  },
  defend: {
    id: 'defend',
    name: 'DEFEND',
    cost: 1,
    type: 'skill',
    rarity: 'starter',
    tags: ['basic'],
    baseShield: 5,
    description: 'Gain 5 Shield.',
    onPlay(ctx) {
      ctx.gainBlock(ctx.player, 5, { card: this });
    }
  },
  heavy_strike: {
    id: 'heavy_strike',
    name: 'HEAVY STRIKE',
    cost: 2,
    type: 'attack',
    rarity: 'common',
    tags: ['scaling'],
    baseDamage: 12,
    strengthMultiplier: 2,
    description: 'Deal 12 damage. STR affects this 2x.',
    onPlay(ctx) {
      ctx.dealDamage(ctx.player, ctx.target, 12, { card: this, strengthMultiplier: 2 });
    }
  },
  expose: {
    id: 'expose',
    name: 'EXPOSE',
    cost: 1,
    type: 'skill',
    rarity: 'starter',
    tags: ['status'],
    applyVulnerable: 2,
    applyWeak: 1,
    description: 'Apply 2 Vulnerable and 1 Weak.',
    onPlay(ctx) {
      ctx.applyStatus(ctx.player, ctx.target, 'vulnerable', 2);
      ctx.applyStatus(ctx.player, ctx.target, 'weak', 1);
    }
  },
  flurry: {
    id: 'flurry',
    name: 'TWIN BARRAGE',
    cost: 1,
    type: 'attack',
    rarity: 'common',
    tags: ['multi-hit'],
    baseDamage: 4,
    hits: 2,
    description: 'Deal 4 damage 2 times.',
    onPlay(ctx) {
      for (let i = 0; i < 2; i++) {
        if (ctx.target && ctx.target.hp > 0) {
          ctx.dealDamage(ctx.player, ctx.target, 4, { card: this });
        }
      }
    }
  },
  gatling_protocol: {
    id: 'gatling_protocol',
    name: 'GATLING PROTOCOL',
    cost: 2,
    type: 'attack',
    rarity: 'uncommon',
    tags: ['multi-hit'],
    baseDamage: 3,
    hits: 4,
    description: 'Deal 3 damage 4 times.',
    onPlay(ctx) {
      for (let i = 0; i < 4; i++) {
        if (ctx.target && ctx.target.hp > 0) {
          ctx.dealDamage(ctx.player, ctx.target, 3, { card: this });
        }
      }
    }
  },
  shield_slam: {
    id: 'shield_slam',
    name: 'BASTION SLAM',
    cost: 1,
    type: 'attack',
    rarity: 'uncommon',
    tags: ['block-scaling'],
    baseShield: 3,
    dynamicDamage(player) {
      return (player?.shield || 0) + 3;
    },
    description: 'Gain 3 Shield. Deal damage equal to your Shield.',
    onPlay(ctx) {
      ctx.gainBlock(ctx.player, 3, { card: this });
      const dmg = ctx.player.shield || 0;
      ctx.dealDamage(ctx.player, ctx.target, dmg, { card: this });
    }
  },
  fortify: {
    id: 'fortify',
    name: 'FORTIFY',
    cost: 2,
    type: 'skill',
    rarity: 'uncommon',
    tags: ['block-scaling'],
    baseShield: 4,
    description: 'Gain 4 Shield, then double your Shield.',
    onPlay(ctx) {
      ctx.gainBlock(ctx.player, 4, { card: this });
      const current = ctx.player.shield || 0;
      if (current > 0) {
        ctx.player.shield += current;
        ctx.log(`[CARD] ${ctx.player.name} doubled Shield to ${ctx.player.shield}.`);
      }
    }
  },
  overclock: {
    id: 'overclock',
    name: 'OVERCLOCK',
    cost: 0,
    type: 'skill',
    rarity: 'rare',
    tags: ['exhaust', 'cycle'],
    exhaust: true,
    description: 'Gain 2 Energy. Draw 2 cards. Exhaust.',
    onPlay(ctx) {
      ctx.gainEnergy(ctx.player, 2);
      ctx.drawCards(ctx.player, 2);
    }
  },
  emp_blast: {
    id: 'emp_blast',
    name: 'EMP DETONATION',
    cost: 2,
    type: 'attack',
    rarity: 'rare',
    tags: ['exhaust', 'status'],
    exhaust: true,
    baseDamage: 14,
    description: 'Deal 14 damage. Apply 2 Weak & 2 Vulnerable. Exhaust.',
    onPlay(ctx) {
      ctx.dealDamage(ctx.player, ctx.target, 14, { card: this });
      ctx.applyStatus(ctx.player, ctx.target, 'weak', 2);
      ctx.applyStatus(ctx.player, ctx.target, 'vulnerable', 2);
    }
  },
  nanite_cloud: {
    id: 'nanite_cloud',
    name: 'NANITE CLOUD',
    cost: 1,
    type: 'skill',
    rarity: 'uncommon',
    tags: ['exhaust', 'status-stacking'],
    exhaust: true,
    description: 'Apply 5 Corrode and 1 Weak. Exhaust.',
    onPlay(ctx) {
      ctx.applyStatus(ctx.player, ctx.target, 'corrode', 5);
      ctx.applyStatus(ctx.player, ctx.target, 'weak', 1);
    }
  },
  venom_blade: {
    id: 'venom_blade',
    name: 'CORROSIVE STRIKE',
    cost: 1,
    type: 'attack',
    rarity: 'common',
    tags: ['status-stacking'],
    baseDamage: 5,
    description: 'Deal 5 damage. Apply 3 Corrode.',
    onPlay(ctx) {
      ctx.dealDamage(ctx.player, ctx.target, 5, { card: this });
      ctx.applyStatus(ctx.player, ctx.target, 'corrode', 3);
    }
  },
  catalyze: {
    id: 'catalyze',
    name: 'CATALYZE',
    cost: 1,
    type: 'skill',
    rarity: 'rare',
    tags: ['exhaust', 'status-stacking'],
    exhaust: true,
    description: 'Double enemy Corrode stacks. Exhaust.',
    onPlay(ctx) {
      const current = ctx.target?.statuses?.corrode || 0;
      if (current > 0) {
        ctx.applyStatus(ctx.player, ctx.target, 'corrode', current);
      } else {
        ctx.log(`[CARD] ${ctx.target?.name || 'Enemy'} has no Corrode to double.`);
      }
    }
  },
  siphon_strike: {
    id: 'siphon_strike',
    name: 'BLOOD SIPHON',
    cost: 2,
    type: 'attack',
    rarity: 'uncommon',
    tags: ['exhaust', 'sustain'],
    exhaust: true,
    baseDamage: 8,
    description: 'Deal 8 damage. Heal 4 HP. Exhaust.',
    onPlay(ctx) {
      ctx.dealDamage(ctx.player, ctx.target, 8, { card: this });
      ctx.healEntity(ctx.player, 4, 'Blood Siphon');
    }
  }
};

// Backwards-compatible alias for legacy references (e.g. inflict_vuln -> expose)
CARD_REGISTRY.inflict_vuln = CARD_REGISTRY.expose;
export const CARD_CATALOG = CARD_REGISTRY;

/**
 * RELIC_REGISTRY
 * 7 Relics subscribing to lifecycle hooks (onBattleStart, onTurnStart, onCardPlayed,
 * onCardExhausted, modifyOutgoingDamage, onDamageTaken, onBattleVictory).
 */
export const RELIC_REGISTRY = {
  anchor_module: {
    id: 'anchor_module',
    name: 'ANCHOR MODULE',
    shortLabel: 'ANC',
    description: 'Start each combat with +10 Shield.',
    hooks: {
      onBattleStart({ player, ctx }) {
        ctx.gainBlock(player, 10, { raw: true, sourceName: 'Anchor Module' });
      }
    }
  },
  vampiric_siphon: {
    id: 'vampiric_siphon',
    name: 'VAMPIRIC SIPHON',
    shortLabel: 'VMP',
    description: 'At the end of combat, heal 6 HP.',
    hooks: {
      onBattleVictory({ player, ctx }) {
        ctx.healEntity(player, 6, 'Vampiric Siphon');
      }
    }
  },
  rage_capacitor: {
    id: 'rage_capacitor',
    name: 'RAGE CAPACITOR',
    shortLabel: 'RAG',
    description: 'Every 3rd Attack played in a turn grants +1 STR and deals 4 damage.',
    hooks: {
      onBattleStart({ relicState }) {
        relicState.counter = 0;
      },
      onTurnStart({ relicState }) {
        relicState.counter = 0;
      },
      onCardPlayed({ player, cardDef, relicState, ctx }) {
        if (cardDef.type === 'attack') {
          relicState.counter = (relicState.counter || 0) + 1;
          if (relicState.counter >= 3) {
            relicState.counter = 0;
            ctx.applyStatus(player, player, 'strength', 1);
            if (ctx.target && ctx.target.hp > 0) {
              ctx.dealRawDamage(player, ctx.target, 4, 'Rage Capacitor');
            }
          }
        }
      }
    }
  },
  kinetic_converter: {
    id: 'kinetic_converter',
    name: 'KINETIC CONVERTER',
    shortLabel: 'KIN',
    description: 'Whenever a card is Exhausted, gain 4 Shield and draw 1 card.',
    hooks: {
      onCardExhausted({ player, ctx }) {
        ctx.gainBlock(player, 4, { raw: true, sourceName: 'Kinetic Converter' });
        ctx.drawCards(player, 1);
      }
    }
  },
  overcharged_core: {
    id: 'overcharged_core',
    name: 'OVERCHARGED CORE',
    shortLabel: 'OVR',
    description: 'Start combat with +1 Energy on Turn 1. Deal +2 Attack damage while >=80% HP.',
    hooks: {
      onBattleStart({ player, ctx }) {
        ctx.gainEnergy(player, 1, 'Overcharged Core');
      },
      modifyOutgoingDamage(dmg, { source }) {
        if (source && source.hp >= source.maxHp * 0.8) {
          return dmg + 2;
        }
        return dmg;
      }
    }
  },
  spiked_chassis: {
    id: 'spiked_chassis',
    name: 'SPIKED CHASSIS',
    shortLabel: 'SPK',
    description: 'Start combat with 2 Thorns. First time you lose HP each combat, gain 6 Shield & 1 DEX.',
    hooks: {
      onBattleStart({ player, relicState, ctx }) {
        relicState.counter = 1; // 1 charge available
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
    id: 'mercury_hourglass',
    name: 'CHRONO EMITTER',
    shortLabel: 'CHR',
    description: 'At the start of your turn, deal 3 damage and apply 1 Corrode to the enemy.',
    hooks: {
      onTurnStart({ player, ctx }) {
        for (const enemy of ctx.state.enemies) {
          if (enemy.hp > 0) {
            ctx.dealRawDamage(player, enemy, 3, 'Chrono Emitter');
            ctx.applyStatus(player, enemy, 'corrode', 1);
          }
        }
      }
    }
  }
};

/**
 * ENEMY_REGISTRY
 * Defines Enemy archetypes and declarative Behavior Trees (`behaviorTree`).
 * Node types supported by engine.js:
 * - { type: 'selector', children: [...] } -> returns first matching child intent
 * - { type: 'condition', check: (enemy, state) => boolean, child: {...} }
 * - { type: 'cycle', steps: [...] } -> deterministic turn cycle
 * - { type: 'weighted', options: [{ weight, intent }] } -> weighted choice (avoids repeating non-repeatable moves)
 * - { type: 'action', intent: {...} } -> leaf intent descriptor
 */
export const ENEMY_REGISTRY = {
  sentinel_drone: {
    id: 'sentinel_drone',
    namePrefix: 'SENTINEL',
    baseHp: 36,
    hpPerFloor: 6,
    behaviorTree: {
      type: 'selector',
      children: [
        // 1. Emergency Guard: if HP < 40% and hasn't just guarded, fortify + buff
        {
          type: 'condition',
          check: (enemy) => enemy.hp <= enemy.maxHp * 0.4 && enemy.aiState?.lastMoveId !== 'emergency_guard',
          child: {
            type: 'action',
            intent: {
              id: 'emergency_guard',
              type: 'defend_buff',
              block: 10,
              status: { id: 'strength', stacks: 2 },
              label: 'GUARD +10 / STR +2'
            }
          }
        },
        // 2. Turn 1 opening scan or debuff
        {
          type: 'condition',
          check: (enemy) => (enemy.aiState?.turn || 0) === 0,
          child: {
            type: 'action',
            intent: {
              id: 'target_lock',
              type: 'attack_debuff',
              value: 6,
              hits: 1,
              status: { id: 'vulnerable', stacks: 2 },
              label: 'LOCK-ON'
            }
          }
        },
        // 3. Weighted tactical choices
        {
          type: 'weighted',
          options: [
            {
              weight: 40,
              intent: {
                id: 'pulse_laser',
                type: 'attack',
                value: 9,
                hits: 1,
                label: 'PULSE LASER'
              }
            },
            {
              weight: 35,
              intent: {
                id: 'twin_sweep',
                type: 'multi_attack',
                value: 4,
                hits: 2,
                label: 'TWIN SWEEP'
              }
            },
            {
              weight: 25,
              noRepeat: true,
              intent: {
                id: 'shield_matrix',
                type: 'attack_defend',
                value: 6,
                hits: 1,
                block: 6,
                label: 'BASH + SHIELD'
              }
            }
          ]
        }
      ]
    }
  },

  enforcer_mech: {
    id: 'enforcer_mech',
    namePrefix: 'ENFORCER',
    baseHp: 46,
    hpPerFloor: 8,
    behaviorTree: {
      type: 'selector',
      children: [
        // 1. Follow up Overcharge immediately with Mega Crush!
        {
          type: 'condition',
          check: (enemy) => enemy.aiState?.lastMoveId === 'overcharge_core',
          child: {
            type: 'action',
            intent: {
              id: 'mega_crush',
              type: 'attack',
              value: 15,
              hits: 1,
              label: 'HEAVY SLAM'
            }
          }
        },
        // 2. Every 3rd turn (or when low shield), Overcharge
        {
          type: 'condition',
          check: (enemy) => (enemy.aiState?.turn || 0) % 3 === 1 && enemy.aiState?.lastMoveId !== 'overcharge_core',
          child: {
            type: 'action',
            intent: {
              id: 'overcharge_core',
              type: 'defend_buff',
              block: 8,
              status: { id: 'strength', stacks: 2 },
              label: 'CHARGE (+8 SHD / +2 STR)'
            }
          }
        },
        // 3. Otherwise alternate between Suppressive Fire and Armor Bash
        {
          type: 'weighted',
          options: [
            {
              weight: 55,
              intent: {
                id: 'suppressive_fire',
                type: 'multi_attack',
                value: 4,
                hits: 2,
                status: { id: 'weak', stacks: 1 },
                label: 'SUPPRESS'
              }
            },
            {
              weight: 45,
              intent: {
                id: 'armor_bash',
                type: 'attack_defend',
                value: 8,
                hits: 1,
                block: 5,
                label: 'IRON BASH'
              }
            }
          ]
        }
      ]
    }
  },

  plague_weaver: {
    id: 'plague_weaver',
    namePrefix: 'BIO-WEAVER',
    baseHp: 38,
    hpPerFloor: 7,
    behaviorTree: {
      type: 'selector',
      children: [
        // 1. Turn 1: Acid Spray (Corrode + Weak)
        {
          type: 'condition',
          check: (enemy) => (enemy.aiState?.turn || 0) === 0,
          child: {
            type: 'action',
            intent: {
              id: 'acid_spray',
              type: 'debuff',
              status: { id: 'corrode', stacks: 3 },
              secondaryStatus: { id: 'weak', stacks: 1 },
              label: 'ACID SPRAY (3 CORR / 1 WEAK)'
            }
          }
        },
        // 2. If target has Corrode >= 2, execute multi-hit Venom Fang
        {
          type: 'condition',
          check: (enemy, state) => {
            const alivePlayers = Object.values(state.players || {}).filter(p => p.isAlive);
            return alivePlayers.some(p => (p.statuses?.corrode || 0) >= 2) && enemy.aiState?.lastMoveId !== 'venom_flurry';
          },
          child: {
            type: 'action',
            intent: {
              id: 'venom_flurry',
              type: 'multi_attack',
              value: 4,
              hits: 3,
              label: 'VENOM FRENZY'
            }
          }
        },
        // 3. Weighted fallback
        {
          type: 'weighted',
          options: [
            {
              weight: 50,
              intent: {
                id: 'toxic_bite',
                type: 'attack_debuff',
                value: 7,
                hits: 1,
                status: { id: 'corrode', stacks: 2 },
                label: 'TOXIC BITE'
              }
            },
            {
              weight: 50,
              noRepeat: true,
              intent: {
                id: 'carapace_molt',
                type: 'defend_buff',
                block: 7,
                status: { id: 'thorns', stacks: 1 },
                label: 'CHITIN (+7 SHD / +1 THORN)'
              }
            }
          ]
        }
      ]
    }
  }
};
