// ============================================================================
// ENGINE.JS — Hook Pipeline, Multi-Enemy Combat, Classes, Mutators, Shop & Events
// ============================================================================

import {
  STATUS_REGISTRY,
  CARD_REGISTRY,
  CARD_CATALOG,
  resolveCard,
  RELIC_REGISTRY,
  POTION_REGISTRY,
  ENEMY_REGISTRY,
  MAP_ROOM_TYPES,
  generateSectorMap,
  findMapNode,
  getSelectableNodeIds,
  OPERATIVE_CLASSES,
  RUN_MUTATORS,
  CURSE_CARDS,
  EVENT_REGISTRY,
  generateShopStock,
  grantRandomNonStarterRelic,
  purgeWeakestCard,
  transformStarterCards,
  loadCareerProfile,
  saveCareerProfile,
  updateCareerStat
} from "./registry.js";

export {
  STATUS_REGISTRY,
  CARD_REGISTRY,
  CARD_CATALOG,
  resolveCard,
  RELIC_REGISTRY,
  POTION_REGISTRY,
  ENEMY_REGISTRY,
  MAP_ROOM_TYPES,
  generateSectorMap,
  findMapNode,
  getSelectableNodeIds,
  OPERATIVE_CLASSES,
  RUN_MUTATORS,
  CURSE_CARDS,
  EVENT_REGISTRY,
  generateShopStock,
  grantRandomNonStarterRelic,
  purgeWeakestCard,
  transformStarterCards,
  loadCareerProfile,
  saveCareerProfile,
  updateCareerStat
};

// ----------------------------------------------------------------------------
// 1. Pure Utility & Starter Deck (4 Strikes, 4 Defends, 2 Random Commons)
// ----------------------------------------------------------------------------

export function createDefaultStatuses() {
  return {
    strength: 0,
    dexterity: 0,
    weak: 0,
    vulnerable: 0,
    corrode: 0,
    thorns: 0
  };
}

export function ensureEntityStatuses(entity) {
  if (!entity.statuses) {
    entity.statuses = createDefaultStatuses();
  } else {
    for (const k of Object.keys(STATUS_REGISTRY)) {
      if (typeof entity.statuses[k] !== 'number') {
        entity.statuses[k] = 0;
      }
    }
  }
  return entity.statuses;
}

export function calculateDamage(baseDamage, attackerStrength = 0, attackerWeak = 0, targetVulnerable = 0, strengthMultiplier = 1) {
  let dmg = baseDamage + (attackerStrength * strengthMultiplier);
  if (attackerWeak > 0) dmg = Math.floor(dmg * 0.75);
  if (targetVulnerable > 0) dmg = Math.floor(dmg * 1.5);
  return Math.max(0, dmg);
}

export function applyDamageToEntity(incomingDamage, currentShield, currentHp) {
  const shieldDamage = Math.min(currentShield, incomingDamage);
  const remainingDmg = incomingDamage - shieldDamage;
  const hpDamage = Math.min(currentHp, remainingDmg);

  return {
    shieldDamage,
    hpDamage,
    finalShield: currentShield - shieldDamage,
    finalHp: Math.max(0, currentHp - hpDamage)
  };
}

/**
 * Starter deck: 4 Strikes, 4 Defends, and 2 Random Common Cards
 * (or 10 randomized archetype cards when `draftProtocol` mutator is active).
 */
export function createStarterDeck(classId = 'vanguard', draftProtocol = false) {
  const cards = [];
  const add = (id, count, upgraded = false) => {
    for (let i = 0; i < count; i++) {
      cards.push({
        instanceId: 'C_' + Math.random().toString(36).substring(2, 8),
        defId: id,
        upgraded
      });
    }
  };

  if (draftProtocol) {
    const allPlayable = Object.values(CARD_REGISTRY).filter(
      c => c.rarity !== 'starter' && c.rarity !== 'curse' && c.id !== 'inflict_vuln'
    );
    for (let i = 0; i < 10; i++) {
      const pick = allPlayable[Math.floor(Math.random() * allPlayable.length)];
      if (pick) add(pick.id, 1, Math.random() < 0.25);
    }
    return cards;
  }

  // Strictly 4 Strikes, 4 Defends, and 2 Random Common Cards
  add('strike', 4, false);
  add('defend', 4, false);

  const commonPool = Object.values(CARD_REGISTRY).filter(
    c => c.rarity === 'common' && c.id !== 'strike' && c.id !== 'defend' && c.id !== 'inflict_vuln'
  );
  for (let i = 0; i < 2; i++) {
    if (commonPool.length > 0) {
      const pick = commonPool[Math.floor(Math.random() * commonPool.length)];
      add(pick.id, 1, false);
    }
  }

  return cards.sort(() => Math.random() - 0.5);
}

export function rollStarterRelicChoices(count = 3) {
  const starterIds = Object.values(RELIC_REGISTRY)
    .filter(r => r.tier === 'starter')
    .map(r => r.id);
  return [...starterIds].sort(() => Math.random() - 0.5).slice(0, count);
}

export function getEffectiveCardCost(cardInstance, def) {
  if (cardInstance && typeof cardInstance.costOverride === 'number') {
    return cardInstance.costOverride;
  }
  return def?.cost ?? 1;
}

export function drawCards(player, count, state = null) {
  if (!player.hand) player.hand = [];
  if (!player.deck) player.deck = [];
  if (!player.discard) player.discard = [];
  if (!player.exhaust) player.exhaust = [];

  const isSnecko = Array.isArray(state?.mutators) && state.mutators.includes('volatile_compiler');

  for (let i = 0; i < count; i++) {
    if (player.hand.length >= 10) break;
    if (player.deck.length === 0) {
      if (player.discard.length === 0) break;
      player.deck = [...player.discard].sort(() => Math.random() - 0.5);
      player.discard = [];
      if (state?.combatLog) {
        state.combatLog.push(`[DECK] ${player.name} reshuffled discard pile.`);
      }
    }
    const drawn = player.deck.pop();
    if (drawn) {
      if (isSnecko) {
        drawn.costOverride = Math.floor(Math.random() * 3); // 0, 1, or 2
      }
      player.hand.push(drawn);
    }
  }
}

// ----------------------------------------------------------------------------
// 2. Event-Driven Hook Pipeline
// ----------------------------------------------------------------------------

export function runModifierHook(hookName, initialValue, payload, state) {
  let value = initialValue;
  const ctx = createBattleContext(state, payload.player || payload.source, payload.target);

  if (hookName === 'modifyOutgoingDamage') {
    const source = payload.source;
    ensureEntityStatuses(source);

    const strHook = STATUS_REGISTRY.strength?.hooks?.modifyOutgoingDamage;
    if (strHook && source.statuses.strength !== 0) {
      value = strHook(value, { ...payload, ctx });
    }

    if (Array.isArray(source?.relics)) {
      for (const relicState of source.relics) {
        const relicDef = RELIC_REGISTRY[relicState.id];
        const fn = relicDef?.hooks?.[hookName];
        if (fn) {
          value = fn(value, { ...payload, player: source, relicState, ctx });
        }
      }
    }

    const weakHook = STATUS_REGISTRY.weak?.hooks?.modifyOutgoingDamage;
    if (weakHook && source.statuses.weak > 0) {
      value = weakHook(value, { ...payload, ctx });
    }

    // Mutator: Glass World (+40% outgoing damage for everyone)
    if (Array.isArray(state?.mutators) && state.mutators.includes('glass_world')) {
      value = Math.floor(value * 1.4);
    }
  } else if (hookName === 'modifyIncomingDamage') {
    const target = payload.target;
    ensureEntityStatuses(target);

    if (Array.isArray(target?.relics)) {
      for (const relicState of target.relics) {
        const relicDef = RELIC_REGISTRY[relicState.id];
        const fn = relicDef?.hooks?.[hookName];
        if (fn) {
          value = fn(value, { ...payload, player: target, relicState, ctx });
        }
      }
    }

    const vulnHook = STATUS_REGISTRY.vulnerable?.hooks?.modifyIncomingDamage;
    if (vulnHook && target.statuses.vulnerable > 0) {
      value = vulnHook(value, { ...payload, ctx });
    }
  } else if (hookName === 'modifyBlockGained') {
    const entity = payload.entity;
    ensureEntityStatuses(entity);

    const dexHook = STATUS_REGISTRY.dexterity?.hooks?.modifyBlockGained;
    if (dexHook && entity.statuses.dexterity !== 0) {
      value = dexHook(value, { ...payload, ctx });
    }

    if (Array.isArray(entity?.relics)) {
      for (const relicState of entity.relics) {
        const relicDef = RELIC_REGISTRY[relicState.id];
        const fn = relicDef?.hooks?.[hookName];
        if (fn) {
          value = fn(value, { ...payload, player: entity, relicState, ctx });
        }
      }
    }
  }

  return Math.max(0, Math.floor(value));
}

