// ============================================================================
// ENGINE.JS — Event-Driven Hook Pipeline, Combat State Machine & AI Evaluator
// ============================================================================

import {
  STATUS_REGISTRY,
  CARD_REGISTRY,
  CARD_CATALOG,
  RELIC_REGISTRY,
  ENEMY_REGISTRY
} from "./registry.js";

export {
  STATUS_REGISTRY,
  CARD_REGISTRY,
  CARD_CATALOG,
  RELIC_REGISTRY,
  ENEMY_REGISTRY
};

// ----------------------------------------------------------------------------
// 1. Pure Utility & Legacy-Compatible Helpers
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

export function createStarterDeck() {
  const cards = [];
  const add = (id, count) => {
    for (let i = 0; i < count; i++) {
      cards.push({
        instanceId: 'C_' + Math.random().toString(36).substring(2, 8),
        defId: id
      });
    }
  };
  // Starter deck featuring core + showcase cards for immediate tactical variety
  add('strike', 3);
  add('defend', 3);
  add('expose', 1);
  add('flurry', 1);
  add('shield_slam', 1);
  add('venom_blade', 1);
  add('overclock', 1);
  return cards.sort(() => Math.random() - 0.5);
}

export function createStarterRelics() {
  return [
    { id: 'anchor_module', counter: 0 },
    { id: 'rage_capacitor', counter: 0 },
    { id: 'kinetic_converter', counter: 0 }
  ];
}

export function drawCards(player, count, state = null) {
  if (!player.hand) player.hand = [];
  if (!player.deck) player.deck = [];
  if (!player.discard) player.discard = [];
  if (!player.exhaust) player.exhaust = [];

  for (let i = 0; i < count; i++) {
    if (player.hand.length >= 10) break; // Max hand size cap
    if (player.deck.length === 0) {
      if (player.discard.length === 0) break;
      player.deck = [...player.discard].sort(() => Math.random() - 0.5);
      player.discard = [];
      if (state?.combatLog) {
        state.combatLog.push(`[DECK] ${player.name} reshuffled discard pile.`);
      }
    }
    const drawn = player.deck.pop();
    if (drawn) player.hand.push(drawn);
  }
}

// ----------------------------------------------------------------------------
// 2. Event-Driven Hook Pipeline
// ----------------------------------------------------------------------------

/**
 * Runs a value-modifying hook pipeline (`modifyOutgoingDamage`, `modifyIncomingDamage`, `modifyBlockGained`).
 * Deterministic order:
 * 1. Flat status bonuses (`strength`, `dexterity`)
 * 2. Relic modifier hooks (`RELIC_REGISTRY[r.id].hooks[hookName]`)
 * 3. Multiplicative status modifiers (`weak`, `vulnerable`)
 */
