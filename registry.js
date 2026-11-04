// ============================================================================
// REGISTRY.JS — Unified Data-Driven Catalogs (Cards, Relics, Potions, AI, Map)
// ============================================================================

import { CARD_REGISTRY, CARD_CATALOG, resolveCard } from "./cards.js";
import { RELIC_REGISTRY } from "./relics.js";
import { POTION_REGISTRY } from "./potions.js";
import {
  MAP_ROOM_TYPES,
  generateSectorMap,
  findMapNode,
  getSelectableNodeIds
} from "./map.js";

export {
  CARD_REGISTRY,
  CARD_CATALOG,
  resolveCard,
  RELIC_REGISTRY,
  POTION_REGISTRY,
  MAP_ROOM_TYPES,
  generateSectorMap,
  findMapNode,
  getSelectableNodeIds
};

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
      modifyOutgoingDamage(dmg, { source, multiplier = 1 }) {
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
 * ENEMY_REGISTRY
 * Defines Enemy archetypes and declarative Behavior Trees (`behaviorTree`).
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
        {
          type: 'weighted',
          options: [
            {
              weight: 40,
              intent: { id: 'pulse_laser', type: 'attack', value: 9, hits: 1, label: 'PULSE LASER' }
            },
            {
              weight: 35,
              intent: { id: 'twin_sweep', type: 'multi_attack', value: 4, hits: 2, label: 'TWIN SWEEP' }
            },
            {
              weight: 25,
              noRepeat: true,
              intent: { id: 'shield_matrix', type: 'attack_defend', value: 6, hits: 1, block: 6, label: 'BASH + SHIELD' }
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
        {
          type: 'condition',
          check: (enemy) => enemy.aiState?.lastMoveId === 'overcharge_core',
          child: {
            type: 'action',
            intent: { id: 'mega_crush', type: 'attack', value: 15, hits: 1, label: 'HEAVY SLAM' }
          }
        },
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
        {
          type: 'weighted',
          options: [
            {
              weight: 55,
              intent: { id: 'suppressive_fire', type: 'multi_attack', value: 4, hits: 2, status: { id: 'weak', stacks: 1 }, label: 'SUPPRESS' }
            },
            {
              weight: 45,
              intent: { id: 'armor_bash', type: 'attack_defend', value: 8, hits: 1, block: 5, label: 'IRON BASH' }
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
        {
          type: 'condition',
          check: (enemy, state) => {
            const alivePlayers = Object.values(state.players || {}).filter(p => p.isAlive);
            return alivePlayers.some(p => (p.statuses?.corrode || 0) >= 2) && enemy.aiState?.lastMoveId !== 'venom_flurry';
          },
          child: {
            type: 'action',
            intent: { id: 'venom_flurry', type: 'multi_attack', value: 4, hits: 3, label: 'VENOM FRENZY' }
          }
        },
        {
          type: 'weighted',
          options: [
            {
              weight: 50,
              intent: { id: 'toxic_bite', type: 'attack_debuff', value: 7, hits: 1, status: { id: 'corrode', stacks: 2 }, label: 'TOXIC BITE' }
            },
            {
              weight: 50,
              noRepeat: true,
              intent: { id: 'carapace_molt', type: 'defend_buff', block: 7, status: { id: 'thorns', stacks: 1 }, label: 'CHITIN (+7 SHD / +1 THORN)' }
            }
          ]
        }
      ]
    }
  },

  overlord_core: {
    id: 'overlord_core',
    namePrefix: 'OVERLORD-BOSS',
    baseHp: 75,
    hpPerFloor: 10,
    behaviorTree: {
      type: 'selector',
      children: [
        {
          type: 'condition',
          check: (enemy) => enemy.aiState?.lastMoveId === 'reactor_prime',
          child: {
            type: 'action',
            intent: { id: 'annihilation_beam', type: 'multi_attack', value: 6, hits: 3, label: 'ANNIHILATION BEAM' }
          }
        },
        {
          type: 'condition',
          check: (enemy) => (enemy.aiState?.turn || 0) % 3 === 1,
          child: {
            type: 'action',
            intent: {
              id: 'reactor_prime',
              type: 'defend_buff',
              block: 12,
              status: { id: 'strength', stacks: 2 },
              label: 'PRIME CORE (+12 SHD / +2 STR)'
            }
          }
        },
        {
          type: 'weighted',
          options: [
            {
              weight: 50,
              intent: { id: 'grav_crush', type: 'attack_debuff', value: 11, hits: 1, status: { id: 'vulnerable', stacks: 2 }, label: 'GRAV CRUSH' }
            },
            {
              weight: 50,
              intent: { id: 'bio_barrage', type: 'multi_attack', value: 5, hits: 2, status: { id: 'corrode', stacks: 2 }, label: 'BIO BARRAGE' }
            }
          ]
        }
      ]
    }
  }
};