export function triggerHook(hookName, payload, state) {
  const defaultTarget = state.enemies?.find(e => e.hp > 0) || state.enemies?.[0];
  const ctx = createBattleContext(
    state,
    payload.player || payload.entity || payload.source,
    payload.target || defaultTarget
  );

  const targetPlayers = payload.player
    ? [payload.player]
    : payload.allPlayers
      ? Object.values(state.players || {}).filter(p => p.isAlive)
      : [];

  for (const player of targetPlayers) {
    // Class Passive Hooks
    const cls = OPERATIVE_CLASSES[player.classId];
    if (cls && typeof cls[hookName] === 'function') {
      cls[hookName](player, ctx);
    }

    if (!Array.isArray(player.relics)) continue;
    for (const relicState of player.relics) {
      const relicDef = RELIC_REGISTRY[relicState.id];
      const fn = relicDef?.hooks?.[hookName];
      if (fn) {
        fn({ ...payload, player, relicState, ctx });
      }
    }
  }

  const statusEntity = payload.entity || payload.target || payload.player;
  if (statusEntity && statusEntity.statuses) {
    ensureEntityStatuses(statusEntity);
    for (const [statusId, statusDef] of Object.entries(STATUS_REGISTRY)) {
      const stacks = statusEntity.statuses[statusId] || 0;
      const fn = statusDef?.hooks?.[hookName];
      if (fn && stacks > 0) {
        fn({ ...payload, entity: statusEntity, stacks, ctx });
      }
    }
  }
}

// ----------------------------------------------------------------------------
// 3. Battle Context (`ctx`) Action Primitives
// ----------------------------------------------------------------------------

export function createBattleContext(state, activePlayer = null, activeTarget = null) {
  const resolveLivingTarget = (preferred) => {
    if (preferred && preferred.hp > 0) return preferred;
    return state?.enemies?.find(e => e.hp > 0) || preferred || state?.enemies?.[0];
  };

  const ctx = {
    state,
    player: activePlayer,
    get target() {
      return resolveLivingTarget(activeTarget);
    },

    log(msg) {
      if (!state.combatLog) state.combatLog = [];
      state.combatLog.push(msg);
      if (state.combatLog.length > 45) {
        state.combatLog = state.combatLog.slice(-45);
      }
    },

    computeCardDamagePreview(player, target, baseDamage, strengthMultiplier = 1) {
      const t = resolveLivingTarget(target);
      const out = runModifierHook(
        'modifyOutgoingDamage',
        baseDamage,
        { source: player, target: t, multiplier: strengthMultiplier },
        state
      );
      if (!t) return out;
      return runModifierHook(
        'modifyIncomingDamage',
        out,
        { source: player, target: t },
        state
      );
    },

    computeCardBlockPreview(player, baseBlock) {
      return runModifierHook('modifyBlockGained', baseBlock, { entity: player }, state);
    },

    dealDamage(source, target, baseDamage, options = {}) {
      const actualTarget = source?.relics ? resolveLivingTarget(target) : target;
      if (!actualTarget || actualTarget.hp <= 0) return { shieldDamage: 0, hpDamage: 0 };
      const multiplier = options.strengthMultiplier || options.card?.strengthMultiplier || 1;

      const afterOut = runModifierHook(
        'modifyOutgoingDamage',
        baseDamage,
        { source, target: actualTarget, card: options.card, multiplier },
        state
      );
      const finalDmg = runModifierHook(
        'modifyIncomingDamage',
        afterOut,
        { source, target: actualTarget, card: options.card },
        state
      );

      const res = applyDamageToEntity(finalDmg, actualTarget.shield || 0, actualTarget.hp);
      actualTarget.shield = res.finalShield;
      actualTarget.hp = res.finalHp;

      if (state?.runStats) {
        if (source?.masterDeck) state.runStats.damageDealt = (state.runStats.damageDealt || 0) + finalDmg;
        if (actualTarget?.masterDeck) state.runStats.damageTaken = (state.runStats.damageTaken || 0) + res.hpDamage;
      }

      const label = options.sourceName || options.card?.name || source?.name || 'Attack';
      ctx.log(`[ATK] ${source?.name || label} -> ${actualTarget.name}: ${finalDmg} dmg (${res.shieldDamage > 0 ? `🛡️-${res.shieldDamage} ` : ''}HP -${res.hpDamage}).`);

      if (actualTarget.isAlive !== undefined && actualTarget.hp <= 0) {
        actualTarget.isAlive = false;
      }

      triggerHook('onDamageDealt', {
        source,
        target: actualTarget,
        player: source?.relics ? source : null,
        damage: finalDmg,
        hpLost: res.hpDamage,
        isAttack: true
      }, state);

      triggerHook('onDamageTaken', {
        source,
        target: actualTarget,
        entity: actualTarget,
        player: actualTarget?.relics ? actualTarget : null,
        damage: finalDmg,
        hpLost: res.hpDamage,
        isAttack: true
      }, state);

      return res;
    },

    dealRawDamage(source, target, rawDamage, sourceName = 'Effect') {
      const actualTarget = source?.relics ? resolveLivingTarget(target) : target;
      if (!actualTarget || actualTarget.hp <= 0 || rawDamage <= 0) return { shieldDamage: 0, hpDamage: 0 };
      const res = applyDamageToEntity(rawDamage, actualTarget.shield || 0, actualTarget.hp);
      actualTarget.shield = res.finalShield;
      actualTarget.hp = res.finalHp;
      if (actualTarget.isAlive !== undefined && actualTarget.hp <= 0) {
        actualTarget.isAlive = false;
      }
      ctx.log(`[PROC] ${sourceName} dealt ${rawDamage} to ${actualTarget.name}.`);
      return res;
    },

    dealDirectHpLoss(target, amount, sourceName = 'Status') {
      if (!target || target.hp <= 0 || amount <= 0) return 0;
      const lost = Math.min(target.hp, amount);
      target.hp = Math.max(0, target.hp - lost);
      if (target.isAlive !== undefined && target.hp <= 0) {
        target.isAlive = false;
      }
      ctx.log(`[DOT] ${target.name} took ${lost} HP damage from ${sourceName}.`);
      return lost;
    },

    gainBlock(entity, baseBlock, options = {}) {
      if (!entity || baseBlock <= 0) return 0;
      const finalBlock = options.raw
        ? baseBlock
        : runModifierHook('modifyBlockGained', baseBlock, { entity, card: options.card }, state);

      entity.shield = (entity.shield || 0) + finalBlock;
      if (state?.runStats && entity?.masterDeck) {
        state.runStats.shieldGained = (state.runStats.shieldGained || 0) + finalBlock;
      }
      const tag = options.sourceName ? `[SHIELD] ${options.sourceName}` : `[SHIELD] ${entity.name}`;
      ctx.log(`${tag} gained +${finalBlock} Shield.`);
      return finalBlock;
    },

    applyStatus(source, target, statusId, stacks) {
      const actualTarget = (target && target !== source) ? resolveLivingTarget(target) : target;
      if (!actualTarget || actualTarget.hp <= 0 || !stacks) return;
      ensureEntityStatuses(actualTarget);
      actualTarget.statuses[statusId] = (actualTarget.statuses[statusId] || 0) + stacks;
      const statusName = STATUS_REGISTRY[statusId]?.name || statusId.toUpperCase();
      ctx.log(`[STATUS] ${actualTarget.name} gained +${stacks} ${statusName} (${actualTarget.statuses[statusId]}).`);

      triggerHook('onStatusApplied', {
        source,
        target: actualTarget,
        entity: actualTarget,
        player: source?.relics ? source : null,
        statusId,
        stacks
      }, state);
    },

    gainEnergy(player, amount, sourceName = null) {
      if (!player || amount <= 0) return;
      player.energy = (player.energy || 0) + amount;
      ctx.log(`[ENERGY] ${player.name} gained +${amount} Energy${sourceName ? ` (${sourceName})` : ''}.`);
    },

    healEntity(entity, amount, sourceName = 'Heal') {
      if (!entity || entity.hp <= 0 || amount <= 0) return;
      const before = entity.hp;
      entity.hp = Math.min(entity.maxHp, entity.hp + amount);
      const healed = entity.hp - before;
      if (healed > 0) {
        ctx.log(`[HEAL] ${entity.name} restored +${healed} HP (${sourceName}).`);
      }
    },

    drawCards(player, count) {
      drawCards(player, count, state);
    },

    exhaustCard(player, cardInstance) {
      if (!player.exhaust) player.exhaust = [];
      player.exhaust.push(cardInstance);
      const def = resolveCard(cardInstance);
      ctx.log(`[EXHAUST] ${def?.name || cardInstance.defId} exhausted.`);
      triggerHook('onCardExhausted', {
        player,
        card: cardInstance,
        cardDef: def
      }, state);
    },

    grantRandomPotion(player, sourceName = 'Loot') {
      if (!player) return false;
      if (!Array.isArray(player.potions)) player.potions = [null, null, null];
      const emptyIdx = player.potions.findIndex(p => p === null);
      if (emptyIdx === -1) {
        ctx.log(`[POTION] ${player.name}'s 3 Potion Slots are full!`);
        return false;
      }
      const allIds = Object.keys(POTION_REGISTRY);
      const pick = allIds[Math.floor(Math.random() * allIds.length)];
      player.potions[emptyIdx] = pick;
      ctx.log(`[POTION] ${player.name} obtained ${POTION_REGISTRY[pick].name} (${sourceName}).`);
      return true;
    }
  };

  return ctx;
}

