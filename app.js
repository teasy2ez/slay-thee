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
  CARD_REGISTRY,
  RELIC_REGISTRY,
  STATUS_REGISTRY,
  createInitialPlayer,
  startFloorCombat,
  playCardTransaction,
  endTurnTransaction,
  claimPlayerReward,
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

// Initialize Firebase & Analytics safely
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

const enemyName = document.getElementById('enemy-name');
const enemyIntent = document.getElementById('enemy-intent');
const enemyHpFill = document.getElementById('enemy-hp-fill');
const enemyShieldFill = document.getElementById('enemy-shield-fill');
const enemyHpText = document.getElementById('enemy-hp-text');
const enemyStatuses = document.getElementById('enemy-statuses');

const combatFeed = document.getElementById('combat-feed');

const playerEnergy = document.getElementById('player-energy');
const playerMaxEnergy = document.getElementById('player-max-energy');
const pileStats = document.getElementById('pile-stats');
const playerHpFill = document.getElementById('player-hp-fill');
const playerShieldFill = document.getElementById('player-shield-fill');
const playerHpText = document.getElementById('player-hp-text');
const playerStatuses = document.getElementById('player-statuses');
const cardCarousel = document.getElementById('card-carousel');

const rewardModal = document.getElementById('reward-modal');
const rewardChoices = document.getElementById('reward-choices');
const btnSkipReward = document.getElementById('btn-skip-reward');

/**
 * Unified state mutation wrapper:
 * Executes a Firestore transaction in multiplayer mode, or mutates local state directly in solo mode.
 * Strips any `undefined` properties via JSON serialization so Firestore `tx.set` never fails.
 */
