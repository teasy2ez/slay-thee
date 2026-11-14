// ============================================================================
// MAP.JS — Branching Procedural Tree Map & Room Type Definitions
// ============================================================================

export const MAP_ROOM_TYPES = {
  combat: {
    id: 'combat',
    name: 'SKIRMISH GROUNDS',
    icon: '⚔️',
    shortLabel: '⚔️ SKIRMISH',
    cssClass: 'node-combat',
    mandatoryLoot: false,
    description: 'Hostile warband (1-3 foes). Drops Gold, Tome Draft & Potion loot.'
  },
  elite: {
    id: 'elite',
    name: 'CHAMPION LAIR',
    icon: '💀',
    shortLabel: '💀 CHAMPION',
    cssClass: 'node-elite',
    mandatoryLoot: false,
    description: 'Deadly Champion encounter. Drops Artifact Relic + High Gold + Upgraded Tome + Potion.'
  },
  event: {
    id: 'event',
    name: 'ANCIENT ENCOUNTER',
    icon: '❓',
    shortLabel: '❓ ENCOUNTER',
    cssClass: 'node-event',
    mandatoryLoot: false,
    description: 'Interactive Realm Encounter: Moonwells, goblin dice, shrines, and ancient bargains.'
  },
  shop: {
    id: 'shop',
    name: 'GOBLIN MERCHANT',
    icon: '🪙',
    shortLabel: '🪙 MERCHANT',
    cssClass: 'node-shop',
    mandatoryLoot: false,
    description: 'Spend Gold (G) on Relics, Upgraded Spells, Elixirs, or Scroll Banishment (Purge).'
  },
  anomaly: {
    id: 'anomaly',
    name: 'NETHER RIFT',
    icon: '🔮',
    shortLabel: '🔮 RIFT',
    cssClass: 'node-anomaly',
    mandatoryLoot: true,
    description: 'Unstable Arcane Rift: High-tier Artifact + Upgraded Tome, ALL LOOT IS MANDATORY PICKUP.'
  },
  upgrade: {
    id: 'upgrade',
    name: 'CAMPFIRE // ANVIL',
    icon: '🔥',
    shortLabel: '🔥 CAMPFIRE',
    cssClass: 'node-upgrade',
    mandatoryLoot: false,
    description: 'Safe haven: Forge/Upgrade any card in your grimoire (+) and heal 25% Max HP.'
  },
  treasure: {
    id: 'treasure',
    name: 'ROYAL CHEST',
    icon: '👑',
    shortLabel: '👑 TREASURE',
    cssClass: 'node-treasure',
    mandatoryLoot: false,
    description: 'Ancient treasury containing a Relic, Elixir, Gold, and Tome Upgrade.'
  },
  boss: {
    id: 'boss',
    name: 'CITADEL BOSS',
    icon: '🐉',
    shortLabel: '🐉 BOSS',
    cssClass: 'node-boss',
    mandatoryLoot: false,
    description: 'Realm Boss encounter. Clearing advances the Realm (or Endless Mode) and drops Boss Relic + Upgraded Spells.'
  }
};

function pickRoomTypeForRow(floor, colIdx, mutators = []) {
  const hasEliteSwarm = Array.isArray(mutators) && mutators.includes('elite_bounty');
  if (floor === 1) return 'combat';
  if (floor === 6 || floor === 12) return 'boss';
  if (floor === 5 || floor === 11) {
    return colIdx === 0 ? 'upgrade' : (colIdx === 1 ? 'shop' : 'upgrade');
  }
  if (floor === 3 || floor === 8) {
    return colIdx === 1 ? 'treasure' : (colIdx === 0 ? 'shop' : 'event');
  }

  const roll = Math.random();
  if (hasEliteSwarm) {
    if (roll < 0.25) return 'combat';
    if (roll < 0.55) return 'elite';
    if (roll < 0.72) return 'anomaly';
    if (roll < 0.86) return 'event';
    return 'shop';
  }

  if (roll < 0.34) return 'combat';
  if (roll < 0.50) return 'event';
  if (roll < 0.65) return 'elite';
  if (roll < 0.78) return 'shop';
  if (roll < 0.90) return 'anomaly';
  return 'upgrade';
}