// ----------------------------------------------------------------------------
// 4. Multi-Enemy Spawner, Behavior Tree Evaluator & Intent System
// ----------------------------------------------------------------------------

export function evaluateBehaviorTree(node, enemy, state) {
  if (!node) return null;
  const effFloor = (state.floor || 1) + ((state.sectorNumber || 1) - 1) * 10 + Math.floor((state.threatLevel || 0) * 0.8);

  switch (node.type) {
    case 'action':
      return structuredCloneIntent(node.intent, effFloor);

    case 'condition': {
      const passed = typeof node.check === 'function' ? node.check(enemy, state) : false;
      if (passed) {
        return evaluateBehaviorTree(node.child, enemy, state);
      }
      return null;
    }

    case 'selector': {
      for (const child of node.children || []) {
        const res = evaluateBehaviorTree(child, enemy, state);
        if (res) return res;
      }
      return null;
    }

    case 'cycle': {
      const steps = node.steps || [];
      if (steps.length === 0) return null;
      const idx = (enemy.aiState?.turn || 0) % steps.length;
      return evaluateBehaviorTree(steps[idx], enemy, state);
    }

    case 'weighted': {
      const lastId = enemy.aiState?.lastMoveId;
      let validOptions = (node.options || []).filter(
        opt => !(opt.noRepeat && opt.intent?.id === lastId)
      );
      if (validOptions.length === 0) validOptions = node.options || [];

      const totalWeight = validOptions.reduce((acc, o) => acc + (o.weight || 1), 0);
      let roll = Math.random() * totalWeight;
      for (const opt of validOptions) {
        roll -= (opt.weight || 1);
        if (roll <= 0) {
          return structuredCloneIntent(opt.intent, effFloor);
        }
      }
      return structuredCloneIntent(validOptions[0]?.intent, effFloor);
    }

    default:
      return null;
  }
}

function structuredCloneIntent(intent, floor = 1) {
  if (!intent) {
    return { id: 'basic_strike', type: 'attack', value: 7 + floor, hits: 1, label: 'STRIKE' };
  }
  const scaleBonus = Math.floor((floor - 1) * 1.5);
  const copy = JSON.parse(JSON.stringify(intent));
  if (typeof copy.value === 'number') {
    const perHitBonus = (copy.hits && copy.hits > 1)
      ? Math.floor((floor - 1) * 0.65)
      : scaleBonus;
    copy.value += perHitBonus;
  }
  if (typeof copy.block === 'number') {
    copy.block += Math.floor((floor - 1) * 1.6);
  }
  return copy;
}

export function selectNextEnemyIntent(enemy, state) {
  if (!enemy.aiState) {
    enemy.aiState = { turn: 0, lastMoveId: null };
  }
  const template = ENEMY_REGISTRY[enemy.archetypeId] || ENEMY_REGISTRY.sentinel_drone;
  const chosen = evaluateBehaviorTree(template.behaviorTree, enemy, state) || {
    id: 'fallback_attack',
    type: 'attack',
    value: 7 + (state.floor || 1),
    hits: 1,
    label: 'STRIKE'
  };
  enemy.intent = chosen;
  return chosen;
}

function createEnemyUnit(archetypeId, index, floor, playerCount, state, options = {}) {
  const template = ENEMY_REGISTRY[archetypeId] || ENEMY_REGISTRY.sentinel_drone;
  const threat = state?.threatLevel || 0;
  const sectorBonus = ((state?.sectorNumber || 1) - 1) * 0.35;
  const threatHpMult = 1 + (threat * 0.08) + sectorBonus;

  const hpScale = (options.hpScale || 1.0) * threatHpMult;
  const rawHp = template.baseHp + (floor * template.hpPerFloor) + Math.max(0, playerCount - 1) * 24;
  const finalHp = Math.max(18, Math.floor(rawHp * hpScale));

  const statuses = createDefaultStatuses();
  const bonusStr = (options.bonusStrength || 0) + (threat >= 3 ? 1 : 0) + (threat >= 7 ? 1 : 0);
  if (bonusStr > 0) {
    statuses.strength = bonusStr;
  }

  const suffix = String.fromCharCode(65 + index);
  const prefix = options.prefix || '';
  const enemy = {
    id: `enemy_f${floor}_${index}_${Math.random().toString(36).substring(2, 5)}`,
    archetypeId,
    roomType: options.roomType || 'combat',
    name: `${prefix}${template.namePrefix}-${floor}${suffix}`,
    hp: finalHp,
    maxHp: finalHp,
    shield: (options.startingShield || 0) + (threat >= 5 ? 4 : 0),
    statuses,
    aiState: { turn: index % 2, lastMoveId: null },
    intent: null
  };

  selectNextEnemyIntent(enemy, { ...state, floor });
  return enemy;
}