export function runModifierHook(hookName, initialValue, payload, state) {
  let value = initialValue;
  const ctx = createBattleContext(state, payload.player || payload.source, payload.target);

  if (hookName === 'modifyOutgoingDamage') {
    const source = payload.source;
    ensureEntityStatuses(source);

    // 1. Flat status bonus (Strength)
    const strHook = STATUS_REGISTRY.strength?.hooks?.modifyOutgoingDamage;
    if (strHook && source.statuses.strength !== 0) {
      value = strHook(value, { ...payload, ctx });
    }

    // 2. Source player's relics
    if (Array.isArray(source?.relics)) {
      for (const relicState of source.relics) {
        const relicDef = RELIC_REGISTRY[relicState.id];
        const fn = relicDef?.hooks?.[hookName];
        if (fn) {
          value = fn(value, { ...payload, player: source, relicState, ctx });
        }
      }
    }

    // 3. Multiplicative status (Weak)
    const weakHook = STATUS_REGISTRY.weak?.hooks?.modifyOutgoingDamage;
    if (weakHook && source.statuses.weak > 0) {
      value = weakHook(value, { ...payload, ctx });
    }
  } else if (hookName === 'modifyIncomingDamage') {
    const target = payload.target;
    ensureEntityStatuses(target);

    // 1. Target player's relics
    if (Array.isArray(target?.relics)) {
      for (const relicState of target.relics) {
        const relicDef = RELIC_REGISTRY[relicState.id];
        const fn = relicDef?.hooks?.[hookName];
        if (fn) {
          value = fn(value, { ...payload, player: target, relicState, ctx });
        }
      }
    }

    // 2. Multiplicative status (Vulnerable)
    const vulnHook = STATUS_REGISTRY.vulnerable?.hooks?.modifyIncomingDamage;
    if (vulnHook && target.statuses.vulnerable > 0) {
      value = vulnHook(value, { ...payload, ctx });
    }
  } else if (hookName === 'modifyBlockGained') {
    const entity = payload.entity;
    ensureEntityStatuses(entity);

    // 1. Flat status bonus (Dexterity)
    const dexHook = STATUS_REGISTRY.dexterity?.hooks?.modifyBlockGained;
    if (dexHook && entity.statuses.dexterity !== 0) {
      value = dexHook(value, { ...payload, ctx });
    }

    // 2. Entity's relics
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

/**
 * Triggers lifecycle side-effect hooks across player relics and entity statuses.
 * Supported hooks:
 * - `onBattleStart`, `onTurnStart`, `onCardPlayed`, `onCardExhausted`,
 *   `onDamageDealt`, `onDamageTaken`, `onStatusApplied`, `onTurnEnd`, `onBattleVictory`
 */
export function triggerHook(hookName, payload, state) {
  const ctx = createBattleContext(
    state,
    payload.player || payload.entity || payload.source,
    payload.target || state.enemies?.[0]
  );

  // 1. Trigger Relic Hooks for the relevant player (or all living players if battle-wide)
  const targetPlayers = payload.player
    ? [payload.player]
    : payload.allPlayers
      ? Object.values(state.players || {}).filter(p => p.isAlive)
      : [];

  for (const player of targetPlayers) {
    if (!Array.isArray(player.relics)) continue;
    for (const relicState of player.relics) {
      const relicDef = RELIC_REGISTRY[relicState.id];
      const fn = relicDef?.hooks?.[hookName];
      if (fn) {
        fn({ ...payload, player, relicState, ctx });
      }
    }
  }

  // 2. Trigger Status Hooks for the specified entity (player or enemy)
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
  const ctx = {
    state,
    player: activePlayer,
    target: activeTarget || state?.enemies?.find(e => e.hp > 0) || state?.enemies?.[0],

    log(msg) {
      if (!state.combatLog) state.combatLog = [];
      state.combatLog.push(msg);
      if (state.combatLog.length > 40) {
        state.combatLog = state.combatLog.slice(-40);
      }
    },

    computeCardDamagePreview(player, target, baseDamage, strengthMultiplier = 1) {
      const out = runModifierHook(
        'modifyOutgoingDamage',
        baseDamage,
        { source: player, target, multiplier: strengthMultiplier },
        state
      );
      if (!target) return out;
      return runModifierHook(
        'modifyIncomingDamage',
        out,
        { source: player, target },
        state
      );
    },

    computeCardBlockPreview(player, baseBlock) {
      return runModifierHook('modifyBlockGained', baseBlock, { entity: player }, state);
    },

    dealDamage(source, target, baseDamage, options = {}) {
      if (!target || target.hp <= 0) return { shieldDamage: 0, hpDamage: 0 };
      const multiplier = options.strengthMultiplier || options.card?.strengthMultiplier || 1;

      const afterOut = runModifierHook(
        'modifyOutgoingDamage',
        baseDamage,
        { source, target, card: options.card, multiplier },
        state
      );
      const finalDmg = runModifierHook(
        'modifyIncomingDamage',
        afterOut,
        { source, target, card: options.card },
        state
      );

      const res = applyDamageToEntity(finalDmg, target.shield || 0, target.hp);
      target.shield = res.finalShield;
      target.hp = res.finalHp;

      const label = options.sourceName || options.card?.name || source?.name || 'Attack';
      ctx.log(`[ATK] ${source?.name || label} -> ${target.name}: ${finalDmg} dmg (${res.shieldDamage > 0 ? `🛡️-${res.shieldDamage} ` : ''}HP -${res.hpDamage}).`);

      if (target.isAlive !== undefined && target.hp <= 0) {
        target.isAlive = false;
      }

      triggerHook('onDamageDealt', {
        source,
        target,
        player: source?.relics ? source : null,
        damage: finalDmg,
        hpLost: res.hpDamage,
        isAttack: true
      }, state);

      triggerHook('onDamageTaken', {
        source,
        target,
        entity: target,
        player: target?.relics ? target : null,
        damage: finalDmg,
        hpLost: res.hpDamage,
        isAttack: true
      }, state);

      return res;
    },

    dealRawDamage(source, target, rawDamage, sourceName = 'Effect') {
      if (!target || target.hp <= 0 || rawDamage <= 0) return { shieldDamage: 0, hpDamage: 0 };
      const res = applyDamageToEntity(rawDamage, target.shield || 0, target.hp);
      target.shield = res.finalShield;
      target.hp = res.finalHp;
      if (target.isAlive !== undefined && target.hp <= 0) {
        target.isAlive = false;
      }
      ctx.log(`[PROC] ${sourceName} dealt ${rawDamage} to ${target.name}.`);
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
      const tag = options.sourceName ? `[RELIC] ${options.sourceName}` : `[SHIELD] ${entity.name}`;
      ctx.log(`${tag} gained +${finalBlock} Shield.`);
      return finalBlock;
    },

    applyStatus(source, target, statusId, stacks) {
      if (!target || target.hp <= 0 || !stacks) return;
      ensureEntityStatuses(target);
      target.statuses[statusId] = (target.statuses[statusId] || 0) + stacks;
      const statusName = STATUS_REGISTRY[statusId]?.name || statusId.toUpperCase();
      ctx.log(`[STATUS] ${target.name} gained +${stacks} ${statusName} (${target.statuses[statusId]}).`);

      triggerHook('onStatusApplied', {
        source,
        target,
        entity: target,
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
      const def = CARD_REGISTRY[cardInstance.defId];
      ctx.log(`[EXHAUST] ${def?.name || cardInstance.defId} exhausted.`);
      triggerHook('onCardExhausted', {
        player,
        card: cardInstance,
        cardDef: def
      }, state);
    }
  };

  return ctx;
}

// ----------------------------------------------------------------------------
// 4. Enemy Behavior Tree Evaluator & Intent System
// ----------------------------------------------------------------------------

export function evaluateBehaviorTree(node, enemy, state) {
  if (!node) return null;

  switch (node.type) {
    case 'action':
      return structuredCloneIntent(node.intent, state.floor || 1);

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
          return structuredCloneIntent(opt.intent, state.floor || 1);
        }
      }
      return structuredCloneIntent(validOptions[0]?.intent, state.floor || 1);
    }

    default:
      return null;
  }
}

function structuredCloneIntent(intent, floor = 1) {
  if (!intent) {
    return { id: 'basic_strike', type: 'attack', value: 6 + floor, hits: 1, label: 'STRIKE' };
  }
  const scaleBonus = Math.floor((floor - 1) * 1.2);
  const copy = JSON.parse(JSON.stringify(intent));
  if (typeof copy.value === 'number') {
    const perHitBonus = (copy.hits && copy.hits > 1)
      ? Math.floor((floor - 1) * 0.5)
      : scaleBonus;
    copy.value += perHitBonus;
  }
  if (typeof copy.block === 'number') {
    copy.block += Math.floor((floor - 1) * 1.5);
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
    value: 6 + (state.floor || 1),
    hits: 1,
    label: 'STRIKE'
  };
  enemy.intent = chosen;
  return chosen;
}

export function spawnEnemyForFloor(floor, playerCount = 1, state = {}) {
  const archetypes = Object.keys(ENEMY_REGISTRY);
  const archetypeId = archetypes[(floor - 1) % archetypes.length];
  const template = ENEMY_REGISTRY[archetypeId];

  const baseHp = template.baseHp + (floor * template.hpPerFloor) + Math.max(0, playerCount - 1) * 22;
  const enemy = {
    id: `enemy_f${floor}`,
    archetypeId,
    name: `${template.namePrefix}-${floor}${String.fromCharCode(64 + ((floor - 1) % 3) + 1)}`,
    hp: baseHp,
    maxHp: baseHp,
    shield: 0,
    statuses: createDefaultStatuses(),
    aiState: { turn: 0, lastMoveId: null },
    intent: null
  };

  selectNextEnemyIntent(enemy, { ...state, floor });
  return enemy;
}

export function executeEnemyIntent(enemy, targetPlayer, state) {
  if (!enemy || enemy.hp <= 0) return;
  const ctx = createBattleContext(state, targetPlayer, enemy);
  const intent = enemy.intent || { type: 'attack', value: 6, hits: 1, label: 'ATTACK' };

  // 1. Block component
  if (intent.block && intent.block > 0) {
    ctx.gainBlock(enemy, intent.block, { raw: true });
  }

  // 2. Attack / Multi-hit component
  if (intent.value && intent.value > 0 && targetPlayer && targetPlayer.isAlive) {
    const hits = intent.hits || 1;
    for (let i = 0; i < hits; i++) {
      if (!targetPlayer.isAlive) break;
      ctx.dealDamage(enemy, targetPlayer, intent.value, { sourceName: `${enemy.name} (${intent.label || 'ATK'})` });
    }
  }

  // 3. Buff or Debuff status component
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

  // Advance AI state and telegraph next move
  if (!enemy.aiState) enemy.aiState = { turn: 0, lastMoveId: null };
  enemy.aiState.lastMoveId = intent.id || intent.type;
  enemy.aiState.turn = (enemy.aiState.turn || 0) + 1;

  selectNextEnemyIntent(enemy, state);
}

/**
 * Formats the enemy's telegraphed intent with live damage calculations.
 */
export function formatTelegraphedIntent(enemy, targetPlayer, state) {
  if (!enemy || !enemy.intent) {
    return { text: 'INTENT: --', category: 'neutral' };
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
    text: `INTENT: ${parts.join(' · ')}`,
    category
  };
}

// ----------------------------------------------------------------------------
// 5. High-Level Serializable State Mutators (Used by Firestore & Local Mode)
// ----------------------------------------------------------------------------

export function createInitialPlayer(id, name) {
  const p = {
    id,
    name,
    hp: 56,
    maxHp: 56,
    shield: 0,
    energy: 3,
    maxEnergy: 3,
    statuses: createDefaultStatuses(),
    relics: createStarterRelics(),
    masterDeck: createStarterDeck(),
    deck: [],
    hand: [],
    discard: [],
    exhaust: [],
    pendingReward: null,
    isReady: false,
    isAlive: true
  };
  p.deck = JSON.parse(JSON.stringify(p.masterDeck));
  return p;
}

export function startFloorCombat(state, isInitialFloor = false) {
  state.phase = 'combat';
  const pCount = Object.keys(state.players || {}).length || 1;
  state.enemies = [spawnEnemyForFloor(state.floor || 1, pCount, state)];

  for (const pid in state.players) {
    const p = state.players[pid];
    if (!p.isAlive && isInitialFloor) {
      p.hp = p.maxHp;
      p.isAlive = true;
    }
    if (!p.isAlive) continue;

    p.energy = p.maxEnergy || 3;
    p.shield = 0;
    p.isReady = false;
    p.statuses = createDefaultStatuses();

    if (!p.masterDeck || p.masterDeck.length === 0) {
      p.masterDeck = createStarterDeck();
    }
    p.deck = JSON.parse(JSON.stringify(p.masterDeck)).sort(() => Math.random() - 0.5);
    p.hand = [];
    p.discard = [];
    p.exhaust = [];

    drawCards(p, 5, state);
  }

  if (!state.combatLog) state.combatLog = [];
  state.combatLog.push(`=== FLOOR ${state.floor}: ${state.enemies[0].name} ENGAGED ===`);

  // Trigger onBattleStart & Turn 1 onTurnStart hooks for all living players
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
  const def = CARD_REGISTRY[cardInstance.defId];
  if (!def || me.energy < def.cost) return false;

  const target = state.enemies?.[targetEnemyIdx] || state.enemies?.[0];
  const ctx = createBattleContext(state, me, target);

  // 1. Pay energy & remove from hand
  me.energy -= def.cost;
  me.hand.splice(cardIdx, 1);

  // 2. Execute card effect via registry callback
  if (typeof def.onPlay === 'function') {
    def.onPlay(ctx);
  }

  // 3. Trigger `onCardPlayed` hook (Relics like Rage Capacitor subscribe here)
  triggerHook('onCardPlayed', {
    player: me,
    entity: me,
    target,
    card: cardInstance,
    cardDef: def
  }, state);

  // 4. Route card to Exhaust or Discard
  if (def.exhaust) {
    ctx.exhaustCard(me, cardInstance);
  } else {
    me.discard.push(cardInstance);
  }

  // 5. Check if all enemies are defeated
  checkAndHandleFloorVictory(state);
  return true;
}

export function checkAndHandleFloorVictory(state) {
  if (!state.enemies || !state.enemies.every(e => e.hp <= 0)) return false;

  state.combatLog.push(`[VICTORY] Floor ${state.floor} cleared!`);

  // Trigger `onBattleVictory` hooks (e.g. Vampiric Siphon relic)
  for (const pid in state.players) {
    const p = state.players[pid];
    if (!p.isAlive) continue;
    triggerHook('onBattleVictory', { player: p, entity: p }, state);
    p.pendingReward = generateFloorRewards(p);
  }

  state.floor = (state.floor || 1) + 1;
  startFloorCombat(state, false);
  return true;
}

export function generateFloorRewards(player) {
  const draftableCards = Object.values(CARD_REGISTRY).filter(
    c => c.id !== 'inflict_vuln' && c.rarity !== 'starter'
  );
  const shuffledCards = [...draftableCards].sort(() => Math.random() - 0.5).slice(0, 3).map(c => c.id);

  const ownedRelicIds = new Set((player.relics || []).map(r => r.id));
  const availableRelics = Object.keys(RELIC_REGISTRY).filter(id => !ownedRelicIds.has(id));
  const relicOffer = availableRelics.length > 0
    ? availableRelics[Math.floor(Math.random() * availableRelics.length)]
    : null;

  return {
    cards: shuffledCards,
    relic: relicOffer
  };
}

export function claimPlayerReward(state, playerId, rewardType, itemId) {
  const p = state?.players?.[playerId];
  if (!p || !p.pendingReward) return false;

  if (rewardType === 'card' && itemId && CARD_REGISTRY[itemId]) {
    const newCard = {
      instanceId: 'C_' + Math.random().toString(36).substring(2, 8),
      defId: itemId
    };
    if (!p.masterDeck) p.masterDeck = [];
    p.masterDeck.push(newCard);
    p.hand.push(JSON.parse(JSON.stringify(newCard)));
    state.combatLog.push(`[DRAFT] ${p.name} added ${CARD_REGISTRY[itemId].name} to deck.`);
  } else if (rewardType === 'relic' && itemId && RELIC_REGISTRY[itemId]) {
    if (!p.relics) p.relics = [];
    if (!p.relics.some(r => r.id === itemId)) {
      const relicState = { id: itemId, counter: 0 };
      p.relics.push(relicState);
      state.combatLog.push(`[RELIC] ${p.name} equipped ${RELIC_REGISTRY[itemId].name}!`);
      // Trigger onBattleStart for newly acquired relic so it's immediately active
      const ctx = createBattleContext(state, p, state.enemies?.[0]);
      RELIC_REGISTRY[itemId]?.hooks?.onBattleStart?.({ player: p, relicState, ctx });
    }
  }

  p.pendingReward = null;
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
    // 1. Player onTurnEnd hooks (Weak/Vulnerable tick down)
    for (const p of livingPlayers) {
      triggerHook('onTurnEnd', { player: p, entity: p }, state);
    }

    // 2. Enemy Turn Lifecycle: reset enemy shield -> onTurnStart (Corrode ticks!) -> executeIntent -> onTurnEnd
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0) continue;
      enemy.shield = 0;

      // Enemy onTurnStart (Corrode DoT ticks here!)
      triggerHook('onTurnStart', { entity: enemy }, state);
      if (enemy.hp <= 0) continue;

      const aliveTargets = Object.values(state.players).filter(p => p.isAlive);
      const target = aliveTargets[Math.floor(Math.random() * aliveTargets.length)];
      if (target) {
        executeEnemyIntent(enemy, target, state);
      }

      // Enemy onTurnEnd (Weak/Vulnerable tick down)
      triggerHook('onTurnEnd', { entity: enemy }, state);
    }

    // Check if enemy died to Corrode or Thorns during enemy phase!
    if (checkAndHandleFloorVictory(state)) {
      return true;
    }

    // Check if all players died
    const stillAlive = Object.values(state.players).filter(p => p.isAlive);
    if (stillAlive.length === 0) {
      state.combatLog.push(`[DEFEAT] Squad wiped on Floor ${state.floor}. Rebooting Floor 1...`);
      state.floor = 1;
      startFloorCombat(state, true);
      return true;
    }

    // 3. Start Next Player Round
    for (const pid in state.players) {
      const p = state.players[pid];
      if (!p.isAlive) continue;
      p.shield = 0;
      p.energy = p.maxEnergy || 3;
      p.isReady = false;
      p.discard.push(...p.hand);
      p.hand = [];
      drawCards(p, 5, state);
      triggerHook('onTurnStart', { player: p, entity: p }, state);
    }

    // Check if enemy died to start-of-turn relics (e.g. Chrono Emitter)
    checkAndHandleFloorVictory(state);
    state.combatLog.push('--- NEW ROUND ---');
  }

  return true;
}