function computeNodeXPct(col, nodeCount) {
  if (nodeCount === 1) return 50;
  if (nodeCount === 2) return col === 0 ? 30 : 70;
  if (nodeCount === 3) return col === 0 ? 18 : (col === 1 ? 50 : 82);
  const step = 76 / Math.max(1, nodeCount - 1);
  return Math.round(12 + col * step);
}

/**
 * Generates a 12-floor branching tree map with explicit `xPct` coordinates and parent->child `nextIds`.
 */
export function generateSectorMap(totalFloors = 12, mutators = []) {
  const rows = [];

  for (let floor = 1; floor <= totalFloors; floor++) {
    const isBoss = floor === 6 || floor === totalFloors;
    const nodeCount = isBoss ? 1 : (floor === 1 ? 3 : (floor % 2 === 0 ? 2 : 3));
    const rowNodes = [];

    for (let col = 0; col < nodeCount; col++) {
      const roomType = pickRoomTypeForRow(floor, col, mutators);
      const meta = MAP_ROOM_TYPES[roomType];
      rowNodes.push({
        id: `F${floor}_N${col}`,
        floor,
        col,
        xPct: computeNodeXPct(col, nodeCount),
        roomType,
        icon: meta.icon,
        label: meta.shortLabel,
        mandatoryLoot: Boolean(meta.mandatoryLoot),
        visited: false,
        nextIds: []
      });
    }
    rows.push(rowNodes);
  }

  for (let r = 0; r < rows.length - 1; r++) {
    const currentRow = rows[r];
    const nextRow = rows[r + 1];

    if (nextRow.length === 1) {
      for (const node of currentRow) {
        node.nextIds.push(nextRow[0].id);
      }
      continue;
    }

    if (currentRow.length === 1) {
      for (const target of nextRow) {
        currentRow[0].nextIds.push(target.id);
      }
      continue;
    }

    for (let i = 0; i < currentRow.length; i++) {
      const node = currentRow[i];
      const sortedByDist = [...nextRow].sort(
        (a, b) => Math.abs(a.xPct - node.xPct) - Math.abs(b.xPct - node.xPct)
      );
      node.nextIds.push(sortedByDist[0].id);
      if (sortedByDist[1] && (Math.random() < 0.65 || currentRow.length < nextRow.length)) {
        node.nextIds.push(sortedByDist[1].id);
      }
    }

    for (const target of nextRow) {
      const hasParent = currentRow.some(n => n.nextIds.includes(target.id));
      if (!hasParent) {
        const closestParent = [...currentRow].sort(
          (a, b) => Math.abs(a.xPct - target.xPct) - Math.abs(b.xPct - target.xPct)
        )[0];
        closestParent.nextIds.push(target.id);
      }
    }
  }

  return {
    totalFloors,
    currentFloor: 0,
    currentNodeId: null,
    currentRoomType: 'combat',
    rows
  };
}

export function findMapNode(mapState, nodeId) {
  if (!mapState || !Array.isArray(mapState.rows)) return null;
  for (const row of mapState.rows) {
    for (const node of row) {
      if (node.id === nodeId) return node;
    }
  }
  return null;
}

export function getSelectableNodeIds(mapState) {
  if (!mapState || !Array.isArray(mapState.rows) || mapState.rows.length === 0) return [];
  if (!mapState.currentNodeId) {
    return mapState.rows[0].map(n => n.id);
  }
  const current = findMapNode(mapState, mapState.currentNodeId);
  if (!current) {
    const nextFloorIdx = Math.min(mapState.rows.length - 1, mapState.currentFloor || 0);
    return mapState.rows[nextFloorIdx].map(n => n.id);
  }
  if (current.nextIds && current.nextIds.length > 0) {
    return current.nextIds;
  }
  return [];
}