/**
 * Spawns 1 to 3 enemies per encounter based on floor and roomType, including rotating Bosses.
 */
export function spawnEnemiesForEncounter(floor, playerCount = 1, state = {}, roomType = 'combat') {
  const standardKeys = Object.keys(ENEMY_REGISTRY).filter(k => !ENEMY_REGISTRY[k].isBoss);
  const bossKeys = Object.keys(ENEMY_REGISTRY).filter(k => ENEMY_REGISTRY[k].isBoss);
  const pickRandomArchetype = () => standardKeys[Math.floor(Math.random() * standardKeys.length)];

  if (roomType === 'boss') {
    const bossKey = bossKeys[(floor + (state.sectorNumber || 1)) % bossKeys.length] || 'overlord_core';
    const boss = createEnemyUnit(bossKey, 0, floor, playerCount, state, {
      roomType,
      hpScale: 1.15,
      bonusStrength: 2,
      startingShield: 10
    });
    const escort = createEnemyUnit('sentinel_drone', 1, floor, playerCount, state, {
      roomType,
      hpScale: 0.65,
      prefix: 'ESCORT '
    });
    return [boss, escort];
  }

  if (roomType === 'elite') {
    if (Math.random() < 0.55) {
      const mainKey = ['enforcer_mech', 'plague_weaver'][floor % 2];
      return [
        createEnemyUnit(mainKey, 0, floor, playerCount, state, {
          roomType,
          prefix: '[ELITE] ',
          hpScale: 1.18,
          bonusStrength: 2,
          startingShield: 6
        }),
        createEnemyUnit('swarm_stalker', 1, floor, playerCount, state, {
          roomType,
          hpScale: 0.72
        })
      ];
    }
    const eliteKey = standardKeys[(floor - 1) % standardKeys.length];
    return [
      createEnemyUnit(eliteKey, 0, floor, playerCount, state, {
        roomType,
        prefix: '[ELITE] ',
        hpScale: 1.4,
        bonusStrength: 2,
        startingShield: 8
      })
    ];
  }

  if (roomType === 'anomaly') {
    return [
      createEnemyUnit(pickRandomArchetype(), 0, floor, playerCount, state, {
        roomType,
        prefix: '[ANOMALY] ',
        hpScale: 0.92,
        bonusStrength: 1
      }),
      createEnemyUnit(pickRandomArchetype(), 1, floor, playerCount, state, {
        roomType,
        prefix: '[ANOMALY] ',
        hpScale: 0.85,
        bonusStrength: 1
      })
    ];
  }

  const roll = Math.random();
  if (floor === 1) {
    if (roll < 0.55) {
      return [
        createEnemyUnit('swarm_stalker', 0, floor, playerCount, state, { roomType, hpScale: 0.68 }),
        createEnemyUnit('sentinel_drone', 1, floor, playerCount, state, { roomType, hpScale: 0.68 })
      ];
    }
    return [createEnemyUnit('sentinel_drone', 0, floor, playerCount, state, { roomType, hpScale: 1.05 })];
  }

  if (floor >= 3 && roll < 0.25) {
    return [
      createEnemyUnit('swarm_stalker', 0, floor, playerCount, state, { roomType, hpScale: 0.58 }),
      createEnemyUnit(pickRandomArchetype(), 1, floor, playerCount, state, { roomType, hpScale: 0.62 }),
      createEnemyUnit('swarm_stalker', 2, floor, playerCount, state, { roomType, hpScale: 0.58 })
    ];
  }

  if (roll < 0.76) {
    return [
      createEnemyUnit(pickRandomArchetype(), 0, floor, playerCount, state, { roomType, hpScale: 0.78 }),
      createEnemyUnit(pickRandomArchetype(), 1, floor, playerCount, state, { roomType, hpScale: 0.78 })
    ];
  }

  return [
    createEnemyUnit('enforcer_mech', 0, floor, playerCount, state, {
      roomType,
      hpScale: 1.2,
      bonusStrength: 1
    })
  ];
}

export function spawnEnemyForFloor(floor, playerCount = 1, state = {}, roomType = 'combat') {
  return spawnEnemiesForEncounter(floor, playerCount, state, roomType)[0];
}

export function executeEnemyIntent(enemy, targetPlayer, state) {
  if (!enemy || enemy.hp <= 0) return;
  const ctx = createBattleContext(state, targetPlayer, enemy);
  const intent = enemy.intent || { type: 'attack', value: 7, hits: 1, label: 'ATTACK' };

  if (intent.block && intent.block > 0) {
    ctx.gainBlock(enemy, intent.block, { raw: true });
  }

  if (intent.value && intent.value > 0 && targetPlayer && targetPlayer.isAlive) {
    const hits = intent.hits || 1;
    for (let i = 0; i < hits; i++) {
      if (!targetPlayer.isAlive) break;
      ctx.dealDamage(enemy, targetPlayer, intent.value, { sourceName: `${enemy.name} (${intent.label || 'ATK'})` });
    }
  }

  if (intent.status) {
    const isSelfBuff = intent.type === 'buff' || intent.type === 'defend_buff';
    const recipient = isSelfBuff ? enemy : targetPlayer;
    if (recipient) {
      ctx.applyStatus(enemy, recipient, intent.status.id, intent.status.stacks);
    }
  }

  if (intent.secondaryStatus && targetPlayer) {
    ctx.applyStatus(enemy, targetPlayer, intent.secondaryStatus.id, intent.secondaryStatus.stacks);
  }

  if (!enemy.aiState) enemy.aiState = { turn: 0, lastMoveId: null };
  enemy.aiState.lastMoveId = intent.id || intent.type;
  enemy.aiState.turn = (enemy.aiState.turn || 0) + 1;

  selectNextEnemyIntent(enemy, state);
}

export function formatTelegraphedIntent(enemy, targetPlayer, state) {
  if (!enemy || enemy.hp <= 0 || !enemy.intent) {
    return { text: 'DEFEATED', category: 'neutral' };
  }
  const intent = enemy.intent;
  const hits = intent.hits || 1;

  let computedDmg = 0;
  if (intent.value) {
    const afterOut = runModifierHook('modifyOutgoingDamage', intent.value, { source: enemy, target: targetPlayer }, state);
    computedDmg = targetPlayer
      ? runModifierHook('modifyIncomingDamage', afterOut, { source: enemy, target: targetPlayer }, state)
      : afterOut;
  }

  const dmgPart = intent.value
    ? (hits > 1 ? `⚔️ ${computedDmg}x${hits}` : `⚔️ ${computedDmg}`)
    : '';
  const blockPart = intent.block ? `🛡️ +${intent.block}` : '';
  let statusPart = '';
  if (intent.status) {
    const sName = STATUS_REGISTRY[intent.status.id]?.name || intent.status.id.toUpperCase();
    statusPart = `${intent.type.includes('buff') ? '▲' : '▼'} ${intent.status.stacks} ${sName}`;
  }

  const parts = [intent.label, dmgPart, blockPart, statusPart].filter(Boolean);
  let category = 'attack';
  if (intent.type === 'defend_buff' || intent.type === 'defend') category = 'defend';
  else if (intent.type === 'debuff') category = 'debuff';
  else if (intent.type === 'attack_debuff') category = 'attack-debuff';

  return {
    text: parts.join(' · '),
    category
  };
}

// ----------------------------------------------------------------------------
// 5. Run Initialization, Classes, Starter Relic, Map, Shop & Mystery Events
// ----------------------------------------------------------------------------

