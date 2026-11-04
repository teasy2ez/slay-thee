// ============================================================================
// MAP.JS — Branching Procedural Tree Map & Room Type Definitions
// ============================================================================

export const MAP_ROOM_TYPES = {
  combat: {
    id: 'combat',
    name: 'COMBAT SECTOR',
    icon: '⚔️',
    shortLabel: '⚔️ COMBAT',
    cssClass: 'node-combat',
    mandatoryLoot: false,
    description: 'Hostile patrol (1-3 enemies). Drops Card & Potion loot (No Relics).'
  },
  elite: {
    id: 'elite',
    name: 'ELITE GUARDIAN',
    icon: '💀',
    shortLabel: '💀 ELITE',
    cssClass: 'node-elite',
    mandatoryLoot: false,
    description: 'High-danger Elite encounter. Drops Relic + Upgraded/Rare Card + Potion.'
  },
  anomaly: {
    id: 'anomaly',
    name: 'ANOMALY VAULT',
    icon: '⚠️',
    shortLabel: '⚠️ ANOMALY',
    cssClass: 'node-anomaly',
    mandatoryLoot: true,
    description: 'Unstable Containment Room: High-tier Relic + Upgraded Card, ALL LOOT IS MANDATORY PICKUP.'
  },
  upgrade: {
    id: 'upgrade',
    name: 'FORGE // REST',
    icon: '🔧',
    shortLabel: '🔧 FORGE',
    cssClass: 'node-upgrade',
    mandatoryLoot: false,
    description: 'Safe terminal: Upgrade any card in your deck (+) and heal 25% Max HP.'
  },
  treasure: {
    id: 'treasure',
    name: 'SUPPLY VAULT',
    icon: '📦',
    shortLabel: '📦 VAULT',
    cssClass: 'node-treasure',
    mandatoryLoot: false,
    description: 'Encrypted cache containing a Relic, Potion, and Card Upgrade.'
  },
  boss: {
    id: 'boss',
    name: 'OVERLORD CORE',
    icon: '👑',
    shortLabel: '👑 BOSS',
    cssClass: 'node-boss',
    mandatoryLoot: false,
    description: 'Sector Boss encounter. Clearing advances the sector and drops Boss Relic + Upgraded Cards.'
  }
};

function pickRoomTypeForRow(floor, colIdx) {
  if (floor === 1) return 'combat';
  if (floor === 6 || floor === 12) return 'boss';
  if (floor === 5 || floor === 11) return colIdx === 0 ? 'upgrade' : (colIdx === 1 ? 'combat' : 'upgrade');
  if (floor === 3 || floor === 8) {
    return colIdx === 1 ? 'treasure' : (colIdx === 0 ? 'anomaly' : 'elite');
  }

  const roll = Math.random();
  if (roll < 0.44) return 'combat';
  if (roll < 0.64) return 'elite';
  if (roll < 0.80) return 'anomaly';
  if (roll < 0.92) return 'upgrade';
  return 'treasure';
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
export function generateSectorMap(totalFloors = 12) {
  const rows = [];

  for (let floor = 1; floor <= totalFloors; floor++) {
    const isBoss = floor === 6 || floor === totalFloors;
    // Alternate between 2 and 3 branches (with 1 boss convergence node on floors 6 and 12)
    const nodeCount = isBoss ? 1 : (floor === 1 ? 3 : (floor % 2 === 0 ? 2 : 3));
    const rowNodes = [];

    for (let col = 0; col < nodeCount; col++) {
      const roomType = pickRoomTypeForRow(floor, col);
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

  // Connect forward tree edges between floor `r` and floor `r + 1`
  for (let r = 0; r < rows.length - 1; r++) {
    const currentRow = rows[r];
    const nextRow = rows[r + 1];

    if (nextRow.length === 1) {
      // Converge all branches into Boss node
      for (const node of currentRow) {
        node.nextIds.push(nextRow[0].id);
      }
      continue;
    }

    if (currentRow.length === 1) {
      // Fan out from Boss node to all branches on the next floor
      for (const target of nextRow) {
        currentRow[0].nextIds.push(target.id);
      }
      continue;
    }

    // Standard branching between 2->3 or 3->2 nodes without crossing edges
    for (let i = 0; i < currentRow.length; i++) {
      const node = currentRow[i];
      // Find closest node(s) in `nextRow` by `xPct`
      const sortedByDist = [...nextRow].sort(
        (a, b) => Math.abs(a.xPct - node.xPct) - Math.abs(b.xPct - node.xPct)
      );
      node.nextIds.push(sortedByDist[0].id);
      if (sortedByDist[1] && (Math.random() < 0.65 || currentRow.length < nextRow.length)) {
        node.nextIds.push(sortedByDist[1].id);
      }
    }

    // Guarantee every node in `nextRow` has at least one parent edge
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
