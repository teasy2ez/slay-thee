// ============================================================================
// MAP.JS — Branching Procedural Sector Map & Room Type Definitions
// ============================================================================

export const MAP_ROOM_TYPES = {
  combat: {
    id: 'combat',
    name: 'COMBAT SECTOR',
    shortLabel: '⚔️ COMBAT',
    cssClass: 'node-combat',
    mandatoryLoot: false,
    description: 'Standard hostile unit. Drops Card & Potion loot.'
  },
  elite: {
    id: 'elite',
    name: 'ELITE GUARDIAN',
    shortLabel: '💀 ELITE',
    cssClass: 'node-elite',
    mandatoryLoot: false,
    description: 'Reinforced Elite enemy (+30% HP, +1 STR). Drops Relic + Rare Card + Potion.'
  },
  anomaly: {
    id: 'anomaly',
    name: 'ANOMALY VAULT',
    shortLabel: '⚠️ ANOMALY [MANDATORY LOOT]',
    cssClass: 'node-anomaly',
    mandatoryLoot: true,
    description: 'Unstable Containment Room: High-tier Relic + Upgraded Card, but ALL LOOT IS MANDATORY PICKUP.'
  },
  upgrade: {
    id: 'upgrade',
    name: 'FORGE // REST',
    shortLabel: '🔧 FORGE / REST',
    cssClass: 'node-upgrade',
    mandatoryLoot: false,
    description: 'Safe terminal: Upgrade any card in your deck (+) and heal 25% Max HP.'
  },
  treasure: {
    id: 'treasure',
    name: 'SUPPLY CACHE',
    shortLabel: '📦 VAULT',
    cssClass: 'node-treasure',
    mandatoryLoot: false,
    description: 'Encrypted cache containing a Relic, Potion, and Card Upgrade.'
  },
  boss: {
    id: 'boss',
    name: 'OVERLORD CORE',
    shortLabel: '👑 BOSS CORE',
    cssClass: 'node-boss',
    mandatoryLoot: false,
    description: 'Sector Boss encounter. Clearing advances the sector and drops Boss Relic + Upgraded Cards.'
  }
};

function pickRoomTypeForRow(floor, colIdx) {
  if (floor === 1) return 'combat';
  if (floor === 6 || floor === 12) return 'boss';
  if (floor === 5 || floor === 11) return 'upgrade';
  if (floor === 3 || floor === 8) {
    return colIdx === 1 ? 'treasure' : (colIdx === 0 ? 'anomaly' : 'combat');
  }

  const roll = Math.random();
  if (roll < 0.38) return 'combat';
  if (roll < 0.56) return 'elite';
  if (roll < 0.74) return 'anomaly'; // Special Mandatory Loot Room
  if (roll < 0.90) return 'upgrade';
  return 'treasure';
}

/**
 * Generates a 12-floor branching sector map (100% JSON-serializable).
 */
export function generateSectorMap(totalFloors = 12) {
  const rows = [];

  for (let floor = 1; floor <= totalFloors; floor++) {
    const isBoss = floor === 6 || floor === totalFloors;
    const nodeCount = isBoss ? 1 : (floor === 1 ? 3 : (floor % 2 === 0 ? 3 : 2));
    const rowNodes = [];

    for (let col = 0; col < nodeCount; col++) {
      const roomType = pickRoomTypeForRow(floor, col);
      const meta = MAP_ROOM_TYPES[roomType];
      rowNodes.push({
        id: `F${floor}_N${col}`,
        floor,
        col,
        roomType,
        label: meta.shortLabel,
        mandatoryLoot: Boolean(meta.mandatoryLoot),
        visited: false,
        nextIds: []
      });
    }
    rows.push(rowNodes);
  }

  // Connect forward edges between floor `r` and floor `r + 1` so every node has a valid forward path
  for (let r = 0; r < rows.length - 1; r++) {
    const currentRow = rows[r];
    const nextRow = rows[r + 1];

    for (let i = 0; i < currentRow.length; i++) {
      const node = currentRow[i];
      if (nextRow.length === 1) {
        node.nextIds.push(nextRow[0].id);
      } else {
        // Connect to proportional index and adjacent index for branching choices
        const primaryIdx = Math.min(nextRow.length - 1, Math.floor((i / currentRow.length) * nextRow.length));
        const secondaryIdx = Math.min(nextRow.length - 1, primaryIdx + 1);
        node.nextIds.push(nextRow[primaryIdx].id);
        if (secondaryIdx !== primaryIdx && !node.nextIds.includes(nextRow[secondaryIdx].id)) {
          node.nextIds.push(nextRow[secondaryIdx].id);
        }
      }
    }

    // Ensure every node in `nextRow` has at least one incoming parent edge
    for (let j = 0; j < nextRow.length; j++) {
      const targetId = nextRow[j].id;
      const hasParent = currentRow.some(n => n.nextIds.includes(targetId));
      if (!hasParent) {
        const parentNode = currentRow[Math.min(currentRow.length - 1, j)];
        parentNode.nextIds.push(targetId);
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
    // Floor 1 nodes are all selectable at the start
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
  // If we finished floor 12, loop to a fresh sector map
  return [];
}