export function createInitialPlayer(id, name, classId = 'vanguard', draftProtocol = false) {
  const cls = OPERATIVE_CLASSES[classId] || OPERATIVE_CLASSES.vanguard;
  const p = {
    id,
    name,
    classId: cls.id,
    className: cls.name,
    hp: cls.maxHp || 52,
    maxHp: cls.maxHp || 52,
    credits: cls.startingCredits ?? 75,
    shopPurgesUsed: 0,
    shield: 0,
    energy: cls.maxEnergy || 3,
    maxEnergy: cls.maxEnergy || 3,
    turnAttacksPlayed: 0,
    statuses: createDefaultStatuses(),
    relics: [],
    potions: Array.isArray(cls.starterPotions) ? [...cls.starterPotions] : ['fire_potion', null, null],
    starterRelicChoices: rollStarterRelicChoices(3),
    masterDeck: createStarterDeck(cls.id, draftProtocol),
    deck: [],
    hand: [],
    discard: [],
    exhaust: [],
    pendingLoot: null,
    shopStock: null,
    isReady: false,
    isAlive: true
  };
  p.deck = JSON.parse(JSON.stringify(p.masterDeck));
  return p;
}

export function beginRunFromLobby(state, options = {}) {
  state.floor = 1;
  state.sectorNumber = 1;
  state.threatLevel = typeof options.threatLevel === 'number' ? options.threatLevel : (state.threatLevel || 0);
  state.mutators = Array.isArray(options.mutators) ? options.mutators : (state.mutators || []);
  state.phase = 'boot_relic';
  state.map = generateSectorMap(12, state.mutators);
  state.enemies = [];
  state.runStats = {
    startedAt: Date.now(),
    endedAt: null,
    outcome: null,
    causeOfEnd: '',
    floorsCleared: 0,
    sectorsCleared: 0,
    enemiesDefeated: 0,
    cardsPlayed: 0,
    potionsUsed: 0,
    creditsEarned: 0,
    damageDealt: 0,
    damageTaken: 0,
    shieldGained: 0
  };

  const isDraft = state.mutators.includes('draft_protocol');
  for (const pid in state.players) {
    const p = state.players[pid];
    if (options.classId && OPERATIVE_CLASSES[options.classId]) {
      const cls = OPERATIVE_CLASSES[options.classId];
      p.classId = cls.id;
      p.className = cls.name;
      p.maxHp = cls.maxHp;
      p.hp = cls.maxHp;
      p.credits = cls.startingCredits;
      p.potions = [...cls.starterPotions];
    }
    if (isDraft) {
      p.masterDeck = createStarterDeck(p.classId, true);
    }
    if (!p.starterRelicChoices || p.starterRelicChoices.length === 0) {
      p.starterRelicChoices = rollStarterRelicChoices(3);
    }
  }

  updateCareerStat(prof => {
    prof.runsStarted = (prof.runsStarted || 0) + 1;
  });

  if (!state.combatLog) state.combatLog = [];
  state.combatLog.push(`[SYSTEM] Threat Level ${state.threatLevel} Run Initialized. Select Starter Relic.`);
  return true;
}

export function selectStarterRelicTransaction(state, playerId, relicId) {
  const p = state?.players?.[playerId];
  if (!p || !RELIC_REGISTRY[relicId]) return false;

  const relicDef = RELIC_REGISTRY[relicId];
  const relicState = { id: relicId, counter: 0 };
  if (!Array.isArray(p.relics)) p.relics = [];
  if (!p.relics.some(r => r.id === relicId)) {
    p.relics.push(relicState);
  }
  p.starterRelicChoices = [];

  const ctx = createBattleContext(state, p, null);
  relicDef.hooks?.onPickup?.({ player: p, relicState, ctx });
  ctx.log(`[BOOT] ${p.name} (${p.className || 'OPERATIVE'}) initialized with ${relicDef.name}!`);

  const allChosen = Object.values(state.players || {}).every(
    pl => !pl.starterRelicChoices || pl.starterRelicChoices.length === 0
  );
  if (allChosen) {
    state.phase = 'map';
    ctx.log('[MAP] Sector Tree Map online. Select a Floor 1 room.');
  }
  return true;
}

export function selectMapNodeTransaction(state, playerId, nodeId) {
  if (!state || state.phase !== 'map') return false;
  if (!state.map) state.map = generateSectorMap(12, state.mutators);

  const selectable = getSelectableNodeIds(state.map);
  if (!selectable.includes(nodeId)) return false;

  const node = findMapNode(state.map, nodeId);
  if (!node) return false;

  node.visited = true;
  state.map.currentNodeId = node.id;
  state.map.currentFloor = node.floor;
  state.map.currentRoomType = node.roomType;
  state.floor = node.floor;

  updateCareerStat(prof => {
    const absFloor = ((state.sectorNumber || 1) - 1) * 12 + node.floor;
    if (absFloor > (prof.highestFloor || 1)) prof.highestFloor = absFloor;
  });

  const roomMeta = MAP_ROOM_TYPES[node.roomType] || MAP_ROOM_TYPES.combat;
  if (!state.combatLog) state.combatLog = [];
  state.combatLog.push(`[MAP] Floor ${node.floor}: Entered ${roomMeta.name}.`);

  // 1. Forge / Rest Station
  if (node.roomType === 'upgrade') {
    state.phase = 'loot';
    for (const pid in state.players) {
      const p = state.players[pid];
      if (!p.isAlive) continue;
      const healAmt = Math.max(8, Math.floor(p.maxHp * 0.25));
      p.hp = Math.min(p.maxHp, p.hp + healAmt);
      p.pendingLoot = generateRoomLoot(p, 'upgrade', false, state);
    }
    state.combatLog.push('[FORGE] Restored 25% HP. Upgrade a card in your deck before continuing.');
    return true;
  }

  // 2. Supply Vault
  if (node.roomType === 'treasure') {
    state.phase = 'loot';
    for (const pid in state.players) {
      const p = state.players[pid];
      if (!p.isAlive) continue;
      p.credits = (p.credits || 0) + 45;
      p.pendingLoot = generateRoomLoot(p, 'treasure', false, state);
    }
    state.combatLog.push('[VAULT] Supply Cache unlocked (+45 CR)! Claim your Relic and supplies.');
    return true;
  }

  // 3. Black Market Shop (`shop`)
  if (node.roomType === 'shop') {
    state.phase = 'shop';
    for (const pid in state.players) {
      const p = state.players[pid];
      if (!p.isAlive) continue;
      p.shopStock = generateShopStock(p, state.floor);
    }
    state.combatLog.push('[MARKET] Connected to Black Market Terminal.');
    return true;
  }

  // 4. Narrative Mystery Event (`event`)
  if (node.roomType === 'event') {
    state.phase = 'event';
    const eventIds = Object.keys(EVENT_REGISTRY);
    state.activeEventId = eventIds[Math.floor(Math.random() * eventIds.length)];
    state.combatLog.push(`[EVENT] Encountered ${EVENT_REGISTRY[state.activeEventId].title}.`);
    return true;
  }

  // 5. Combat Encounters (`combat`, `elite`, `anomaly`, `boss`)
  startFloorCombat(state, false, node.roomType);
  return true;
}

/**
 * Resolves a player's choice in a Narrative Mystery Event (`phase: 'event'`).
 */
export function resolveEventChoiceTransaction(state, playerId, choiceId) {
  if (!state || state.phase !== 'event') return false;
  const p = state.players?.[playerId];
  if (!p) return false;

  const evDef = EVENT_REGISTRY[state.activeEventId] || Object.values(EVENT_REGISTRY)[0];
  const choice = (evDef?.choices || []).find(c => c.id === choiceId) || evDef?.choices?.[0];
  if (!choice) return false;

  const ctx = createBattleContext(state, p, null);
  const summary = choice.resolve(p, state, ctx);
  ctx.log(`[EVENT] ${evDef.title}: ${summary}`);

  if (p.hp <= 0) {
    p.hp = 0;
    p.isAlive = false;
  }
  if (checkAndHandleRunDefeat(state, `Fallen during ${evDef.title}`)) {
    return true;
  }

  checkAndAdvanceToMap(state);
  return true;
}

