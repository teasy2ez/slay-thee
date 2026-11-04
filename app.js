// Import Firebase core and Firestore via browser-compatible CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Import data-driven registries & hook-based engine
import {
  RELIC_REGISTRY,
  POTION_REGISTRY,
  STATUS_REGISTRY,
  MAP_ROOM_TYPES,
  resolveCard,
  findMapNode,
  getSelectableNodeIds,
  createInitialPlayer,
  beginRunFromLobby,
  selectStarterRelicTransaction,
  selectMapNodeTransaction,
  playCardTransaction,
  usePotionTransaction,
  discardPotionTransaction,
  claimLootItemTransaction,
  skipRemainingLootTransaction,
  endTurnTransaction,
  formatTelegraphedIntent,
  createBattleContext
} from "./engine.js";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQxj7BNDQWp5iNw7iFxP8cIG3nlzU_CBU",
  authDomain: "slay-thee.firebaseapp.com",
  projectId: "slay-thee",
  storageBucket: "slay-thee.firebasestorage.app",
  messagingSenderId: "342068226129",
  appId: "1:342068226129:web:fa2f50edd5f6df72e2b070",
  measurementId: "G-119K8VDQLR"
};

let app = null;
let analytics = null;
let db = null;
try {
  app = initializeApp(firebaseConfig);
  analytics = getAnalytics(app);
  db = getFirestore(app);
} catch (err) {
  console.warn("Firebase initialization warning (offline/local mode available):", err);
}

// Local Player & Room Session State
let currentRoomId = '';
let myPlayerId = '';
let currentRoomDoc = null;
let currentGameState = null;
let isLocalSoloMode = false;
let selectedTargetIdx = 0;

// UI Handles
const lobbyScreen = document.getElementById('lobby-screen');
const combatScreen = document.getElementById('combat-screen');
const nameInput = document.getElementById('player-name-input');
const roomInput = document.getElementById('room-code-input');
const btnJoin = document.getElementById('btn-join');
const btnSolo = document.getElementById('btn-solo');
const btnEndTurn = document.getElementById('btn-end-turn');

const roomBadge = document.getElementById('room-badge');
const floorBadge = document.getElementById('floor-badge');
const teammatesBar = document.getElementById('teammates-bar');
const relicsBar = document.getElementById('relics-bar');
const potionsBar = document.getElementById('potions-bar');
const enemyContainer = document.getElementById('enemy-container');

const combatFeed = document.getElementById('combat-feed');

const playerVitals = document.getElementById('player-vitals');
const playerEnergy = document.getElementById('player-energy');
const playerMaxEnergy = document.getElementById('player-max-energy');
const pileStats = document.getElementById('pile-stats');
const playerHpFill = document.getElementById('player-hp-fill');
const playerShieldFill = document.getElementById('player-shield-fill');
const playerHpText = document.getElementById('player-hp-text');
const playerStatuses = document.getElementById('player-statuses');
const cardCarousel = document.getElementById('card-carousel');

// Overlays
const bootRelicModal = document.getElementById('boot-relic-modal');
const bootRelicChoices = document.getElementById('boot-relic-choices');
const mapModal = document.getElementById('map-modal');
const mapProgressBadge = document.getElementById('map-progress-badge');
const mapScrollViewport = document.getElementById('map-scroll-viewport');
const mapTreeSvg = document.getElementById('map-tree-svg');
const mapNodesContainer = document.getElementById('map-nodes-container');
const rewardModal = document.getElementById('reward-modal');
const rewardModalTitle = document.getElementById('reward-modal-title');
const rewardModalSub = document.getElementById('reward-modal-sub');
const rewardChoices = document.getElementById('reward-choices');
const btnSkipReward = document.getElementById('btn-skip-reward');

/**
 * Unified state mutation wrapper for both Firestore transactions and Solo Local Mode.
 */