async function mutateGameState(mutatorFn) {
  if (isLocalSoloMode) {
    if (!currentGameState) return;
    const nextState = JSON.parse(JSON.stringify(currentGameState));
    const changed = mutatorFn(nextState);
    if (changed !== false) {
      currentGameState = JSON.parse(JSON.stringify(nextState));
      renderState(currentGameState);
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
        currentGameState = docSnapshot.data();
        renderState(currentGameState);
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
    phase: 'combat',
    players: { [myPlayerId]: starterPlayer },
    enemies: [],
    combatLog: [`[SYSTEM] Solo mission initialized for ${name}.`]
  };

  startFloorCombat(currentGameState, true);
  currentGameState = JSON.parse(JSON.stringify(currentGameState));

  roomBadge.textContent = 'MODE: SOLO';
  lobbyScreen.classList.add('hidden');
  combatScreen.classList.remove('hidden');
  renderState(currentGameState);
}

if (btnSolo) {
  btnSolo.addEventListener('click', startSoloMission);
}

// 2. Launch Combat Phase (from Lobby)
async function startGame() {
  await mutateGameState((data) => {
    startFloorCombat(data, true);
  });
}

// 3. Play a Card from Hand
async function castCard(card) {
  if (!currentGameState || currentGameState.phase !== 'combat') return;
  await mutateGameState((data) => {
    return playCardTransaction(data, myPlayerId, card.instanceId, 0);
  });
}

// 4. End Player Turn and Resolve Round
async function endTurn() {
  if (!currentGameState || currentGameState.phase !== 'combat') return;
  await mutateGameState((data) => {
    return endTurnTransaction(data, myPlayerId);
  });
}

// 5. Claim or Skip Post-Combat Draft Reward
async function selectReward(rewardType, itemId) {
  await mutateGameState((data) => {
    return claimPlayerReward(data, myPlayerId, rewardType, itemId);
  });
}

if (btnSkipReward) {
  btnSkipReward.addEventListener('click', () => selectReward('skip', null));
}

// Helper to render status tags for any entity
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

// 6. Render Everything to DOM
function renderState(state) {
  if (state.phase === 'lobby') {
    floorBadge.textContent = 'LOBBY READY';
    combatFeed.innerHTML = '<p>[SYSTEM] Connected. Tap START MISSION when all players join.</p>';
    btnEndTurn.textContent = 'START MISSION';
    btnEndTurn.onclick = startGame;
    return;
  }

  btnEndTurn.textContent = 'END TURN';
  btnEndTurn.onclick = endTurn;
  floorBadge.textContent = `FLOOR ${state.floor}`;

  const me = state.players?.[myPlayerId];

  // Render Party Members
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

  // Render Enemy & Telegraphed AI Intent
  const enemy = state.enemies?.[0];
  if (enemy) {
    enemyName.textContent = enemy.name;
    const hpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
    const shieldPct = Math.min(100, (enemy.shield / enemy.maxHp) * 100);
    enemyHpFill.style.width = `${hpPct}%`;
    enemyShieldFill.style.width = `${shieldPct}%`;
    enemyHpText.textContent = `${enemy.hp} / ${enemy.maxHp} ${enemy.shield > 0 ? `(+${enemy.shield})` : ''}`;

    const telegraph = formatTelegraphedIntent(enemy, me, state);
    enemyIntent.textContent = telegraph.text;
    enemyIntent.className = `intent-chip ${telegraph.category}`;

    renderStatusBadges(enemyStatuses, enemy.statuses);
  }

  // Render Activity Ticker
  combatFeed.innerHTML = (state.combatLog || []).slice(-6).map(l => `<p>${l}</p>`).join('');
  combatFeed.scrollTop = combatFeed.scrollHeight;

  // Render My Vitals, Pile Counts, Hand & Pending Rewards
  if (me) {
    playerEnergy.textContent = me.energy.toString();
    if (playerMaxEnergy) {
      playerMaxEnergy.textContent = `/${me.maxEnergy || 3}`;
    }
    if (pileStats) {
      const dk = me.deck?.length || 0;
      const ds = me.discard?.length || 0;
      const ex = me.exhaust?.length || 0;
      pileStats.textContent = `DK:${dk} · DS:${ds} · EX:${ex}`;
    }

    const myHpPct = Math.max(0, (me.hp / me.maxHp) * 100);
    const myShieldPct = Math.min(100, (me.shield / me.maxHp) * 100);
    playerHpFill.style.width = `${myHpPct}%`;
    playerShieldFill.style.width = `${myShieldPct}%`;
    playerHpText.textContent = `${me.hp} / ${me.maxHp} ${me.shield > 0 ? `(+${me.shield})` : ''}`;

    renderStatusBadges(playerStatuses, me.statuses);

    btnEndTurn.style.opacity = me.isReady ? '0.5' : '1.0';

    // Battle context for dynamic card preview numbers
    const ctx = createBattleContext(state, me, enemy);

    cardCarousel.innerHTML = '';
    for (const card of me.hand || []) {
      const def = CARD_REGISTRY[card.defId];
      if (!def) continue;

      // Compute dynamic damage/block preview through the modifier hook pipeline
      let descText = def.description;
      if (typeof def.dynamicDamage === 'function') {
        const base = def.dynamicDamage(me);
        const finalDmg = ctx.computeCardDamagePreview(me, enemy, base, def.strengthMultiplier || 1);
        descText = `${def.description} (${finalDmg} dmg)`;
      } else if (def.baseDamage !== undefined) {
        const finalDmg = ctx.computeCardDamagePreview(me, enemy, def.baseDamage, def.strengthMultiplier || 1);
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
      cardEl.className = `card-item ${disabledClass} ${exhaustClass}`.trim();
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

    // Render Post-Floor Reward Overlay if pending
    if (rewardModal && rewardChoices) {
      if (me.pendingReward) {
        rewardModal.classList.remove('hidden');
        rewardChoices.innerHTML = '';

        // Card options
        for (const cardId of me.pendingReward.cards || []) {
          const cDef = CARD_REGISTRY[cardId];
          if (!cDef) continue;
          const opt = document.createElement('div');
          opt.className = 'reward-option';
          opt.innerHTML = `
            <div class="reward-opt-top">
              <span>+ CARD: ${cDef.name}</span>
              <span>COST ${cDef.cost} · ${cDef.type.toUpperCase()}</span>
            </div>
            <div class="reward-opt-desc">${cDef.description}</div>
          `;
          opt.addEventListener('click', () => selectReward('card', cardId));
          rewardChoices.appendChild(opt);
        }

        // Relic option
        if (me.pendingReward.relic && RELIC_REGISTRY[me.pendingReward.relic]) {
          const rDef = RELIC_REGISTRY[me.pendingReward.relic];
          const opt = document.createElement('div');
          opt.className = 'reward-option relic-opt';
          opt.innerHTML = `
            <div class="reward-opt-top">
              <span>❖ RELIC: ${rDef.name}</span>
              <span>PASSIVE HOOK</span>
            </div>
            <div class="reward-opt-desc">${rDef.description}</div>
          `;
          opt.addEventListener('click', () => selectReward('relic', rDef.id));
          rewardChoices.appendChild(opt);
        }
      } else {
        rewardModal.classList.add('hidden');
      }
    }
  }
}