/**
 * Purchases an item or service in the Black Market Shop (`phase: 'shop'`).
 */
export function buyShopItemTransaction(state, playerId, actionType, payload = {}) {
  if (!state || state.phase !== 'shop') return false;
  const p = state.players?.[playerId];
  if (!p || !p.shopStock) return false;

  const stock = p.shopStock;
  const ctx = createBattleContext(state, p, null);

  if (actionType === 'card') {
    const idx = (stock.cards || []).findIndex(c => c.shopItemId === payload.shopItemId);
    if (idx === -1) return false;
    const item = stock.cards[idx];
    if ((p.credits || 0) < item.costCredits) return false;

    p.credits -= item.costCredits;
    const newCard = {
      instanceId: 'C_' + Math.random().toString(36).substring(2, 8),
      defId: item.defId,
      upgraded: Boolean(item.upgraded)
    };
    p.masterDeck.push(newCard);
    stock.cards.splice(idx, 1);
    ctx.log(`[MARKET] Purchased ${resolveCard(newCard)?.name} for ${item.costCredits} CR.`);
    return true;
  }

  if (actionType === 'relic') {
    const idx = (stock.relics || []).findIndex(r => r.shopItemId === payload.shopItemId);
    if (idx === -1) return false;
    const item = stock.relics[idx];
    if ((p.credits || 0) < item.costCredits) return false;

    p.credits -= item.costCredits;
    const rDef = RELIC_REGISTRY[item.relicId];
    if (rDef && !p.relics.some(r => r.id === rDef.id)) {
      const relicState = { id: rDef.id, counter: 0 };
      p.relics.push(relicState);
      rDef.hooks?.onPickup?.({ player: p, relicState, ctx });
    }
    stock.relics.splice(idx, 1);
    ctx.log(`[MARKET] Purchased Relic: ${rDef?.name} for ${item.costCredits} CR.`);
    return true;
  }

  if (actionType === 'potion') {
    const idx = (stock.potions || []).findIndex(pt => pt.shopItemId === payload.shopItemId);
    if (idx === -1) return false;
    const item = stock.potions[idx];
    if ((p.credits || 0) < item.costCredits) return false;

    p.credits -= item.costCredits;
    if (!Array.isArray(p.potions)) p.potions = [null, null, null];
    let slotIdx = p.potions.findIndex(s => s === null);
    if (slotIdx === -1) slotIdx = 2;
    p.potions[slotIdx] = item.potionId;
    stock.potions.splice(idx, 1);
    ctx.log(`[MARKET] Purchased ${POTION_REGISTRY[item.potionId]?.name} for ${item.costCredits} CR.`);
    return true;
  }

  if (actionType === 'purge' && stock.purgeAvailable) {
    if ((p.credits || 0) < stock.purgeCost || (p.masterDeck?.length || 0) <= 5) return false;
    const cardIdx = p.masterDeck.findIndex(c => c.instanceId === payload.instanceId);
    if (cardIdx === -1) return false;

    p.credits -= stock.purgeCost;
    const [removed] = p.masterDeck.splice(cardIdx, 1);
    p.shopPurgesUsed = (p.shopPurgesUsed || 0) + 1;
    stock.purgeAvailable = false;
    ctx.log(`[MARKET] Purged ${resolveCard(removed)?.name} from Master Deck!`);
    return true;
  }

  if (actionType === 'upgrade' && stock.upgradeAvailable) {
    if ((p.credits || 0) < stock.upgradeCost) return false;
    const card = p.masterDeck.find(c => c.instanceId === payload.instanceId && !c.upgraded);
    if (!card) return false;

    p.credits -= stock.upgradeCost;
    card.upgraded = true;
    stock.upgradeAvailable = false;
    ctx.log(`[MARKET] Upgraded card to ${resolveCard(card)?.name}!`);
    return true;
  }

  return false;
}

export function leaveShopTransaction(state, playerId) {
  const p = state?.players?.[playerId];
  if (p) p.shopStock = null;
  checkAndAdvanceToMap(state);
  return true;
}

// ----------------------------------------------------------------------------
// 6. Combat Phase, Potions & Card Play
// ----------------------------------------------------------------------------

export function startFloorCombat(state, isInitialFloor = false, roomType = 'combat') {
  state.phase = 'combat';
  state.currentRoomType = roomType;
  const pCount = Object.keys(state.players || {}).length || 1;
  state.enemies = spawnEnemiesForEncounter(state.floor || 1, pCount, state, roomType);

  const isSnecko = Array.isArray(state.mutators) && state.mutators.includes('volatile_compiler');
  const startDrawCount = isSnecko ? 7 : 5;

  for (const pid in state.players) {
    const p = state.players[pid];
    if (!p.isAlive && isInitialFloor) {
      p.hp = p.maxHp;
      p.isAlive = true;
    }
    if (!p.isAlive) continue;

    p.energy = p.maxEnergy || 3;
    p.shield = 0;
    p.turnAttacksPlayed = 0;
    p.isReady = false;
    p.statuses = createDefaultStatuses();

    if (!p.masterDeck || p.masterDeck.length === 0) {
      p.masterDeck = createStarterDeck(p.classId);
    }
    p.deck = JSON.parse(JSON.stringify(p.masterDeck)).sort(() => Math.random() - 0.5);
    p.hand = [];
    p.discard = [];
    p.exhaust = [];

    drawCards(p, startDrawCount, state);
  }

  if (!state.combatLog) state.combatLog = [];
  const names = state.enemies.map(e => e.name).join(' & ');
  state.combatLog.push(`=== FLOOR ${state.floor}: ${names} ENGAGED ===`);

  for (const pid in state.players) {
    const p = state.players[pid];
    if (!p.isAlive) continue;
    triggerHook('onBattleStart', { player: p, entity: p }, state);
    triggerHook('onTurnStart', { player: p, entity: p }, state);
  }
}

export function playCardTransaction(state, playerId, cardInstanceId, targetEnemyIdx = 0) {
  if (!state || state.phase !== 'combat') return false;
  const me = state.players?.[playerId];
  if (!me || me.isReady || !me.isAlive) return false;

  const cardIdx = me.hand.findIndex(c => c.instanceId === cardInstanceId);
  if (cardIdx === -1) return false;

  const cardInstance = me.hand[cardIdx];
  const def = resolveCard(cardInstance);
  const effCost = getEffectiveCardCost(cardInstance, def);
  if (!def || me.energy < effCost) return false;

  const preferredEnemy = state.enemies?.[targetEnemyIdx];
  const target = (preferredEnemy && preferredEnemy.hp > 0)
    ? preferredEnemy
    : state.enemies?.find(e => e.hp > 0) || state.enemies?.[0];

  const ctx = createBattleContext(state, me, target);

  me.energy -= effCost;
  me.hand.splice(cardIdx, 1);

  if (typeof def.onPlay === 'function') {
    def.onPlay(ctx);
  }

  if (def.type === 'attack') {
    me.turnAttacksPlayed = (me.turnAttacksPlayed || 0) + 1;
    // Mutator: Vampiric Sector (`hyper_regen`) heals 2 HP per Attack played
    if (Array.isArray(state.mutators) && state.mutators.includes('hyper_regen')) {
      ctx.healEntity(me, 2, 'Vampiric Sector');
    }
  }

  updateCareerStat(prof => {
    prof.cardsPlayed = (prof.cardsPlayed || 0) + 1;
  });
  if (state.runStats) {
    state.runStats.cardsPlayed = (state.runStats.cardsPlayed || 0) + 1;
  }

  triggerHook('onCardPlayed', {
    player: me,
    entity: me,
    target: ctx.target,
    card: cardInstance,
    cardDef: def
  }, state);

  if (def.exhaust) {
    ctx.exhaustCard(me, cardInstance);
  } else {
    me.discard.push(cardInstance);
  }

  checkAndHandleFloorVictory(state);
  checkAndHandleRunDefeat(state, `Fallen on Floor ${state.floor}`);
  return true;
}