async function mutateGameState(mutatorFn) {
  if (isLocalSoloMode) {
    if (!currentGameState) return;
    const prevSnapshot = JSON.parse(JSON.stringify(currentGameState));
    const nextState = JSON.parse(JSON.stringify(currentGameState));
    const changed = mutatorFn(nextState);
    if (changed !== false) {
      currentGameState = JSON.parse(JSON.stringify(nextState));
      renderState(currentGameState, prevSnapshot);
    }
    return;
  }

  if (!db || !currentRoomDoc) return;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(currentRoomDoc);
    if (!snap.exists()) return;
    const data = snap.data();
    const changed = mutatorFn(data);
    if (changed !== false) {
      const cleanData = JSON.parse(JSON.stringify(data));
      tx.set(currentRoomDoc, cleanData);
    }
  });
}

// 1A. Join or Create Firestore Multiplayer Room
btnJoin.addEventListener('click', async () => {
  const name = (nameInput.value.trim() || 'OPERATIVE').toUpperCase();
  const room = (roomInput.value.trim() || Math.random().toString(36).substring(2, 7)).toUpperCase();
  myPlayerId = 'P_' + Math.random().toString(36).substring(2, 7);
  currentRoomId = room;
  isLocalSoloMode = false;

  if (!db) {
    alert("Firestore SDK unavailable. Launching Solo Local Mode instead.");
    startSoloMission();
    return;
  }

  currentRoomDoc = doc(db, "rooms", room);

  try {
    const snap = await getDoc(currentRoomDoc);
    const starterPlayer = JSON.parse(JSON.stringify(createInitialPlayer(myPlayerId, name)));

    if (!snap.exists()) {
      await setDoc(currentRoomDoc, {
        roomId: room,
        floor: 1,
        phase: 'lobby',
        players: { [myPlayerId]: starterPlayer },
        enemies: [],
        combatLog: [`[SYSTEM] Room ${room} created by ${name}.`]
      });
    } else {
      await updateDoc(currentRoomDoc, {
        [`players.${myPlayerId}`]: starterPlayer,
        combatLog: [...(snap.data().combatLog || []), `[SYSTEM] ${name} joined party.`]
      });
    }

    roomBadge.textContent = `ROOM: ${room}`;
    lobbyScreen.classList.add('hidden');
    combatScreen.classList.remove('hidden');

    onSnapshot(currentRoomDoc, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const prev = currentGameState ? JSON.parse(JSON.stringify(currentGameState)) : null;
        currentGameState = docSnapshot.data();
        renderState(currentGameState, prev);
      }
    });
  } catch (error) {
    console.error("Firestore connection error:", error);
    alert("Could not connect to Firestore room. Launching Solo Local Mode.");
    startSoloMission();
  }
});

// 1B. Start Solo Local Mission (Instant Single-Player)
function startSoloMission() {
  const name = (nameInput.value.trim() || 'OPERATIVE').toUpperCase();
  myPlayerId = 'P_SOLO';
  currentRoomId = 'SOLO';
  isLocalSoloMode = true;

  const starterPlayer = createInitialPlayer(myPlayerId, name);
  currentGameState = {
    roomId: 'SOLO',
    floor: 1,
    phase: 'lobby',
    players: { [myPlayerId]: starterPlayer },
    enemies: [],
    combatLog: [`[SYSTEM] Solo mission initialized for ${name}.`]
  };

  beginRunFromLobby(currentGameState);
  currentGameState = JSON.parse(JSON.stringify(currentGameState));

  roomBadge.textContent = 'MODE: SOLO';
  lobbyScreen.classList.add('hidden');
  combatScreen.classList.remove('hidden');
  renderState(currentGameState, null);
}

if (btnSolo) {
  btnSolo.addEventListener('click', startSoloMission);
}

// 2. Launch Run (into Starter Relic Selection)
async function startGame() {
  await mutateGameState((data) => {
    return beginRunFromLobby(data);
  });
}

// 3. Choose Beginning-of-Run Powerful Relic
async function chooseBootRelic(relicId) {
  await mutateGameState((data) => {
    return selectStarterRelicTransaction(data, myPlayerId, relicId);
  });
}

// 4. Select Room Node on Branching Sector Map
async function chooseMapNode(nodeId) {
  selectedTargetIdx = 0;
  await mutateGameState((data) => {
    return selectMapNodeTransaction(data, myPlayerId, nodeId);
  });
}

