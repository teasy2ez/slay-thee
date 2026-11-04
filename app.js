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

// Import game logic from your local engine.js
import { 
  CARD_CATALOG, 
  calculateDamage, 
  applyDamageToEntity, 
  createStarterDeck, 
  drawCards 
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

// Initialize Firebase & Analytics
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

// Local Player & Room Session State
let currentRoomId = '';
let myPlayerId = '';
let currentRoomDoc = null;
let currentGameState = null;

// UI Handles
const lobbyScreen = document.getElementById('lobby-screen');
const combatScreen = document.getElementById('combat-screen');
const nameInput = document.getElementById('player-name-input');
const roomInput = document.getElementById('room-code-input');
const btnJoin = document.getElementById('btn-join');
const btnEndTurn = document.getElementById('btn-end-turn');

const roomBadge = document.getElementById('room-badge');
const floorBadge = document.getElementById('floor-badge');
const teammatesBar = document.getElementById('teammates-bar');

const enemyName = document.getElementById('enemy-name');
const enemyIntent = document.getElementById('enemy-intent');
const enemyHpFill = document.getElementById('enemy-hp-fill');
const enemyShieldFill = document.getElementById('enemy-shield-fill');
const enemyHpText = document.getElementById('enemy-hp-text');
const enemyStatuses = document.getElementById('enemy-statuses');

const combatFeed = document.getElementById('combat-feed');

const playerEnergy = document.getElementById('player-energy');
const playerHpFill = document.getElementById('player-hp-fill');
const playerShieldFill = document.getElementById('player-shield-fill');
const playerHpText = document.getElementById('player-hp-text');
const playerStatuses = document.getElementById('player-statuses');
const cardCarousel = document.getElementById('card-carousel');

// Helper to construct clean player data
function createInitialPlayer(id, name) {
  const p = {
    id,
    name,
    hp: 50,
    maxHp: 50,
    shield: 0,
    energy: 3,
    maxEnergy: 3,
    statuses: { strength: 0, weak: 0, vulnerable: 0 },
    deck: createStarterDeck(),
    hand: [],
    discard: [],
    isReady: false,
    isAlive: true
  };
  drawCards(p, 5);
  return p;
}

// 1. Join or Create Room
btnJoin.addEventListener('click', async () => {
  const name = nameInput.value.trim() || 'OPERATIVE';
  const room = (roomInput.value.trim() || Math.random().toString(36).substring(2, 7)).toUpperCase();
  myPlayerId = 'P_' + Math.random().toString(36).substring(2, 7);
  currentRoomId = room;

  currentRoomDoc = doc(db, "rooms", room);

  try {
    const snap = await getDoc(currentRoomDoc);
    if (!snap.exists()) {
      // Room does not exist: create it with host player
      const starterPlayer = createInitialPlayer(myPlayerId, name);
      await setDoc(currentRoomDoc, {
        roomId: room,
        floor: 1,
        phase: 'lobby',
        players: { [myPlayerId]: starterPlayer },
        enemies: [],
        combatLog: [`[SYSTEM] Room ${room} created by ${name}.`]
      });
    } else {
      // Room exists: join existing party
      const starterPlayer = createInitialPlayer(myPlayerId, name);
      await updateDoc(currentRoomDoc, {
        [`players.${myPlayerId}`]: starterPlayer,
        combatLog: [...snap.data().combatLog, `[SYSTEM] ${name} joined party.`]
      });
    }

    roomBadge.textContent = `ROOM: ${room}`;
    lobbyScreen.classList.add('hidden');
    combatScreen.classList.remove('hidden');

    // Subscribe to real-time Firestore updates
    onSnapshot(currentRoomDoc, (docSnapshot) => {
      if (docSnapshot.exists()) {
        currentGameState = docSnapshot.data();
        renderState(currentGameState);
      }
    });
  } catch (error) {
    console.error("Firestore connection error:", error);
    alert("Could not connect to room. Make sure Firestore test mode rules are enabled.");
  }
});

// 2. Launch Combat Phase
async function startGame() {
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(currentRoomDoc);
    if (!snap.exists()) return;
    const data = snap.data();

    data.phase = 'combat';
    const pCount = Object.keys(data.players).length;
    const baseHp = 32 + (data.floor * 6) + (pCount - 1) * 20;

    data.enemies = [{
      id: 'enemy_1',
      name: `UNIT-${data.floor}A`,
      hp: baseHp,
      maxHp: baseHp,
      shield: 0,
      statuses: { strength: 0, weak: 0, vulnerable: 0 },
      intent: { type: 'attack', value: 7 }
    }];

    for (const pid in data.players) {
      data.players[pid].energy = 3;
      data.players[pid].shield = 0;
      data.players[pid].isReady = false;
      data.players[pid].hand = [];
      data.players[pid].discard = [];
      data.players[pid].deck = createStarterDeck();
      drawCards(data.players[pid], 5);
    }

    data.combatLog.push(`--- COMBAT INITIATED FLOOR ${data.floor} ---`);
    tx.set(currentRoomDoc, data);
  });
}