export function usePotionTransaction(state, playerId, slotIdx, targetEnemyIdx = 0) {
  if (!state) return false;
  const me = state.players?.[playerId];
  if (!me || !me.isAlive || !Array.isArray(me.potions)) return false;

  const potionId = me.potions[slotIdx];
  if (!potionId || !POTION_REGISTRY[potionId]) return false;

  const pDef = POTION_REGISTRY[potionId];
  const preferredEnemy = state.enemies?.[targetEnemyIdx];
  const target = (preferredEnemy && preferredEnemy.hp > 0)
    ? preferredEnemy
    : state.enemies?.find(e => e.hp > 0) || state.enemies?.[0];

  const ctx = createBattleContext(state, me, target);

  me.potions[slotIdx] = null;
  if (state.runStats) {
    state.runStats.potionsUsed = (state.runStats.potionsUsed || 0) + 1;
  }
  ctx.log(`[POTION] ${me.name} used ${pDef.name}!`);
  pDef.onUse(ctx);

  triggerHook('onPotionUsed', {
    player: me,
    entity: me,
    potionId,
    potionDef: pDef
  }, state);

  if (state.phase === 'combat') {
    checkAndHandleFloorVictory(state);
  }
  return true;
}

export function discardPotionTransaction(state, playerId, slotIdx) {
  const me = state?.players?.[playerId];
  if (!me || !Array.isArray(me.potions) || !me.potions[slotIdx]) return false;
  const pName = POTION_REGISTRY[me.potions[slotIdx]]?.name || 'Potion';
  me.potions[slotIdx] = null;
  if (!state.combatLog) state.combatLog = [];
  state.combatLog.push(`[POTION] ${me.name} discarded ${pName}.`);
  return true;
}

// ----------------------------------------------------------------------------
// 7. Post-Encounter Loot Generation (Credits + Cards + Potions; Relics in Elites/Vaults)
// ----------------------------------------------------------------------------

export function checkAndHandleFloorVictory(state) {
  if (!state.enemies || state.enemies.length === 0 || !state.enemies.every(e => e.hp <= 0)) {
    return false;
  }

  const roomType = state.currentRoomType || state.map?.currentRoomType || 'combat';
  const isMandatoryRoom = roomType === 'anomaly' || Boolean(MAP_ROOM_TYPES[roomType]?.mandatoryLoot);

  const bountyMult = (Array.isArray(state.mutators) && state.mutators.includes('elite_bounty')) ? 1.5 : 1.0;
  const baseCredits = roomType === 'boss' ? 75 : (roomType === 'elite' ? 45 : (roomType === 'anomaly' ? 50 : 24));
  const earnedCredits = Math.floor((baseCredits + (state.floor || 1) * 3) * bountyMult);

  if (state.runStats) {
    state.runStats.floorsCleared = (state.runStats.floorsCleared || 0) + 1;
    state.runStats.enemiesDefeated = (state.runStats.enemiesDefeated || 0) + (state.enemies?.length || 1);
    state.runStats.creditsEarned = (state.runStats.creditsEarned || 0) + earnedCredits;
    if (roomType === 'boss' && (state.floor || 1) >= 12) {
      state.runStats.sectorsCleared = (state.runStats.sectorsCleared || 0) + 1;
    }
  }

  updateCareerStat(prof => {
    prof.enemiesDefeated = (prof.enemiesDefeated || 0) + (state.enemies?.length || 1);
    if (roomType === 'boss' && (state.floor || 1) >= 12) {
      prof.sectorsCleared = (prof.sectorsCleared || 0) + 1;
      if ((state.threatLevel || 0) > (prof.highestThreatCleared || 0)) {
        prof.highestThreatCleared = state.threatLevel || 0;
      }
    }
  });

  state.combatLog.push(
    isMandatoryRoom
      ? `[VICTORY] Anomaly Cleared (+${earnedCredits} CR)! WARNING: Containment Loot is MANDATORY pickup.`
      : `[VICTORY] Floor ${state.floor} cleared! Earned +${earnedCredits} CR.`
  );

  for (const pid in state.players) {
    const p = state.players[pid];
    if (!p.isAlive) continue;
    p.credits = (p.credits || 0) + earnedCredits;
    triggerHook('onBattleVictory', { player: p, entity: p }, state);
    p.pendingLoot = generateRoomLoot(p, roomType, isMandatoryRoom, state);
  }

  state.phase = 'loot';
  return true;
}

export function generateRoomLoot(player, roomType = 'combat', isMandatory = false) {
  const items = [];

  if (roomType !== 'upgrade') {
    const pool = Object.values(CARD_REGISTRY).filter(
      c => c.id !== 'inflict_vuln' && c.rarity !== 'starter' && c.rarity !== 'curse'
    );
    const upgradeChance = (roomType === 'elite' || roomType === 'boss' || roomType === 'anomaly') ? 0.50 : 0.20;
    const picks = [...pool].sort(() => Math.random() - 0.5).slice(0, 3).map(c => ({
      defId: c.id,
      upgraded: Math.random() < upgradeChance
    }));

    items.push({
      id: 'loot_card_' + Math.random().toString(36).substring(2, 6),
      type: 'card_draft',
      mandatory: isMandatory,
      cards: picks
    });
  }

  // Relic Drop: ONLY in elite, anomaly, treasure, or boss (NEVER in normal combat!)
  const shouldDropRelic = ['elite', 'anomaly', 'treasure', 'boss'].includes(roomType);
  if (shouldDropRelic) {
    const ownedIds = new Set((player.relics || []).map(r => r.id));
    const available = Object.values(RELIC_REGISTRY)
      .filter(r => r.tier !== 'starter' && !ownedIds.has(r.id))
      .map(r => r.id);

    if (available.length > 0) {
      const relicId = available[Math.floor(Math.random() * available.length)];
      items.push({
        id: 'loot_relic_' + Math.random().toString(36).substring(2, 6),
        type: 'relic',
        mandatory: isMandatory,
        relicId
      });
    }
  }

  const shouldDropPotion = roomType !== 'combat' || Math.random() < 0.55;
  if (shouldDropPotion) {
    const pKeys = Object.keys(POTION_REGISTRY);
    const potionId = pKeys[Math.floor(Math.random() * pKeys.length)];
    items.push({
      id: 'loot_potion_' + Math.random().toString(36).substring(2, 6),
      type: 'potion',
      mandatory: isMandatory,
      potionId
    });
  }

  if (['upgrade', 'boss', 'anomaly', 'treasure'].includes(roomType) || (roomType === 'elite' && Math.random() < 0.25)) {
    const hasUnupgraded = (player.masterDeck || []).some(c => !c.upgraded);
    if (hasUnupgraded) {
      items.push({
        id: 'loot_upgrade_' + Math.random().toString(36).substring(2, 6),
        type: 'upgrade_token',
        mandatory: isMandatory && roomType === 'anomaly'
      });
    }
  }

  return {
    roomType,
    mandatoryRoom: isMandatory,
    items
  };
}