// 5. Play a Card from Hand
async function castCard(card) {
  if (!currentGameState || currentGameState.phase !== 'combat') return;
  await mutateGameState((data) => {
    return playCardTransaction(data, myPlayerId, card.instanceId, selectedTargetIdx);
  });
}

// 6. Use or Discard a Potion Slot (0, 1, 2)
async function usePotionSlot(slotIdx) {
  await mutateGameState((data) => {
    return usePotionTransaction(data, myPlayerId, slotIdx, selectedTargetIdx);
  });
}

async function dumpPotionSlot(slotIdx, ev) {
  if (ev) ev.stopPropagation();
  await mutateGameState((data) => {
    return discardPotionTransaction(data, myPlayerId, slotIdx);
  });
}

// 7. Claim or Skip Post-Encounter Loot Item
async function claimLoot(lootItemId, payload = {}) {
  await mutateGameState((data) => {
    return claimLootItemTransaction(data, myPlayerId, lootItemId, payload);
  });
}

async function skipRemainingLoot() {
  await mutateGameState((data) => {
    return skipRemainingLootTransaction(data, myPlayerId);
  });
}

if (btnSkipReward) {
  btnSkipReward.addEventListener('click', skipRemainingLoot);
}

// 8. End Player Turn
async function endTurn() {
  if (!currentGameState || currentGameState.phase !== 'combat') return;
  await mutateGameState((data) => {
    return endTurnTransaction(data, myPlayerId);
  });
}

function renderStatusBadges(container, statuses) {
  container.innerHTML = '';
  if (!statuses) return;
  for (const [statusId, stacks] of Object.entries(statuses)) {
    if (!stacks || stacks <= 0) continue;
    const def = STATUS_REGISTRY[statusId];
    if (!def) continue;
    const span = document.createElement('span');
    span.className = `tag ${def.cssClass}`;
    span.textContent = `${def.name} (${stacks})`;
    span.title = def.description;
    container.appendChild(span);
  }
}

/**
 * Spawns a floating combat text popup and triggers CSS hit/shield/lunge animations.
 */
function spawnFloatingText(parentEl, text, popClass) {
  if (!parentEl) return;
  const pop = document.createElement('div');
  pop.className = `floating-pop ${popClass}`;
  pop.textContent = text;
  parentEl.appendChild(pop);
  setTimeout(() => {
    if (pop.parentNode) pop.parentNode.removeChild(pop);
  }, 850);
}

function triggerClassAnim(el, animClass, duration = 400) {
  if (!el) return;
  el.classList.remove(animClass);
  void el.offsetWidth; // Force reflow
  el.classList.add(animClass);
  setTimeout(() => el.classList.remove(animClass), duration);
}

function triggerCombatAnimations(prevState, nextState) {
  if (!prevState || !nextState || prevState.phase !== 'combat') return;

  // 1. Enemy diffs (damage taken, shield gained)
  const prevEnemies = prevState.enemies || [];
  const nextEnemies = nextState.enemies || [];
  const enemyEls = enemyContainer ? enemyContainer.querySelectorAll('.enemy-unit') : [];

  nextEnemies.forEach((eNext, idx) => {
    const ePrev = prevEnemies.find(p => p.id === eNext.id);
    const unitEl = enemyEls[idx];
    if (!ePrev || !unitEl) return;

    const hpLost = Math.max(0, ePrev.hp - eNext.hp);
    const shdLost = Math.max(0, (ePrev.shield || 0) - (eNext.shield || 0));
    const shdGained = Math.max(0, (eNext.shield || 0) - (ePrev.shield || 0));

    if (hpLost > 0 || shdLost > 0) {
      triggerClassAnim(unitEl, 'anim-hit', 380);
      const totalHit = hpLost + shdLost;
      spawnFloatingText(unitEl, `-${totalHit}${hpLost === 0 ? ' 🛡️' : ' HP'}`, 'dmg-pop');
    } else if (shdGained > 0) {
      triggerClassAnim(unitEl, 'anim-shield', 420);
      spawnFloatingText(unitEl, `+${shdGained} 🛡️`, 'shd-pop');
    }
  });

  // 2. Player diffs (damage taken from enemies, shield gained, HP healed)
  const pPrev = prevState.players?.[myPlayerId];
  const pNext = nextState.players?.[myPlayerId];
  if (pPrev && pNext && playerVitals) {
    const hpDiff = pNext.hp - pPrev.hp;
    const shdDiff = (pNext.shield || 0) - (pPrev.shield || 0);

    if (hpDiff < 0) {
      // Enemy hit player HP! Lunge enemies and shake player vitals
      enemyEls.forEach(el => {
        if (!el.classList.contains('dead')) triggerClassAnim(el, 'anim-lunge', 360);
      });
      triggerClassAnim(playerVitals, 'anim-hit', 380);
      spawnFloatingText(playerVitals, `${hpDiff} HP`, 'dmg-pop');
    } else if (hpDiff > 0) {
      spawnFloatingText(playerVitals, `+${hpDiff} HP`, 'heal-pop');
    }

    if (shdDiff > 0) {
      triggerClassAnim(playerVitals, 'anim-shield', 420);
      spawnFloatingText(playerVitals, `+${shdDiff} 🛡️`, 'shd-pop');
    }
  }
}

