// ============================================================================
// ENGINE.JS — Hook Pipeline, Map/Loot State Machine, Potions & AI Evaluator
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
  getSelectableNodeIds
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
  getSelectableNodeIds
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
  const add = (id, count, upgraded = false) => {
    for (let i = 0; i < count; i++) {
      cards.push({
        instanceId: 'C_' + Math.random().toString(36).substring(2, 8),
        defId: id,
        upgraded
      });
    }
  };
  add('strike', 4, false);
  add('defend', 4, false);
  add('expose', 1, false);
  add('flurry', 1, false);
  add('shield_slam', 1, false);
  add('venom_blade', 1, false);
  return cards.sort(() => Math.random() - 0.5);
}

export function rollStarterRelicChoices(count = 3) {
  const starterIds = Object.values(RELIC_REGISTRY)
    .filter(r => r.tier === 'starter')
    .map(r => r.id);
  return [...starterIds].sort(() => Math.random() - 0.5).slice(0, count);
}

export function drawCards(player, count, state = null) {
  if (!player.hand) player.hand = [];
  if (!player.deck) player.deck = [];
  if (!player.discard) player.discard = [];
  if (!player.exhaust) player.exhaust = [];

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
    if (drawn) player.hand.push(drawn);
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
  const ctx = createBattleContext(
    state,
    payload.player || payload.entity || payload.source,
    payload.target || state.enemies?.[0]
  );

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
      if (state.combatLog.length > 45) {
        state.combatLog = state.combatLog.slice(-45);
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
      const tag = options.sourceName ? `[SHIELD] ${options.sourceName}` : `[SHIELD] ${entity.name}`;
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
  const scaleBonus = Math.floor((floor - 1) * 1.1);
  const copy = JSON.parse(JSON.stringify(intent));
  if (typeof copy.value === 'number') {
    const perHitBonus = (copy.hits && copy.hits > 1)
      ? Math.floor((floor - 1) * 0.45)
      : scaleBonus;
    copy.value += perHitBonus;
  }
  if (typeof copy.block === 'number') {
    copy.block += Math.floor((floor - 1) * 1.4);
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

export function spawnEnemyForFloor(floor, playerCount = 1, state = {}, roomType = 'combat') {
  const nonBossKeys = Object.keys(ENEMY_REGISTRY).filter(k => k !== 'overlord_core');
  const archetypeId = roomType === 'boss'
    ? 'overlord_core'
    : nonBossKeys[(floor - 1) % nonBossKeys.length];
  const template = ENEMY_REGISTRY[archetypeId];

  let baseHp = template.baseHp + (floor * template.hpPerFloor) + Math.max(0, playerCount - 1) * 22;
  if (roomType === 'elite') baseHp = Math.floor(baseHp * 1.3);
  if (roomType === 'anomaly') baseHp = Math.floor(baseHp * 1.15);

  const statuses = createDefaultStatuses();
  if (roomType === 'elite' || roomType === 'boss') {
    statuses.strength = 1;
  }

  const tagPrefix = roomType === 'elite' ? '[ELITE] ' : (roomType === 'anomaly' ? '[ANOMALY] ' : '');
  const enemy = {
    id: `enemy_f${floor}`,
    archetypeId,
    roomType,
    name: `${tagPrefix}${template.namePrefix}-${floor}`,
    hp: baseHp,
    maxHp: baseHp,
    shield: 0,
    statuses,
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
// 5. Run Initialization, Starter Relic Selection & Map Navigation
// ----------------------------------------------------------------------------

export function createInitialPlayer(id, name) {
  const p = {
    id,
    name,
    hp: 60,
    maxHp: 60,
    shield: 0,
    energy: 3,
    maxEnergy: 3,
    turnAttacksPlayed: 0,
    statuses: createDefaultStatuses(),
    relics: [],
    potions: ['fire_potion', 'block_potion', null], // 3 Potion Slots (2 starter potions + 1 empty slot)
    starterRelicChoices: rollStarterRelicChoices(3),
    masterDeck: createStarterDeck(),
    deck: [],
    hand: [],
    discard: [],
    exhaust: [],
    pendingLoot: null,
    isReady: false,
    isAlive: true
  };
  p.deck = JSON.parse(JSON.stringify(p.masterDeck));
  return p;
}

/**
 * Transitions from Lobby into the Beginning-of-Run Powerful Relic Selection (`phase: 'boot_relic'`).
 */
export function beginRunFromLobby(state) {
  state.floor = 1;
  state.phase = 'boot_relic';
  state.map = generateSectorMap(12);
  state.enemies = [];
  for (const pid in state.players) {
    const p = state.players[pid];
    if (!p.starterRelicChoices || p.starterRelicChoices.length === 0) {
      p.starterRelicChoices = rollStarterRelicChoices(3);
    }
  }
  if (!state.combatLog) state.combatLog = [];
  state.combatLog.push('[SYSTEM] Select 1 Powerful Starter Relic to initialize run.');
  return true;
}

/**
 * Player selects their beginning-of-run powerful relic.
 * Once all players have chosen, transitions to `'map'` so they can select Floor 1's room.
 */
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
  ctx.log(`[BOOT] ${p.name} initialized with ${relicDef.name}!`);

  const allChosen = Object.values(state.players || {}).every(
    pl => !pl.starterRelicChoices || pl.starterRelicChoices.length === 0
  );
  if (allChosen) {
    state.phase = 'map';
    ctx.log('[MAP] Sector Map online. Select a Floor 1 node to deploy.');
  }
  return true;
}

/**
 * Player selects an accessible room node on the branching Sector Map.
 */
export function selectMapNodeTransaction(state, playerId, nodeId) {
  if (!state || state.phase !== 'map') return false;
  if (!state.map) state.map = generateSectorMap(12);

  const selectable = getSelectableNodeIds(state.map);
  if (!selectable.includes(nodeId)) return false;

  const node = findMapNode(state.map, nodeId);
  if (!node) return false;

  node.visited = true;
  state.map.currentNodeId = node.id;
  state.map.currentFloor = node.floor;
  state.map.currentRoomType = node.roomType;
  state.floor = node.floor;

  const roomMeta = MAP_ROOM_TYPES[node.roomType] || MAP_ROOM_TYPES.combat;
  if (!state.combatLog) state.combatLog = [];
  state.combatLog.push(`[MAP] Deployed to Floor ${node.floor}: ${roomMeta.name}.`);

  // Non-combat rooms (`upgrade` Forge/Rest or `treasure` Supply Cache) go straight to Loot/Upgrade phase
  if (node.roomType === 'upgrade') {
    state.phase = 'loot';
    for (const pid in state.players) {
      const p = state.players[pid];
      if (!p.isAlive) continue;
      const healAmt = Math.max(8, Math.floor(p.maxHp * 0.25));
      p.hp = Math.min(p.maxHp, p.hp + healAmt);
      p.pendingLoot = generateRoomLoot(p, 'upgrade', false);
    }
    state.combatLog.push('[FORGE] Restored 25% HP. Upgrade a card in your deck before continuing.');
    return true;
  }

  if (node.roomType === 'treasure') {
    state.phase = 'loot';
    for (const pid in state.players) {
      const p = state.players[pid];
      if (!p.isAlive) continue;
      p.pendingLoot = generateRoomLoot(p, 'treasure', false);
    }
    state.combatLog.push('[VAULT] Supply Cache unlocked! Claim your Relic and supplies.');
    return true;
  }

  // Combat rooms (`combat`, `elite`, `anomaly`, `boss`)
  startFloorCombat(state, false, node.roomType);
  return true;
}

// ----------------------------------------------------------------------------
// 6. Combat Phase, Potions & Card Play
// ----------------------------------------------------------------------------

export function startFloorCombat(state, isInitialFloor = false, roomType = 'combat') {
  state.phase = 'combat';
  state.currentRoomType = roomType;
  const pCount = Object.keys(state.players || {}).length || 1;
  state.enemies = [spawnEnemyForFloor(state.floor || 1, pCount, state, roomType)];

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
  if (!def || me.energy < def.cost) return false;

  const target = state.enemies?.[targetEnemyIdx] || state.enemies?.[0];
  const ctx = createBattleContext(state, me, target);

  me.energy -= def.cost;
  me.hand.splice(cardIdx, 1);

  if (typeof def.onPlay === 'function') {
    def.onPlay(ctx);
  }

  if (def.type === 'attack') {
    me.turnAttacksPlayed = (me.turnAttacksPlayed || 0) + 1;
  }

  triggerHook('onCardPlayed', {
    player: me,
    entity: me,
    target,
    card: cardInstance,
    cardDef: def
  }, state);

  if (def.exhaust) {
    ctx.exhaustCard(me, cardInstance);
  } else {
    me.discard.push(cardInstance);
  }

  checkAndHandleFloorVictory(state);
  return true;
}

export function usePotionTransaction(state, playerId, slotIdx) {
  if (!state) return false;
  const me = state.players?.[playerId];
  if (!me || !me.isAlive || !Array.isArray(me.potions)) return false;

  const potionId = me.potions[slotIdx];
  if (!potionId || !POTION_REGISTRY[potionId]) return false;

  const pDef = POTION_REGISTRY[potionId];
  const target = state.enemies?.find(e => e.hp > 0) || state.enemies?.[0];
  const ctx = createBattleContext(state, me, target);

  me.potions[slotIdx] = null;
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
// 7. Post-Encounter Loot Generation & Mandatory vs Optional Claiming
// ----------------------------------------------------------------------------

export function checkAndHandleFloorVictory(state) {
  if (!state.enemies || state.enemies.length === 0 || !state.enemies.every(e => e.hp <= 0)) {
    return false;
  }

  const roomType = state.currentRoomType || state.map?.currentRoomType || 'combat';
  const isMandatoryRoom = roomType === 'anomaly' || Boolean(MAP_ROOM_TYPES[roomType]?.mandatoryLoot);

  state.combatLog.push(
    isMandatoryRoom
      ? `[VICTORY] Anomaly Cleared! WARNING: Containment Loot is MANDATORY pickup.`
      : `[VICTORY] Floor ${state.floor} cleared! Inspecting loot cache...`
  );

  for (const pid in state.players) {
    const p = state.players[pid];
    if (!p.isAlive) continue;
    triggerHook('onBattleVictory', { player: p, entity: p }, state);
    p.pendingLoot = generateRoomLoot(p, roomType, isMandatoryRoom);
  }

  state.phase = 'loot';
  return true;
}

export function generateRoomLoot(player, roomType = 'combat', isMandatory = false) {
  const items = [];

  // 1. Card Draft (offered in combat, elite, anomaly, boss, treasure)
  if (roomType !== 'upgrade') {
    const pool = Object.values(CARD_REGISTRY).filter(
      c => c.id !== 'inflict_vuln' && c.rarity !== 'starter'
    );
    const upgradeChance = (roomType === 'elite' || roomType === 'boss' || roomType === 'anomaly') ? 0.55 : 0.25;
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

  // 2. Relic Drop (guaranteed in elite, anomaly, treasure, boss; 35% chance in standard combat)
  const shouldDropRelic = ['elite', 'anomaly', 'treasure', 'boss'].includes(roomType) || Math.random() < 0.35;
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

  // 3. Potion Drop (guaranteed in elite, anomaly, treasure, upgrade; 65% in combat)
  const shouldDropPotion = roomType !== 'combat' || Math.random() < 0.65;
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

  // 4. Card Upgrade Token (guaranteed in upgrade, boss, anomaly, treasure; 30% in elite)
  if (['upgrade', 'boss', 'anomaly', 'treasure'].includes(roomType) || (roomType === 'elite' && Math.random() < 0.4)) {
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

/**
 * Claims an individual loot item from `player.pendingLoot.items`.
 */
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
      // If all 3 slots are full and player claims a potion, replace slot 2 so mandatory rooms never soft-lock
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

  // If no loot items remain, automatically check if we can transition to the map
  if (p.pendingLoot.items.length === 0) {
    p.pendingLoot = null;
    checkAndAdvanceToMap(state);
  }
  return true;
}

/**
 * Skips any remaining optional loot and advances to the Sector Map.
 * Refuses if any remaining item has `mandatory: true`.
 */
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
    // If Floor 12 Boss was cleared, generate a fresh Sector Map for Endless/Next Sector
    const selectable = getSelectableNodeIds(state.map);
    if (selectable.length === 0) {
      state.map = generateSectorMap(12);
      state.combatLog.push('[SECTOR CLEARED] New Sector Map generated!');
    }
    state.phase = 'map';
  }
}

// Backwards-compatible wrapper
export function claimPlayerReward(state, playerId, rewardType, itemId) {
  if (rewardType === 'skip') return skipRemainingLootTransaction(state, playerId);
  return true;
}

// ----------------------------------------------------------------------------
// 8. End Player Turn & Enemy Round Resolution
// ----------------------------------------------------------------------------

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

    const stillAlive = Object.values(state.players).filter(p => p.isAlive);
    if (stillAlive.length === 0) {
      state.combatLog.push(`[DEFEAT] Squad wiped on Floor ${state.floor}. Rebooting Sector...`);
      for (const pid in state.players) {
        const pl = state.players[pid];
        pl.hp = pl.maxHp;
        pl.isAlive = true;
        pl.pendingLoot = null;
      }
      state.map = generateSectorMap(12);
      state.phase = 'map';
      return true;
    }

    for (const pid in state.players) {
      const p = state.players[pid];
      if (!p.isAlive) continue;
      p.shield = 0;
      p.energy = p.maxEnergy || 3;
      p.turnAttacksPlayed = 0;
      p.isReady = false;
      p.discard.push(...p.hand);
      p.hand = [];
      drawCards(p, 5, state);
      triggerHook('onTurnStart', { player: p, entity: p }, state);
    }

    checkAndHandleFloorVictory(state);
    state.combatLog.push('--- NEW ROUND ---');
  }

  return true;
}