export function claimLootItemTransaction(state, playerId, lootItemId, selectionPayload = {}) {
  const p = state?.players?.[playerId];
  if (!p || !p.pendingLoot || !Array.isArray(p.pendingLoot.items)) return false;

  const idx = p.pendingLoot.items.findIndex(item => item.id === lootItemId);
  if (idx === -1) return false;

  const item = p.pendingLoot.items[idx];
  const ctx = createBattleContext(state, p, null);

  if (item.type === 'card_draft') {
    const chosenCard = (item.cards || []).find(c => c.defId === selectionPayload.defId) || item.cards?.[0];
    if (!chosenCard) return false;
    const newCard = {
      instanceId: 'C_' + Math.random().toString(36).substring(2, 8),
      defId: chosenCard.defId,
      upgraded: Boolean(chosenCard.upgraded)
    };
    if (!p.masterDeck) p.masterDeck = [];
    p.masterDeck.push(newCard);
    const rDef = resolveCard(newCard);
    ctx.log(`[LOOT] ${p.name} drafted ${rDef?.name || chosenCard.defId} into Master Deck.`);
  } else if (item.type === 'relic') {
    const relicId = item.relicId;
    const rDef = RELIC_REGISTRY[relicId];
    if (!rDef) return false;
    if (!p.relics) p.relics = [];
    if (!p.relics.some(r => r.id === relicId)) {
      const relicState = { id: relicId, counter: 0 };
      p.relics.push(relicState);
      rDef.hooks?.onPickup?.({ player: p, relicState, ctx });
      ctx.log(`[LOOT] ${p.name} equipped Relic: ${rDef.name}!`);
    }
  } else if (item.type === 'potion') {
    const potionId = item.potionId;
    const pDef = POTION_REGISTRY[potionId];
    if (!pDef) return false;
    if (!Array.isArray(p.potions)) p.potions = [null, null, null];
    let slotIdx = p.potions.findIndex(s => s === null);
    if (slotIdx === -1) {
      slotIdx = 2;
    }
    p.potions[slotIdx] = potionId;
    ctx.log(`[LOOT] ${p.name} stored ${pDef.name} in Slot ${slotIdx + 1}.`);
  } else if (item.type === 'upgrade_token') {
    const targetInstanceId = selectionPayload.instanceId;
    let targetCard = (p.masterDeck || []).find(c => c.instanceId === targetInstanceId && !c.upgraded);
    if (!targetCard) {
      targetCard = (p.masterDeck || []).find(c => !c.upgraded);
    }
    if (targetCard) {
      targetCard.upgraded = true;
      const rDef = resolveCard(targetCard);
      ctx.log(`[FORGE] ${p.name} upgraded card to ${rDef?.name}!`);
    }
  }

  p.pendingLoot.items.splice(idx, 1);

  if (p.pendingLoot.items.length === 0) {
    p.pendingLoot = null;
    checkAndAdvanceToMap(state);
  }
  return true;
}

export function skipRemainingLootTransaction(state, playerId) {
  const p = state?.players?.[playerId];
  if (!p) return false;

  if (p.pendingLoot && Array.isArray(p.pendingLoot.items)) {
    const hasMandatory = p.pendingLoot.items.some(item => item.mandatory);
    if (hasMandatory) {
      if (!state.combatLog) state.combatLog = [];
      state.combatLog.push('[WARNING] Cannot skip! Mandatory Anomaly Loot must be claimed first.');
      return false;
    }
  }

  p.pendingLoot = null;
  checkAndAdvanceToMap(state);
  return true;
}

function checkAndAdvanceToMap(state) {
  const allDone = Object.values(state.players || {})
    .filter(p => p.isAlive)
    .every(p => !p.pendingLoot || !p.pendingLoot.items || p.pendingLoot.items.length === 0);

  if (allDone) {
    const selectable = getSelectableNodeIds(state.map);
    if (selectable.length === 0) {
      state.sectorNumber = (state.sectorNumber || 1) + 1;
      state.map = generateSectorMap(12, state.mutators);
      state.combatLog.push(`[SECTOR CLEARED] Advancing to Endless Sector ${state.sectorNumber}!`);
    }
    state.phase = 'map';
  }
}

export function claimPlayerReward(state, playerId, rewardType) {
  if (rewardType === 'skip') return skipRemainingLootTransaction(state, playerId);
  return true;
}

// ----------------------------------------------------------------------------
// 8. End Player Turn & Multi-Enemy Round Resolution
// ----------------------------------------------------------------------------

export function checkAndHandleRunDefeat(state, cause = 'Squad eliminated in combat') {
  if (!state || state.phase === 'run_end') return false;
  const players = Object.values(state.players || {});
  if (players.length === 0) return false;
  const stillAlive = players.filter(p => p.isAlive && p.hp > 0);
  if (stillAlive.length > 0) return false;

  state.phase = 'run_end';
  if (!state.runStats) state.runStats = {};
  state.runStats.endedAt = Date.now();
  state.runStats.outcome = (state.runStats.sectorsCleared || 0) > 0 ? 'victory' : 'defeat';
  state.runStats.causeOfEnd = cause;
  if (!state.combatLog) state.combatLog = [];
  state.combatLog.push(`[RUN END] ${cause} (Sector ${state.sectorNumber || 1} · Floor ${state.floor || 1}).`);
  return true;
}

export function abandonRunTransaction(state, playerId) {
  if (!state || state.phase === 'lobby' || state.phase === 'run_end') return false;
  state.phase = 'run_end';
  if (!state.runStats) state.runStats = {};
  state.runStats.endedAt = Date.now();
  state.runStats.outcome = (state.runStats.sectorsCleared || 0) > 0 ? 'victory' : 'retreated';
  state.runStats.causeOfEnd = (state.runStats.sectorsCleared || 0) > 0
    ? `Extracted after clearing ${state.runStats.sectorsCleared} Sector(s)`
    : `Run ended by Operative on Sector ${state.sectorNumber || 1}, Floor ${state.floor || 1}`;
  if (!state.combatLog) state.combatLog = [];
  state.combatLog.push(`[RUN END] ${state.runStats.causeOfEnd}.`);
  return true;
}

export function endTurnTransaction(state, playerId) {
  if (!state || state.phase !== 'combat') return false;
  const me = state.players?.[playerId];
  if (!me || me.isReady) return false;

  me.isReady = true;
  state.combatLog.push(`[READY] ${me.name} ended turn.`);

  const livingPlayers = Object.values(state.players).filter(p => p.isAlive);
  const allReady = livingPlayers.length > 0 && livingPlayers.every(p => p.isReady);

  if (allReady) {
    for (const p of livingPlayers) {
      triggerHook('onTurnEnd', { player: p, entity: p }, state);
    }

    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.shield = 0;

      triggerHook('onTurnStart', { entity: enemy }, state);
      if (enemy.hp <= 0) continue;

      const aliveTargets = Object.values(state.players).filter(p => p.isAlive);
      const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
      if (target) {
        executeEnemyIntent(enemy, target, state);
      }

      triggerHook('onTurnEnd', { entity: enemy }, state);
    }

    if (checkAndHandleFloorVictory(state)) {
      return true;
    }

    if (checkAndHandleRunDefeat(state, `Eliminated on Sector ${state.sectorNumber || 1}, Floor ${state.floor || 1}`)) {
      return true;
    }

    const isSnecko = Array.isArray(state.mutators) && state.mutators.includes('volatile_compiler');
    const isVamp = Array.isArray(state.mutators) && state.mutators.includes('hyper_regen');
    const drawCount = isSnecko ? 7 : 5;

    for (const pid in state.players) {
      const p = state.players[pid];
      if (!p.isAlive) continue;
      p.shield = 0;
      p.energy = p.maxEnergy || 3;
      p.turnAttacksPlayed = 0;
      p.isReady = false;
      p.discard.push(...p.hand);
      p.hand = [];
      if (isVamp && p.hp > 2) {
        p.hp -= 2;
      }
      drawCards(p, drawCount, state);
      triggerHook('onTurnStart', { player: p, entity: p }, state);
    }

    checkAndHandleFloorVictory(state);
    state.combatLog.push('--- NEW ROUND ---');
  }

  return true;
}