/**
 * Renders the 12-Floor Branching Tree Map with SVG connector lines.
 */
function renderBranchingTreeMap(mapState) {
  if (!mapState || !mapNodesContainer || !mapTreeSvg) return;

  const selectableIds = new Set(getSelectableNodeIds(mapState));
  const nextFloor = (mapState.currentFloor || 0) + 1;
  if (mapProgressBadge) {
    mapProgressBadge.textContent = `FLOOR ${nextFloor} / ${mapState.totalFloors || 12}`;
  }

  const totalRows = mapState.rows?.length || 12;
  const canvasHeight = 780;
  const topPad = 42;
  const botPad = 42;
  const rowStep = (canvasHeight - topPad - botPad) / Math.max(1, totalRows - 1);

  // Compute (xPct, yPx) for every node (Floor 1 at top -> Floor 12 at bottom)
  const nodeCoords = {};
  for (const row of mapState.rows || []) {
    for (const node of row) {
      const yPx = Math.round(topPad + (node.floor - 1) * rowStep);
      nodeCoords[node.id] = { xPct: node.xPct || 50, yPx, node };
    }
  }

  // 1. Draw SVG Connector Lines between parent nodes and `nextIds`
  let svgLines = '';
  for (const row of mapState.rows || []) {
    for (const node of row) {
      const from = nodeCoords[node.id];
      if (!from) continue;

      for (const targetId of node.nextIds || []) {
        const to = nodeCoords[targetId];
        if (!to) continue;

        const isFromCurrent = mapState.currentNodeId === node.id;
        const isTargetSelectable = selectableIds.has(targetId);
        const isVisitedEdge = node.visited && to.node.visited;

        let edgeClass = 'tree-edge';
        if (isFromCurrent && isTargetSelectable) {
          edgeClass += ' selectable-edge';
        } else if (isVisitedEdge) {
          edgeClass += ' visited-edge';
        }

        svgLines += `<line class="${edgeClass}" x1="${from.xPct}%" y1="${from.yPx}" x2="${to.xPct}%" y2="${to.yPx}" />`;
      }
    }
  }
  mapTreeSvg.innerHTML = svgLines;

  // 2. Render Floor Markers & Branching Room Nodes
  mapNodesContainer.innerHTML = '';
  for (const row of mapState.rows || []) {
    if (!row[0]) continue;
    const floorNum = row[0].floor;
    const yPx = Math.round(topPad + (floorNum - 1) * rowStep);

    const floorMarker = document.createElement('div');
    floorMarker.className = 'map-floor-marker';
    floorMarker.style.top = `${yPx}px`;
    floorMarker.textContent = `F${floorNum}`;
    mapNodesContainer.appendChild(floorMarker);

    for (const node of row) {
      const meta = MAP_ROOM_TYPES[node.roomType] || MAP_ROOM_TYPES.combat;
      const isSelectable = selectableIds.has(node.id);
      const isCurrent = mapState.currentNodeId === node.id;

      const btn = document.createElement('button');
      btn.className = [
        'map-tree-node',
        meta.cssClass,
        node.visited ? 'visited' : '',
        isCurrent ? 'current-node' : '',
        isSelectable ? 'selectable' : ''
      ].filter(Boolean).join(' ');

      btn.style.left = `${node.xPct || 50}%`;
      btn.style.top = `${yPx}px`;
      btn.textContent = node.label;
      btn.title = meta.description;

      if (isSelectable) {
        btn.addEventListener('click', () => chooseMapNode(node.id));
      }
      mapNodesContainer.appendChild(btn);
    }
  }

  // Auto-scroll viewport to center on the next selectable floor
  if (mapScrollViewport) {
    const targetY = Math.max(0, topPad + (nextFloor - 2) * rowStep - 80);
    setTimeout(() => {
      mapScrollViewport.scrollTop = targetY;
    }, 20);
  }
}