// 3. Play a Card from Hand
async function castCard(card) {
  if (!currentGameState || currentGameState.phase !== 'combat') return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(currentRoomDoc);
    const data = snap.data();
    const me = data.players[myPlayerId];
    if (!me || me.isReady || !me.isAlive) return;

    const cardIdx = me.hand.findIndex(c => c.instanceId === card.instanceId);
    if (cardIdx === -1) return;

    const def = CARD_CATALOG[card.defId];
    if (!def || me.energy < def.cost) return;

    // Deduct Energy and Discard
    me.energy -= def.cost;
    me.hand.splice(cardIdx, 1);
    me.discard.push(card);

    // Apply Shield
    if (def.baseShield) {
      me.shield += def.baseShield;
      data.combatLog.push(`[CARD] ${me.name} gained ${def.baseShield} Shield.`);
    }

    // Apply Damage
    if (def.baseDamage !== undefined) {
      const enemy = data.enemies[0];
      if (enemy && enemy.hp > 0) {
        const rawDmg = calculateDamage(def.baseDamage, me.statuses.strength, me.statuses.weak, enemy.statuses.vulnerable);
        const res = applyDamageToEntity(rawDmg, enemy.shield, enemy.hp);
        enemy.shield = res.finalShield;
        enemy.hp = res.finalHp;
        data.combatLog.push(`[CARD] ${me.name} hit ${enemy.name} for ${rawDmg} (Absorbed: ${res.shieldDamage}, HP: -${res.hpDamage}).`);
      }
    }

    // Apply Vulnerable
    if (def.applyVulnerable) {
      const enemy = data.enemies[0];
      if (enemy && enemy.hp > 0) {
        enemy.statuses.vulnerable += def.applyVulnerable;
        data.combatLog.push(`[CARD] ${me.name} applied ${def.applyVulnerable} Vulnerable.`);
      }
    }

    // Check Victory
    if (data.enemies.every(e => e.hp <= 0)) {
      data.floor++;
      data.combatLog.push(`[VICTORY] Floor cleared! Advancing to Floor ${data.floor}...`);
      
      const pCount = Object.keys(data.players).length;
      const nextHp = 32 + (data.floor * 6) + (pCount - 1) * 20;
      data.enemies = [{
        id: 'enemy_1',
        name: `UNIT-${data.floor}A`,
        hp: nextHp,
        maxHp: nextHp,
        shield: 0,
        statuses: { strength: 0, weak: 0, vulnerable: 0 },
        intent: { type: 'attack', value: 7 + data.floor }
      }];

      for (const pid in data.players) {
        data.players[pid].energy = 3;
        data.players[pid].shield = 0;
        data.players[pid].isReady = false;
        drawCards(data.players[pid], 3);
      }
    }

    tx.set(currentRoomDoc, data);
  });
}

// 4. End Player Turn and Resolve Round
async function endTurn() {
  if (!currentGameState || currentGameState.phase !== 'combat') return;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(currentRoomDoc);
    const data = snap.data();
    const me = data.players[myPlayerId];
    if (!me || me.isReady) return;

    me.isReady = true;
    data.combatLog.push(`[READY] ${me.name} ended turn.`);

    const allReady = Object.values(data.players).filter(p => p.isAlive).every(p => p.isReady);

    if (allReady) {
      // Enemy Phase
      for (const enemy of data.enemies) {
        if (enemy.hp <= 0) continue;
        const target = Object.values(data.players).find(p => p.isAlive);
        if (target && enemy.intent.type === 'attack') {
          const rawDmg = calculateDamage(enemy.intent.value, enemy.statuses.strength, enemy.statuses.weak, target.statuses.vulnerable);
          const res = applyDamageToEntity(rawDmg, target.shield, target.hp);
          target.shield = res.finalShield;
          target.hp = res.finalHp;
          data.combatLog.push(`[ACTION] ${enemy.name} attacked ${target.name} for ${rawDmg}.`);
          if (target.hp <= 0) target.isAlive = false;
        }
        if (enemy.statuses.weak > 0) enemy.statuses.weak--;
        if (enemy.statuses.vulnerable > 0) enemy.statuses.vulnerable--;
        enemy.intent = { type: 'attack', value: Math.floor(Math.random() * 4) + 6 };
      }

      // Reset Players for Next Round
      for (const pid in data.players) {
        const p = data.players[pid];
        if (!p.isAlive) continue;
        p.shield = 0;
        p.energy = p.maxEnergy;
        p.isReady = false;
        p.discard.push(...p.hand);
        p.hand = [];
        if (p.statuses.weak > 0) p.statuses.weak--;
        if (p.statuses.vulnerable > 0) p.statuses.vulnerable--;
        drawCards(p, 5);
      }
      data.combatLog.push('--- NEW ROUND ---');
    }

    tx.set(currentRoomDoc, data);
  });
}

