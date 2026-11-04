export function calculateDamage(baseDamage, attackerStrength = 0, attackerWeak = 0, targetVulnerable = 0) {
  let dmg = baseDamage + attackerStrength;
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

export const CARD_CATALOG = {
  strike: {
    id: 'strike',
    name: 'STRIKE',
    cost: 1,
    type: 'attack',
    baseDamage: 6,
    description: 'Deal 6 damage.'
  },
  defend: {
    id: 'defend',
    name: 'DEFEND',
    cost: 1,
    type: 'skill',
    baseShield: 5,
    description: 'Gain 5 Shield.'
  },
  heavy_strike: {
    id: 'heavy_strike',
    name: 'HEAVY STRIKE',
    cost: 2,
    type: 'attack',
    baseDamage: 10,
    description: 'Deal 10 damage.'
  },
  inflict_vuln: {
    id: 'inflict_vuln',
    name: 'EXPOSE',
    cost: 1,
    type: 'skill',
    applyVulnerable: 2,
    description: 'Apply 2 Vulnerable.'
  }
};

export function createStarterDeck() {
  const cards = [];
  const add = (id, count) => {
    for (let i = 0; i < count; i++) {
      cards.push({
        instanceId: Math.random().toString(36).substring(2, 7),
        defId: id
      });
    }
  };
  add('strike', 4);
  add('defend', 4);
  add('heavy_strike', 1);
  add('inflict_vuln', 1);
  return cards;
}

export function drawCards(player, count) {
  for (let i = 0; i < count; i++) {
    if (player.deck.length === 0) {
      if (player.discard.length === 0) break;
      player.deck = [...player.discard].sort(() => Math.random() - 0.5);
      player.discard = [];
    }
    const drawn = player.deck.pop();
    if (drawn) player.hand.push(drawn);
  }
}