// 9. Render State to DOM
function renderState(state, prevState = null) {
  if (bootRelicModal) bootRelicModal.classList.add('hidden');
  if (mapModal) mapModal.classList.add('hidden');
  if (rewardModal) rewardModal.classList.add('hidden');

  if (state.phase === 'lobby') {
    floorBadge.textContent = 'LOBBY READY';
    combatFeed.innerHTML = '<p>[SYSTEM] Connected. Tap START MISSION when all players join.</p>';
    btnEndTurn.textContent = 'START MISSION';
    btnEndTurn.onclick = startGame;
    return;
  }

  btnEndTurn.textContent = 'END TURN';
  btnEndTurn.onclick = endTurn;
  floorBadge.textContent = `FLOOR ${state.floor || 1}`;

  const me = state.players?.[myPlayerId];

  // Ensure `selectedTargetIdx` points to a living enemy
  const enemies = state.enemies || [];
  if (!enemies[selectedTargetIdx] || enemies[selectedTargetIdx].hp <= 0) {
    const firstAliveIdx = enemies.findIndex(e => e.hp > 0);
    selectedTargetIdx = firstAliveIdx !== -1 ? firstAliveIdx : 0;
  }
  const activeTargetEnemy = enemies[selectedTargetIdx] || enemies[0];

  // Render Teammates
  teammatesBar.innerHTML = '';
  for (const [id, p] of Object.entries(state.players || {})) {
    if (id === myPlayerId) continue;
    const tag = document.createElement('div');
    tag.className = `teammate-chip ${p.isAlive ? '' : 'dead'}`;
    tag.textContent = `${p.name} [${p.hp}/${p.maxHp}] ${p.shield > 0 ? '🛡️' + p.shield : ''}`;
    teammatesBar.appendChild(tag);
  }

  // Render Player Relics Bar
  if (relicsBar && me) {
    relicsBar.innerHTML = '';
    for (const relicState of me.relics || []) {
      const rDef = RELIC_REGISTRY[relicState.id];
      if (!rDef) continue;
      const chip = document.createElement('div');
      chip.className = 'relic-chip';
      const cntText = relicState.counter > 0 ? `<span class="relic-cnt">[${relicState.counter}]</span>` : '';
      chip.innerHTML = `❖ ${rDef.name}${cntText}`;
      chip.title = rDef.description;
      chip.addEventListener('click', () => {
        const feedItem = document.createElement('p');
        feedItem.textContent = `[RELIC] ${rDef.name}: ${rDef.description}`;
        combatFeed.appendChild(feedItem);
        combatFeed.scrollTop = combatFeed.scrollHeight;
      });
      relicsBar.appendChild(chip);
    }
  }

  // Render 3 Potion Slots
  if (potionsBar && me) {
    potionsBar.innerHTML = '';
    const slots = Array.isArray(me.potions) ? me.potions : [null, null, null];
    for (let i = 0; i < 3; i++) {
      const pid = slots[i];
      const pDef = pid ? POTION_REGISTRY[pid] : null;
      const slotEl = document.createElement('div');
      if (pDef) {
        slotEl.className = 'potion-slot filled';
        slotEl.title = `${pDef.name}: ${pDef.description} (Tap to use, × to discard)`;
        slotEl.innerHTML = `
          <span>${pDef.icon || '🧪'} ${pDef.name.split(' ')[0]}</span>
          <span class="potion-dump" title="Discard Potion">×</span>
        `;
        slotEl.addEventListener('click', () => usePotionSlot(i));
        const dumpBtn = slotEl.querySelector('.potion-dump');
        if (dumpBtn) {
          dumpBtn.addEventListener('click', (ev) => dumpPotionSlot(i, ev));
        }
      } else {
        slotEl.className = 'potion-slot';
        slotEl.textContent = `[SLOT ${i + 1}]`;
      }
      potionsBar.appendChild(slotEl);
    }
  }

  // Render All Enemies in Multi-Enemy Container
  if (enemyContainer) {
    enemyContainer.innerHTML = '';
    enemies.forEach((enemy, idx) => {
      const isTargeted = idx === selectedTargetIdx && enemy.hp > 0;
      const isDead = enemy.hp <= 0;
      const telegraph = formatTelegraphedIntent(enemy, me, state);

      const hpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
      const shieldPct = Math.min(100, ((enemy.shield || 0) / enemy.maxHp) * 100);

      const unitEl = document.createElement('div');
      unitEl.className = `enemy-unit ${isTargeted ? 'targeted' : ''} ${isDead ? 'dead' : ''}`.trim();

      unitEl.innerHTML = `
        <div class="intent-chip ${telegraph.category}">${telegraph.text}</div>
        <div class="enemy-card">
          <div class="enemy-info">
            <span class="entity-name">${isTargeted && enemies.length > 1 ? '🎯 ' : ''}${enemy.name}</span>
            ${isTargeted && enemies.length > 1 ? '<span class="target-badge">TARGET</span>' : ''}
            <div class="status-tags enemy-status-slot"></div>
          </div>
          <div class="meter-bar">
            <div class="meter-fill hp-color" style="width: ${hpPct}%;"></div>
            <div class="meter-fill shield-color" style="width: ${shieldPct}%;"></div>
            <span class="meter-label">${enemy.hp} / ${enemy.maxHp} ${enemy.shield > 0 ? `(+${enemy.shield} 🛡️)` : ''}</span>
          </div>
        </div>
      `;

      const statusSlot = unitEl.querySelector('.enemy-status-slot');
      if (statusSlot) {
        renderStatusBadges(statusSlot, enemy.statuses);
      }

      if (!isDead) {
        unitEl.addEventListener('click', () => {
          selectedTargetIdx = idx;
          renderState(currentGameState, null);
        });
      }

      enemyContainer.appendChild(unitEl);
    });
  }

  // Render Activity Ticker
  combatFeed.innerHTML = (state.combatLog || []).slice(-6).map(l => `<p>${l}</p>`).join('');
  combatFeed.scrollTop = combatFeed.scrollHeight;

  // Render My Vitals, Pile Counts & Hand
  if (me) {
    playerEnergy.textContent = me.energy.toString();
    if (playerMaxEnergy) {
      playerMaxEnergy.textContent = `/${me.maxEnergy || 3}`;
    }
    if (pileStats) {
      const dk = me.deck?.length || 0;
      const ds = me.discard?.length || 0;
      const ex = me.exhaust?.length || 0;
      const md = me.masterDeck?.length || 0;
      pileStats.textContent = `DK:${dk} · DS:${ds} · EX:${ex} · ALL:${md}`;
    }

    const myHpPct = Math.max(0, (me.hp / me.maxHp) * 100);
    const myShieldPct = Math.min(100, ((me.shield || 0) / me.maxHp) * 100);
    playerHpFill.style.width = `${myHpPct}%`;
    playerShieldFill.style.width = `${myShieldPct}%`;
    playerHpText.textContent = `${me.hp} / ${me.maxHp} ${me.shield > 0 ? `(+${me.shield} 🛡️)` : ''}`;

    renderStatusBadges(playerStatuses, me.statuses);
    btnEndTurn.style.opacity = me.isReady ? '0.5' : '1.0';

    const ctx = createBattleContext(state, me, activeTargetEnemy);

    cardCarousel.innerHTML = '';
    for (const card of me.hand || []) {
      const def = resolveCard(card);
      if (!def) continue;

      let descText = def.description;
      if (typeof def.dynamicDamage === 'function') {
        const base = def.dynamicDamage(me);
        const finalDmg = ctx.computeCardDamagePreview(me, activeTargetEnemy, base, def.strengthMultiplier || 1);
        descText = `${def.description} (${finalDmg} dmg)`;
      } else if (def.baseDamage !== undefined) {
        const finalDmg = ctx.computeCardDamagePreview(me, activeTargetEnemy, def.baseDamage, def.strengthMultiplier || 1);
        if (finalDmg !== def.baseDamage) {
          descText = def.description.replace(`${def.baseDamage} damage`, `${finalDmg} damage`);
        }
      }
      if (def.baseShield !== undefined) {
        const finalBlk = ctx.computeCardBlockPreview(me, def.baseShield);
        if (finalBlk !== def.baseShield) {
          descText = descText.replace(`${def.baseShield} Shield`, `${finalBlk} Shield`);
        }
      }

      const cardEl = document.createElement('div');
      const disabledClass = me.energy < def.cost || me.isReady ? 'disabled' : '';
      const exhaustClass = def.exhaust ? 'exhaust-card' : '';
      const upgradedClass = def.upgraded ? 'upgraded-card' : '';
      cardEl.className = `card-item ${disabledClass} ${exhaustClass} ${upgradedClass}`.trim();
      cardEl.innerHTML = `
        <div class="card-top">
          <span class="card-cost">${def.cost}</span>
          <span class="card-type">${def.type.toUpperCase()}</span>
        </div>
        <div class="card-title">${def.name}</div>
        <div class="card-desc">${descText}</div>
        ${def.exhaust ? '<div class="card-footer-tag">EXHAUST</div>' : ''}
      `;
      cardEl.addEventListener('click', () => castCard(card));
      cardCarousel.appendChild(cardEl);
    }

    // Trigger Reactive Combat Animations on State Transitions
    if (prevState) {
      triggerCombatAnimations(prevState, state);
    }

    // ------------------------------------------------------------------------
    // OVERLAY 1: Beginning-of-Run Powerful Relic Choice (`boot_relic`)
    // ------------------------------------------------------------------------
    if (state.phase === 'boot_relic' && me.starterRelicChoices && me.starterRelicChoices.length > 0) {
      bootRelicModal.classList.remove('hidden');
      bootRelicChoices.innerHTML = '';
      for (const rId of me.starterRelicChoices) {
        const rDef = RELIC_REGISTRY[rId];
        if (!rDef) continue;
        const opt = document.createElement('div');
        opt.className = 'reward-option relic-opt';
        opt.innerHTML = `
          <div class="reward-opt-top">
            <span>❖ ${rDef.name}</span>
            <span>STARTER CORE RELIC</span>
          </div>
          <div class="reward-opt-desc">${rDef.description}</div>
        `;
        opt.addEventListener('click', () => chooseBootRelic(rId));
        bootRelicChoices.appendChild(opt);
      }
      return;
    }

    // ------------------------------------------------------------------------
    // OVERLAY 2: Visual Branching Tree Map (`map`)
    // ------------------------------------------------------------------------
    if (state.phase === 'map' && state.map) {
      mapModal.classList.remove('hidden');
      renderBranchingTreeMap(state.map);
      return;
    }

    // ------------------------------------------------------------------------
    // OVERLAY 3: Post-Encounter Loot & Forge Screen (`loot`)
    // ------------------------------------------------------------------------
    if (state.phase === 'loot' && me.pendingLoot && Array.isArray(me.pendingLoot.items)) {
      rewardModal.classList.remove('hidden');
      const items = me.pendingLoot.items;
      const hasMandatoryRemaining = items.some(it => it.mandatory);

      if (rewardModalTitle) {
        rewardModalTitle.textContent = me.pendingLoot.mandatoryRoom
          ? '⚠️ ANOMALY CONTAINMENT // MANDATORY LOOT'
          : 'ROOM CLEARED // LOOT & UPGRADES';
      }
      if (rewardModalSub) {
        rewardModalSub.textContent = hasMandatoryRemaining
          ? 'MANDATORY ROOM: You must claim all mandatory items before continuing to the map!'
          : 'Pick up any desired rewards below, or tap CONTINUE TO MAP to skip remaining items:';
      }

      if (btnSkipReward) {
        if (hasMandatoryRemaining) {
          btnSkipReward.textContent = 'LOCKED (CLAIM MANDATORY)';
          btnSkipReward.classList.add('locked');
        } else {
          btnSkipReward.textContent = items.length > 0 ? 'SKIP & CONTINUE TO MAP' : 'CONTINUE TO MAP';
          btnSkipReward.classList.remove('locked');
        }
      }

      rewardChoices.innerHTML = '';

      for (const item of items) {
        const group = document.createElement('div');
        group.className = `loot-group ${item.mandatory ? 'mandatory-loot' : ''}`;

        const header = document.createElement('div');
        header.className = 'loot-group-header';
        header.innerHTML = `
          <span>${item.type.toUpperCase().replace('_', ' ')}</span>
          ${item.mandatory ? '<span class="mandatory-tag">[MANDATORY PICKUP]</span>' : '<span>[OPTIONAL]</span>'}
        `;
        group.appendChild(header);

        if (item.type === 'card_draft') {
          for (const cObj of item.cards || []) {
            const cDef = resolveCard(cObj);
            if (!cDef) continue;
            const opt = document.createElement('div');
            opt.className = `reward-option ${cDef.upgraded ? 'upgrade-opt' : ''}`;
            opt.innerHTML = `
              <div class="reward-opt-top">
                <span>+ CARD: ${cDef.name}</span>
                <span>COST ${cDef.cost} · ${cDef.type.toUpperCase()}</span>
              </div>
              <div class="reward-opt-desc">${cDef.description}</div>
            `;
            opt.addEventListener('click', () => claimLoot(item.id, { defId: cObj.defId }));
            group.appendChild(opt);
          }
        } else if (item.type === 'relic') {
          const rDef = RELIC_REGISTRY[item.relicId];
          if (rDef) {
            const opt = document.createElement('div');
            opt.className = 'reward-option relic-opt';
            opt.innerHTML = `
              <div class="reward-opt-top">
                <span>❖ RELIC: ${rDef.name}</span>
                <span>TAKE RELIC</span>
              </div>
              <div class="reward-opt-desc">${rDef.description}</div>
            `;
            opt.addEventListener('click', () => claimLoot(item.id));
            group.appendChild(opt);
          }
        } else if (item.type === 'potion') {
          const pDef = POTION_REGISTRY[item.potionId];
          if (pDef) {
            const opt = document.createElement('div');
            opt.className = 'reward-option potion-opt';
            opt.innerHTML = `
              <div class="reward-opt-top">
                <span>${pDef.icon || '🧪'} POTION: ${pDef.name}</span>
                <span>STORE IN SLOT</span>
              </div>
              <div class="reward-opt-desc">${pDef.description}</div>
            `;
            opt.addEventListener('click', () => claimLoot(item.id));
            group.appendChild(opt);
          }
        } else if (item.type === 'upgrade_token') {
          const unupgraded = (me.masterDeck || []).filter(c => !c.upgraded);
          for (const deckCard of unupgraded.slice(0, 6)) {
            const baseDef = resolveCard(deckCard, false);
            const upgDef = resolveCard(deckCard, true);
            if (!baseDef || !upgDef) continue;
            const opt = document.createElement('div');
            opt.className = 'reward-option upgrade-opt';
            opt.innerHTML = `
              <div class="reward-opt-top">
                <span>🔨 UPGRADE: ${baseDef.name} ➔ ${upgDef.name}</span>
                <span>COST ${baseDef.cost}➔${upgDef.cost}</span>
              </div>
              <div class="reward-opt-desc">${upgDef.description}</div>
            `;
            opt.addEventListener('click', () => claimLoot(item.id, { instanceId: deckCard.instanceId }));
            group.appendChild(opt);
          }
        }

        rewardChoices.appendChild(group);
      }
    }
  }
}