// 5. Render Everything to DOM
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

  // Render Party Members
  teammatesBar.innerHTML = '';
  for (const [id, p] of Object.entries(state.players)) {
    if (id === myPlayerId) continue;
    const tag = document.createElement('div');
    tag.className = `teammate-chip ${p.isAlive ? '' : 'dead'}`;
    tag.textContent = `${p.name} [${p.hp}/${p.maxHp}] ${p.shield > 0 ? '🛡️' + p.shield : ''}`;
    teammatesBar.appendChild(tag);
  }

  // Render Enemy
  const enemy = state.enemies[0];
  if (enemy) {
    enemyName.textContent = enemy.name;
    const hpPct = Math.max(0, (enemy.hp / enemy.maxHp) * 100);
    const shieldPct = Math.min(100, (enemy.shield / enemy.maxHp) * 100);
    enemyHpFill.style.width = `${hpPct}%`;
    enemyShieldFill.style.width = `${shieldPct}%`;
    enemyHpText.textContent = `${enemy.hp} / ${enemy.maxHp} ${enemy.shield > 0 ? `(+${enemy.shield})` : ''}`;
    enemyIntent.textContent = `INTENT: ATTACK ${enemy.intent.value}`;

    enemyStatuses.innerHTML = '';
    if (enemy.statuses.vulnerable > 0) enemyStatuses.innerHTML += `<span class="tag vuln">VULN (${enemy.statuses.vulnerable})</span>`;
    if (enemy.statuses.weak > 0) enemyStatuses.innerHTML += `<span class="tag weak">WEAK (${enemy.statuses.weak})</span>`;
  }

  // Render Activity Ticker
  combatFeed.innerHTML = state.combatLog.slice(-5).map(l => `<p>${l}</p>`).join('');
  combatFeed.scrollTop = combatFeed.scrollHeight;

  // Render My Vitals & Hand
  const me = state.players[myPlayerId];
  if (me) {
    playerEnergy.textContent = me.energy.toString();
    const myHpPct = Math.max(0, (me.hp / me.maxHp) * 100);
    const myShieldPct = Math.min(100, (me.shield / me.maxHp) * 100);
    playerHpFill.style.width = `${myHpPct}%`;
    playerShieldFill.style.width = `${myShieldPct}%`;
    playerHpText.textContent = `${me.hp} / ${me.maxHp} ${me.shield > 0 ? `(+${me.shield})` : ''}`;

    playerStatuses.innerHTML = '';
    if (me.statuses.vulnerable > 0) playerStatuses.innerHTML += `<span class="tag vuln">VULN (${me.statuses.vulnerable})</span>`;
    if (me.statuses.weak > 0) playerStatuses.innerHTML += `<span class="tag weak">WEAK (${me.statuses.weak})</span>`;

    btnEndTurn.style.opacity = me.isReady ? '0.5' : '1.0';

    cardCarousel.innerHTML = '';
    for (const card of me.hand) {
      const def = CARD_CATALOG[card.defId];
      if (!def) continue;

      const cardEl = document.createElement('div');
      cardEl.className = `card-item ${me.energy < def.cost || me.isReady ? 'disabled' : ''}`;
      cardEl.innerHTML = `
        <div class="card-top">
          <span class="card-cost">${def.cost}</span>
          <span class="card-type">${def.type.toUpperCase()}</span>
        </div>
        <div class="card-title">${def.name}</div>
        <div class="card-desc">${def.description}</div>
      `;
      cardEl.addEventListener('click', () => castCard(card));
      cardCarousel.appendChild(cardEl);
    }
  }
}