import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TILE_SIZE,
  resolveCircleGridCollision,
  resolveCircleRectCollision,
  isPointInVisionCone,
  evaluateLockpickHit,
  findNextGridStep,
  getSpeedMultiplier,
  isLaserActiveAtTime,
  getSteamCyclePhase,
  isSteamActiveAtTime,
  isTimedButtonActive,
  getMusicThemeForLevel,
  getDynamicMusicBpm,
  isWithinProximityRadius,
  getConveyorForceAtPoint,
  getOceanStormWavePush,
  getNavalProgressPercent,
  applyIcebergImpact,
  getLockpickDifficultyConfig,
  evaluateCircuitFlow,
  canMoveRushHourBlock,
  stepRushHourBlock,
  isRushHourSolved,
  evaluateNavDialStrike,
  isPointProtectedByHazard,
  applySharkObstacleImpact,
  getSharkRaceSwimSpeed,
  evaluateSharkRaceOutcome,
  generateSharkRaceTrack,
  generateSharkTunnelCourse,
  evaluateHorizontalSharkRaceOutcome,
  generateMetroTrainCourse,
  evaluateMetroTrainOutcome,
  generateConveyorGauntlet,
  isInsidePlatformBounds,
  evaluateConveyorGauntletOutcome,
  reflectBossProjectile,
  evaluateBossBattleOutcome,
  SAVE_STORAGE_KEY,
  LEGACY_PROGRESS_STORAGE_KEY,
  TOTAL_CAMPAIGN_LEVELS,
  DEFAULT_MIN_UNLOCKED_IDX,
  createDefaultCampaignSave,
  parseCampaignSave,
  recordLevelCompletionSave,
  canWeaponStunDrone,
  getSnowstormIntensity,
  areAllBeaconsLit,
  isCrevasseFall,
  findHarpoonPullTarget,
  countActiveWeightPlates,
  isGeneratorFullyPowered,
  generateSnowmobileTunnelCourse,
  evaluateSnowmobileTunnelOutcome,
  areAllSonarDisabled,
  canCrossVolcanicHeat,
  generateMagmaPlatformCourse,
  evaluateMagmaPlatformOutcome,
  isFortressGateUnlocked,
  areAllCoolingValvesActive,
  isFireGeyserActive,
  generateGliderRadarCourse,
  evaluateGliderRadarOutcome,
  areAllCryoLabSystemsCleared,
  getGlacierConvoyWindPush,
  isTurretLaserFiring,
  getExpertEnemySpeedMultiplier,
  isConvoyGateUnlocked,
  canCrossBurningSteam,
  getIcebreakerBossPhase,
  evaluateIcebreakerBossOutcome,
  evaluateHarborCheckpointStep,
  evaluateHarborRaceOutcome,
  isHarborRaceGateUnlocked,
  stepArcadeCartVelocity,
  isPlayerHiddenByCamouflage,
  findGrappleAnchorTarget,
  areAllTropicalAntennasDisabled,
  areAllTempleAltarsActive,
  getBubbleCurrentForce,
  evaluateJeepRaceOutcome,
  type CircuitTile,
  type RushHourBlock,
} from './rules';

test('circle grid collision slides smoothly without penetrating solid tiles', () => {
  const isSolid = (c: number, r: number) => c === 2 && r === 2;
  const res = resolveCircleGridCollision(90, 120, 14, TILE_SIZE, isSolid);
  assert.ok(res.x <= 96 - 14 + 0.001, `Expected x <= 82, got ${res.x}`);
  assert.equal(res.y, 120);
});

test('circle rect collision pushes circle cleanly out of moving vehicles/containers', () => {
  const miss = resolveCircleRectCollision(20, 20, 10, 50, 50, 60, 30);
  assert.equal(miss.hit, false);
  const hit = resolveCircleRectCollision(45, 65, 12, 50, 50, 60, 30);
  assert.equal(hit.hit, true);
  assert.ok(hit.x <= 38 + 0.001, `Expected pushed left to <= 38, got ${hit.x}`);
});

test('vision cone detects player in clear line of sight and blocks behind wall', () => {
  const isOpaque = (c: number, r: number) => c === 3 && r === 1;
  const clear = isPointInVisionCone(130, 72, 96, 72, 0, Math.PI / 4, 200, TILE_SIZE, isOpaque);
  assert.equal(clear, true);

  const occluded = isPointInVisionCone(220, 72, 96, 72, 0, Math.PI / 4, 200, TILE_SIZE, isOpaque);
  assert.equal(occluded, false);

  const outOfFov = isPointInVisionCone(96, 150, 96, 72, 0, Math.PI / 4, 200, TILE_SIZE, isOpaque);
  assert.equal(outOfFov, false);
});

test('lockpick & terminal hack timing evaluation hits inside green zone and misses outside', () => {
  assert.equal(evaluateLockpickHit(0.5, 0.4, 0.6), 'hit');
  assert.equal(evaluateLockpickHit(0.4, 0.4, 0.6), 'hit');
  assert.equal(evaluateLockpickHit(0.39, 0.4, 0.6), 'miss');
  assert.equal(evaluateLockpickHit(0.65, 0.4, 0.6), 'miss');
});

test('BFS grid pathfinder routes guard around wall obstacle', () => {
  const isWalkable = (c: number, r: number) => !(c === 2 && (r === 0 || r === 1));
  const next = findNextGridStep(1, 0, 3, 0, 5, 3, isWalkable);
  assert.deepEqual(next, { col: 1, row: 1 });
});

test('vehicle speed multipliers boost movement accurately including moto & boat turbo', () => {
  assert.equal(getSpeedMultiplier('none'), 1.0);
  assert.ok(getSpeedMultiplier('skateboard') > 1.5);
  assert.ok(getSpeedMultiplier('cart') > getSpeedMultiplier('skateboard'));
  assert.ok(getSpeedMultiplier('cart', true) > getSpeedMultiplier('cart', false));
  assert.ok(getSpeedMultiplier('moto') > getSpeedMultiplier('cart'));
  assert.ok(getSpeedMultiplier('moto', true) > getSpeedMultiplier('moto', false));
  assert.ok(getSpeedMultiplier('boat') > 2.0);
  assert.ok(getSpeedMultiplier('boat', true) > getSpeedMultiplier('boat', false));
});

test('2.5s security laser cycle toggles on and off every 2.5 seconds', () => {
  assert.equal(isLaserActiveAtTime(0.5, 0, 2.5), true);
  assert.equal(isLaserActiveAtTime(2.6, 0, 2.5), false);
  assert.equal(isLaserActiveAtTime(5.1, 0, 2.5), true);
  assert.equal(isLaserActiveAtTime(0.5, 2.5, 2.5), false);
});

test('steam vent timed cycle transitions active -> off -> warning -> active', () => {
  assert.equal(isSteamActiveAtTime(0.4, 0, 1.5, 4.0), true);
  const offPhase = getSteamCyclePhase(2.2, 0, 1.5, 4.0, 0.6);
  assert.equal(offPhase.active, false);
  assert.equal(offPhase.warning, false);
  const warnPhase = getSteamCyclePhase(3.6, 0, 1.5, 4.0, 0.6);
  assert.equal(warnPhase.active, false);
  assert.equal(warnPhase.warning, true);
});

test('timed pressure button counts down accurately and closes when expired', () => {
  assert.equal(isTimedButtonActive(5.0, null, 10.0).active, false);
  const mid = isTimedButtonActive(13.0, 10.0, 10.0);
  assert.equal(mid.active, true);
  assert.equal(mid.remaining, 7.0);
  assert.equal(mid.progress, 0.7);
  const expired = isTimedButtonActive(20.5, 10.0, 10.0);
  assert.equal(expired.active, false);
  assert.equal(expired.remaining, 0);
});

test('dynamic music engine maps each act theme and accelerates BPM on pursuit', () => {
  assert.equal(getMusicThemeForLevel(0), 'zoo');
  assert.equal(getMusicThemeForLevel(2), 'zoo');
  assert.equal(getMusicThemeForLevel(3), 'city');
  assert.equal(getMusicThemeForLevel(5), 'city');
  assert.equal(getMusicThemeForLevel(6), 'ship');
  assert.equal(getMusicThemeForLevel(8), 'ship');
  assert.equal(getMusicThemeForLevel(9), 'ocean');

  for (let i = 0; i < 10; i++) {
    assert.ok(
      getDynamicMusicBpm(i, 1.0) > getDynamicMusicBpm(i, 0.0) + 20,
      `Level ${i + 1} chase BPM should accelerate significantly`
    );
  }
});

test('police proximity radar detects player inside radius and ignores outside', () => {
  assert.equal(isWithinProximityRadius(100, 100, 200, 100, 160), true);
  assert.equal(isWithinProximityRadius(100, 100, 260, 100, 160), true);
  assert.equal(isWithinProximityRadius(100, 100, 265, 100, 160), false);
  assert.equal(isWithinProximityRadius(100, 100, 100, 100, 0), false);
});

test('warehouse conveyor belts push penguin only inside belt bounds', () => {
  const belts = [{ x: 100, y: 200, w: 120, h: 48, vx: -115, vy: 0 }];
  assert.deepEqual(getConveyorForceAtPoint(50, 220, belts), { x: 0, y: 0 });
  assert.deepEqual(getConveyorForceAtPoint(150, 224, belts), { x: -115, y: 0 });
});

test('ocean storm wave push and Antarctic distance progress compute bounded values', () => {
  const w1 = getOceanStormWavePush(1.0, 2400);
  const w2 = getOceanStormWavePush(3.2, 2400);
  assert.ok(Math.abs(w1.x) > 0 || Math.abs(w2.x) > 0);
  assert.equal(getNavalProgressPercent(3000, 3000, 100), 0);
  assert.equal(Math.round(getNavalProgressPercent(1550, 3000, 100)), 50);
  assert.equal(getNavalProgressPercent(50, 3000, 100), 100);
});

test('iceberg impact deals 50% hull damage, triggers 3.0s 50% slow, respects invuln, and sinks boat on 2nd hit', () => {
  const first = applyIcebergImpact(100, 0);
  assert.equal(first.hullHp, 50);
  assert.equal(first.slowTimer, 3.0);
  assert.equal(first.slowDuration, 3.0);
  assert.equal(first.damaged, true);
  assert.equal(first.defeated, false);
  assert.equal(first.sunk, false);

  const guarded = applyIcebergImpact(first.hullHp, 0.35);
  assert.equal(guarded.damaged, false);
  assert.equal(guarded.hullHp, 50);

  const second = applyIcebergImpact(first.hullHp, 0);
  assert.equal(second.hullHp, 0);
  assert.equal(second.slowTimer, 3.0);
  assert.equal(second.damaged, true);
  assert.equal(second.defeated, true);
  assert.equal(second.sunk, true);
});

test('lockpick and terminal hack difficulty scales +2 grades faster and narrower across stages', () => {
  const s1 = getLockpickDifficultyConfig(0.16, 2, 1);
  const s2 = getLockpickDifficultyConfig(0.16, 2, 2);
  const n8 = getLockpickDifficultyConfig(0.11, 7, 3);
  assert.ok(s1.speed >= 1.9, `Expected +2 grade speed >= 1.9, got ${s1.speed}`);
  assert.ok(s2.speed > s1.speed, 'Stage 2 should sweep faster than Stage 1');
  assert.ok(s2.zoneWidth < s1.zoneWidth, 'Stage 2 green zone should tighten');
  assert.ok(n8.speed > s2.speed && n8.zoneWidth >= 0.078 && n8.zoneWidth <= 0.12);
});

test('metro circuit pipe BFS propagates energy left-to-right only when all path segments align', () => {
  const grid: CircuitTile[][] = [
    [
      { kind: 'source', rot: 0 },
      { kind: 'straight', rot: 1 }, // vertical (disconnected)
      { kind: 'elbow', rot: 2 },
      { kind: 'empty', rot: 0 },
    ],
    [
      { kind: 'empty', rot: 0 },
      { kind: 'empty', rot: 0 },
      { kind: 'elbow', rot: 0 },
      { kind: 'sink', rot: 0 },
    ],
  ];
  assert.equal(evaluateCircuitFlow(grid).solved, false);

  // Rotate straight to horizontal (rot 0), (0,2) elbow to [L,D] (rot 2), (1,2) elbow to [U,R] (rot 0)
  grid[0][1].rot = 0;
  const res = evaluateCircuitFlow(grid);
  assert.equal(res.solved, true);
  assert.equal(res.powered[0][0], true);
  assert.equal(res.powered[0][1], true);
  assert.equal(res.powered[0][2], true);
  assert.equal(res.powered[1][2], true);
  assert.equal(res.powered[1][3], true);
});

test('Rush Hour 6x6 cargo puzzle prevents overlap and is provably solvable in >= 5 moves', () => {
  const initial: RushHourBlock[] = [
    { id: 'skate', x: 0, y: 2, len: 2, dir: 'h', isTarget: true },
    { id: 'v1', x: 2, y: 1, len: 3, dir: 'v' },
    { id: 'h1', x: 1, y: 4, len: 2, dir: 'h' },
    { id: 'h2', x: 2, y: 5, len: 2, dir: 'h' },
    { id: 'v2', x: 4, y: 2, len: 2, dir: 'v' },
    { id: 'v3', x: 5, y: 1, len: 3, dir: 'v' },
    { id: 'h3', x: 3, y: 0, len: 3, dir: 'h' },
    { id: 'h4', x: 0, y: 5, len: 2, dir: 'h' },
  ];
  assert.equal(isRushHourSolved(initial, 6), false);
  // Target cannot push through v1 at x=2
  assert.equal(canMoveRushHourBlock(initial, 'skate', 1, 6), false);

  // BFS shortest-solution check
  const encode = (bs: RushHourBlock[]) => bs.map((b) => `${b.x},${b.y}`).join('|');
  const visited = new Set<string>([encode(initial)]);
  const queue: Array<{ state: RushHourBlock[]; moves: number }> = [{ state: initial, moves: 0 }];
  let minMoves = -1;
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    if (isRushHourSolved(cur.state, 6)) {
      minMoves = cur.moves;
      break;
    }
    for (const blk of cur.state) {
      for (const dir of [-1, 1]) {
        for (let step = 1; step <= 4; step++) {
          const delta = dir * step;
          if (!canMoveRushHourBlock(cur.state, blk.id, delta, 6)) break;
          const next = stepRushHourBlock(cur.state, blk.id, delta, 6);
          const key = encode(next);
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ state: next, moves: cur.moves + 1 });
          }
        }
      }
    }
  }
  assert.ok(minMoves >= 5, `Expected Rush Hour puzzle to require >= 5 moves, got ${minMoves}`);
});

test('navigation dial circular strike handles wraparound accurately', () => {
  assert.equal(evaluateNavDialStrike(0.98, 0.02, 0.08), 'hit');
  assert.equal(evaluateNavDialStrike(0.5, 0.02, 0.08), 'miss');
});

test('all 20 expanded campaign levels in index.html meet scale, door-variety, AI patrol, hazard protection, subgames, and Act V rules', async () => {
  const fs = await import('node:fs');
  const html = fs.readFileSync('index.html', 'utf8');
  const match = html.match(/const LEVELS = (\[[\s\S]*?\n      \]);/);
  assert.ok(match, 'LEVELS array should exist in index.html');
  const levels = new Function(`return ${match[1]};`)() as Array<{
    id: number;
    code: string;
    name: string;
    mode?: string;
    theme?: string;
    snowstorm?: boolean;
    stormIntensityBoost?: number;
    windMultiplier?: number;
    guardFovBoost?: number;
    grid: string[];
    spawn: { x: number; y: number };
    initialVehicle?: string;
    doors: Array<{ id?: string; col: number; row?: number; rows?: number[]; type: string; keyColor?: string; gateId?: number; label?: string }>;
    pickups: Array<{ id?: string; kind: string; weapon?: string; keyColor?: string; x: number; y: number; label?: string }>;
    switches?: Array<{ x: number; y: number; label: string }>;
    pressureButtons?: Array<{ x: number; y: number; duration: number; label: string }>;
    subgameZones?: Array<{ id: string; kind: string; x: number; y: number; radius?: number; label: string }>;
    thermalBeacons?: Array<{ id: string; x: number; y: number; label: string }>;
    cages?: Array<{ id: string; x: number; y: number; label: string }>;
    weightPlates?: Array<{ id: string; x: number; y: number }>;
    geothermalCores?: Array<{ id: string; x: number; y: number; label: string }>;
    centralGenerator?: { x: number; y: number; requiredCores: number; label: string };
    hunterTraps?: Array<{ id: string; x: number; y: number }>;
    spotlights?: Array<{ cx: number; cy: number }>;
    sonarConsoles?: Array<{ id: string; x: number; y: number; label: string }>;
    cryoNodes?: Array<{ id: string; gateId: number; x: number; y: number; label?: string }>;
    harpoonLocks?: Array<{ id: string; gateId: number; x: number; y: number; label?: string }>;
    coolingValves?: Array<{ id: string; x: number; y: number; label?: string }>;
    fireGeysers?: Array<{ id?: string; x: number; y: number; radius?: number; phaseOffset?: number; activeDur?: number; period?: number }>;
    cryoFans?: Array<{ id: string; giantTurbine?: boolean; x: number; y: number; blockTiles?: Array<{ col: number; row: number }>; pushVx?: number; pushVy?: number; range?: number; label?: string }>;
    magneticLevers?: Array<{ id: string; x: number; y: number; label?: string }>;
    drawbridges?: Array<{ id: string; x: number; y: number; winchX: number; winchY: number; tiles: Array<{ col: number; row: number }>; label?: string }>;
    burningCorridors?: Array<{ id: string; minCol: number; maxCol: number; minRow: number; maxRow: number; label?: string }>;
    laserTurrets?: Array<{ id?: string; x1: number; y1: number; x2: number; y2: number; phaseOffset?: number; activeDur?: number; period?: number }>;
    lasers?: Array<{ x1: number; y1: number; x2: number; y2: number; phaseOffset?: number; interval?: number }>;
    glacierScroll?: boolean;
    windPush?: boolean;
    envProps?: Array<{ kind: string; x: number; y: number }>;
    reactionBoost?: number;
    traffic?: Array<{ axis?: string }>;
    cranes?: Array<{ x: number; y: number; len: number; speed: number; baseAngle?: number }>;
    raceCheckpoints?: Array<{ id: string; x: number; y: number; radius?: number; label?: string }>;
    racePatrol?: { x: number; y: number; speed: number; waypoints: Array<{ x: number; y: number }> };
    racePatrols?: Array<{ name?: string; speed: number; waypoints: Array<{ x: number; y: number }> }>;
    tropicalAntennas?: Array<{ id: string; x: number; y: number }>;
    grappleAnchors?: Array<{ id: string; x: number; y: number }>;
    templeAltars?: Array<{ id: string; x: number; y: number }>;
    boostPads?: Array<{ x: number; y: number; angle?: number }>;
    bubbleCurrents?: Array<{ id?: number; x: number; y: number; radius: number; vx: number; vy: number }>;
    steamVents?: Array<{ x: number; y: number; period?: number; activeDur?: number; phaseOffset?: number; radius?: number }>;
    drones?: Array<{ name?: string; speed: number; fov?: number; range?: number; fishOnly?: boolean; waypoints: Array<{ x: number; y: number }> }>;
    postSubgameDrones?: Array<{ name: string; speed: number; fishOnly?: boolean; waypoints: Array<{ x: number; y: number }> }>;
    postSubgameGuards?: Array<{ name: string; speed: number; waypoints: Array<{ x: number; y: number }> }>;
    conveyors?: Array<{ x: number; y: number; w: number; h: number; vx: number; vy: number }>;
    oilSlicks?: Array<{ x: number; y: number; rx: number; ry: number }>;
    movingIcebergs?: Array<{ x1: number; y1: number; x2: number; y2: number }>;
    seaMines?: Array<{ x: number; y: number }>;
    vehicles: Array<{ kind: string; x: number; y: number }>;
    cameras: Array<{ x: number; y: number; baseAngle: number; sweep: number; range: number; fov: number }>;
    guards: Array<{
      name: string;
      speed: number;
      isElite?: boolean;
      isHeavy?: boolean;
      isPatrolVehicle?: boolean;
      isPoacher?: boolean;
      isThermalHunter?: boolean;
      isPatrolSnowmobile?: boolean;
      isRobotDog?: boolean;
      proximityRadius?: number;
      waypoints: Array<{ x: number; y: number }>;
    }>;
    patrolBoats?: Array<{ name: string; speed: number; waypoints: Array<{ x: number; y: number }> }>;
  }>;

  assert.equal(levels.length, 25, 'Should contain all 25 campaign levels (20 Antarctica + 5 Volcanic Island)');

  const isStaticObstacleChar = (ch: string | undefined) =>
    ch === undefined || ch === '#' || ch === 'W' || ch === 'T' || ch === 'B' || ch === 'R' || ch === 'G' || ch === 'H' || ch === 'X' || ch === 'C' || ch === 'L';

  for (const lvl of levels) {
    const rows = lvl.grid.length;
    const cols = lvl.grid[0].length;
    for (const r of lvl.grid) assert.equal(r.length, cols, `${lvl.code}: uniform row length`);

    const expandedDoors = (lvl.doors || []).flatMap((d) => {
      const rowList = Array.isArray(d.rows) && d.rows.length > 0 ? d.rows : [d.row ?? 0];
      return rowList.map((r) => ({ ...d, row: r }));
    });

    const startC = Math.floor(lvl.spawn.x);
    const startR = Math.floor(lvl.spawn.y);

    if (lvl.mode === 'naval') {
      if (lvl.id === 25) {
        assert.equal(lvl.theme, 'volcano_caves_sub', 'N25 must use volcano_caves_sub theme');
        assert.equal(lvl.initialVehicle, 'submarine', 'N25 must start mounted inside mini-submarine');
        assert.ok(!lvl.grid.some((r) => r.includes('G')), 'N25 volcanic underwater cave must contain ZERO icebergs G');
        assert.equal((lvl.movingIcebergs || []).length, 0, 'N25 must not spawn movingIcebergs');
        assert.ok((lvl.bubbleCurrents || []).length >= 4, 'N25 must include >= 4 bubbleCurrents');
        assert.ok((lvl.steamVents || []).length >= 4, 'N25 must include >= 4 steam vents');
        assert.ok((lvl.seaMines || []).length >= 4, 'N25 must include >= 4 sea mines');
        assert.ok((lvl.drones || []).length >= 3, 'N25 must include >= 3 underwater drones');
        const walkableSubWater = (c: number, r: number) => {
          const ch = lvl.grid[r]?.[c];
          return ch === 'W' || ch === 'P' || ch === 'E';
        };
        assert.ok(walkableSubWater(startC, startR), `${lvl.code}: submarine spawn must be open water`);
        let subExitReachable = false;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (lvl.grid[r][c] === 'E') {
              if (findNextGridStep(startC, startR, c, r, cols, rows, walkableSubWater) !== null) {
                subExitReachable = true;
              }
            }
          }
        }
        assert.ok(subExitReachable, 'N25 submarine must reach exit E through underwater cave');
        continue;
      }

      assert.ok(cols >= 34 && rows >= 78, `${lvl.code}: expanded naval map expected >=34x78, got ${cols}x${rows}`);
      assert.ok((lvl.movingIcebergs || []).length >= 14, `${lvl.code}: +2 grade dense moving icebergs required`);
      assert.ok((lvl.seaMines || []).length >= 18, `${lvl.code}: +2 grade floating sea mines required`);
      assert.ok((lvl.patrolBoats || []).length >= 10, `${lvl.code}: +2 grade fast patrol boats required`);
      for (const pb of lvl.patrolBoats || []) {
        assert.ok(pb.speed >= 215, `${lvl.code}: ${pb.name} speed >= 215 expected`);
      }

      // Narrow single Antarctic exit channel check: row 1..2 E tiles contiguous and bounded by indestructible 'H' glacier walls
      let channelCols = 0;
      for (let c = 0; c < cols; c++) {
        if (lvl.grid[1][c] === 'E') channelCols++;
      }
      assert.ok(channelCols >= 3 && channelCols <= 6, `${lvl.code}: expected single narrow exit channel (3..6 cols wide), got ${channelCols}`);
      assert.ok(lvl.grid[1].includes('H'), `${lvl.code}: impassable H glacier barrier must frame the single channel`);

      const walkableSea = (c: number, r: number) => {
        const ch = lvl.grid[r]?.[c];
        return ch !== undefined && !isStaticObstacleChar(ch);
      };
      assert.ok(walkableSea(startC, startR), `${lvl.code}: naval spawn must be open sea`);
      for (const pb of lvl.patrolBoats || []) {
        assert.ok(pb.speed > 0 && pb.waypoints.length >= 2, `${lvl.code}: Patrol boat ${pb.name} must actively patrol`);
        const distinctBoatWps = new Set(pb.waypoints.map((w) => `${w.x},${w.y}`));
        assert.ok(distinctBoatWps.size >= 2, `${lvl.code}: Patrol boat ${pb.name} must have >=2 distinct waypoints`);
        for (let i = 0; i < pb.waypoints.length; i++) {
          const wp = pb.waypoints[i];
          const nextWp = pb.waypoints[(i + 1) % pb.waypoints.length];
          assert.ok(
            walkableSea(Math.floor(wp.x), Math.floor(wp.y)),
            `${lvl.code}: Patrol boat ${pb.name} waypoint (${wp.x},${wp.y}) must be navigable`
          );
          const step = findNextGridStep(
            Math.floor(wp.x),
            Math.floor(wp.y),
            Math.floor(nextWp.x),
            Math.floor(nextWp.y),
            cols,
            rows,
            walkableSea
          );
          assert.ok(step !== null, `${lvl.code}: Patrol boat ${pb.name} path clear`);
        }
      }
      let exitReachable = false;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (lvl.grid[r][c] === 'E') {
            const step = findNextGridStep(startC, startR, c, r, cols, rows, walkableSea);
            if (step !== null) exitReachable = true;
          }
        }
      }
      assert.ok(exitReachable, `${lvl.code}: Antarctic narrow channel exit E must be reachable by boat`);
      continue;
    }

    // Odd-level interactive subgame & N3 post-subgame reinforcement checks
    if (lvl.id === 2) {
      assert.ok((lvl.subgameZones || []).some((z) => z.kind === 'aquarium_shark'), 'N3 must include aquarium_shark subgameZone');
      assert.ok(!lvl.pickups.some((pk) => pk.kind === 'gadget' && pk.weapon === 'fish'), 'N3 must NOT spawn fish launcher on floor');
      assert.equal((lvl.postSubgameGuards || []).length, 2, 'N3 must spawn 2 fast post-subgame guards near exit');
      assert.ok((lvl.postSubgameDrones || []).length >= 2, 'N3 must spawn post-subgame armored drones');
      for (const dr of lvl.postSubgameDrones || []) {
        assert.equal(dr.fishOnly, true, `N3 drone ${dr.name} must require fish cannon (fishOnly: true)`);
      }
    }
    if (lvl.id === 4) {
      assert.ok((lvl.subgameZones || []).some((z) => z.kind === 'metro_circuits'), 'N5 must include metro_circuits stairs subgameZone');
      assert.ok(lvl.doors.some((d) => d.type === 'circuit'), 'N5 must lock final gate behind circuit subgame');
    }
    if (lvl.id === 5) {
      assert.equal(lvl.theme, 'harbor', 'N6 must use harbor theme');
      assert.ok(cols >= 90 && rows >= 40, `N6 expanded industrial harbor must be >= 90x40 tiles, got ${cols}x${rows}`);
      assert.equal((lvl.raceCheckpoints || []).length, 3, 'N6 must include 3 Cart Race checkpoints');
      assert.ok(Boolean(lvl.racePatrol) && (lvl.racePatrol?.waypoints || []).length >= 3, 'N6 must include Harbor Patrol rival vehicle with >= 3 waypoints');
      assert.ok(lvl.doors.some((d) => d.type === 'harbor_race'), 'N6 must lock exit behind harbor_race gate');
      assert.ok(lvl.vehicles.some((v) => v.kind === 'cart'), 'N6 must include playable Cart vehicle');
      assert.ok((lvl.cranes || []).length >= 6, 'N6 must include >= 6 sweeping port cranes');
      const propKinds = new Set((lvl.envProps || []).map((p) => p.kind));
      assert.ok(propKinds.has('bollard'), 'N6 must include mooring bollard props');
      assert.ok(propKinds.has('container_beacon'), 'N6 must include glowing container_beacon road markers');
    }
    if (lvl.id === 6) {
      assert.ok((lvl.subgameZones || []).some((z) => z.kind === 'warehouse_rushhour'), 'N7 must include warehouse_rushhour box puzzle subgameZone');
      assert.equal(lvl.vehicles.length, 0, 'N7 skateboard should only be unlocked by solving Rush Hour puzzle');
    }
    if (lvl.id === 8) {
      assert.ok((lvl.subgameZones || []).some((z) => z.kind === 'bridge_calibration'), 'N9 must include bridge_calibration navigation subgameZone');
    }

    // N4 & N5 City: cross traffic + fast drones + proximity police patrols
    if (lvl.id === 3 || lvl.id === 4) {
      assert.ok((lvl.traffic || []).some((t) => t.axis === 'y'), `${lvl.code}: vertical cross-traffic required`);
      assert.ok((lvl.traffic || []).some((t) => !t.axis || t.axis === 'x'), `${lvl.code}: horizontal traffic required`);
      assert.ok((lvl.drones || []).length >= 2, `${lvl.code}: fast surveillance drones required`);
      assert.ok(lvl.guards.some((g) => g.isPatrolVehicle && (g.proximityRadius || 0) > 100), `${lvl.code}: proximity police patrol required`);
    }

    // N7 Warehouse: conveyor belts + tighter timed pressure door + opposite switches
    if (lvl.id === 6) {
      assert.ok((lvl.conveyors || []).length >= 3, `${lvl.code}: conveyor belts required`);
      assert.ok((lvl.pressureButtons || []).length >= 1, `${lvl.code}: tighter timed gate required`);
    }

    // N8 Engine room: oil slicks
    if (lvl.id === 7) {
      assert.ok((lvl.oilSlicks || []).length >= 3, `${lvl.code}: slippery oil slicks required`);
    }

    // Act V (N11-N20): Polar maps >= 68x36 with zero police enemies and distinct mechanics
    if (lvl.id >= 10 && lvl.id <= 19) {
      assert.ok(cols >= 68, `${lvl.code}: Act V width must be >= 68`);
      assert.ok(rows >= 36, `${lvl.code}: Act V height must be >= 36`);
      assert.ok(
        lvl.guards.every((g) => !g.isPatrolVehicle && !/polic/i.test(g.name)),
        `${lvl.code}: Act V must NOT have police guards`
      );
      if (lvl.id === 10) {
        assert.equal(lvl.snowstorm, true, 'N11 must have cyclical snowstorms enabled');
        assert.equal((lvl.thermalBeacons || []).length, 3, 'N11 must have 3 thermal beacons');
        assert.ok(lvl.doors.some((d) => d.type === 'beacons'), 'N11 must lock exit behind beacons gate');
        assert.ok(lvl.pickups.some((pk) => pk.weapon === 'cryo_snow'), 'N11 must include Cryo Snow Cannon');
        assert.ok(lvl.guards.filter((g) => g.isPoacher).length >= 4, 'N11 +3 difficulty must double active poachers (>=4)');
        assert.ok(lvl.guards.filter((g) => g.isPatrolSnowmobile).length >= 4, 'N11 must add outer perimeter patrol snowmobiles');
        const propKinds = new Set((lvl.envProps || []).map((p) => p.kind));
        for (const k of ['dish', 'crate', 'sled', 'campfire', 'footprints']) {
          assert.ok(propKinds.has(k), `N11 must include ${k} visual prop`);
        }
      }
      if (lvl.id === 11) {
        assert.equal((lvl.cages || []).length, 3, 'N12 must have 3 penguin prisoner cages');
        assert.equal((lvl.weightPlates || []).length, 4, 'N12 must have 4 simultaneous weight plates');
        assert.ok(lvl.doors.some((d) => d.type === 'weight_rescue'), 'N12 must lock exit behind 4-penguin weight_rescue gate');
        assert.ok(lvl.pickups.some((pk) => pk.weapon === 'harpoon'), 'N12 must include Magnetic Harpoon');
        assert.ok(lvl.grid.some((r) => r.includes('C')), 'N12 must include glacial crevasses C');
        assert.ok(lvl.guards.filter((g) => g.isPoacher).length >= 4, 'N12 must include additional cavern poachers');
        assert.ok((lvl.drones || []).filter((d) => (d.fov || 0) >= 0.85).length >= 3, 'N12 must include wide-FOV arctic drones near cages');
        assert.ok((lvl.reactionBoost || 1) >= 1.5, 'N12 must increase enemy reaction speed');
        const propKinds = new Set((lvl.envProps || []).map((p) => p.kind));
        for (const k of ['stalagmite', 'aurora_crystal', 'crevasse_crack']) {
          assert.ok(propKinds.has(k), `N12 must include ${k} visual prop`);
        }
      }
      if (lvl.id === 12) {
        assert.equal((lvl.geothermalCores || []).length, 3, 'N13 must have 3 geothermal cores');
        assert.ok(Boolean(lvl.centralGenerator), 'N13 must have central geothermal generator');
        assert.ok((lvl.hunterTraps || []).length >= 5, 'N13 must include hunter traps');
        assert.ok((lvl.spotlights || []).length >= 3, 'N13 must include sweeping white spotlights');
        assert.ok(lvl.vehicles.some((v) => v.kind === 'snowmobile'), 'N13 must include drivable Turbo Snowmobiles');
        assert.ok(lvl.guards.some((g) => g.isRobotDog), 'N13 must include Robot Dogs');
        assert.ok(lvl.doors.some((d) => d.type === 'generator'), 'N13 must lock final exit behind generator gate');
        assert.ok((lvl.subgameZones || []).some((z) => z.kind === 'snowmobile_tunnel'), 'N13 must include snowmobile_tunnel subgameZone');
        assert.ok(lvl.doors.some((d) => d.type === 'master_generator'), 'N13 must include master_generator door unlocked by subgame');
        const propKinds = new Set((lvl.envProps || []).map((p) => p.kind));
        for (const k of ['drill_tower', 'steam_pipe', 'fuel_barrel', 'machinery', 'strobe_light']) {
          assert.ok(propKinds.has(k), `N13 must include ${k} visual prop`);
        }
      }
      if (lvl.id === 13) {
        assert.equal(lvl.theme, 'arctic_sub', 'N14 must use arctic_sub theme');
        assert.equal((lvl.sonarConsoles || []).length, 3, 'N14 must have 3 sonar consoles');
        assert.ok(lvl.doors.some((d) => d.type === 'sonar'), 'N14 must include sonar immersion gate');
        assert.ok(lvl.guards.some((g) => g.isElite), 'N14 must include elite tactical flashlight guards');
        assert.ok((lvl.drones || []).length >= 2, 'N14 must include patrol drones');
      }
      if (lvl.id === 14) {
        assert.equal(lvl.theme, 'arctic_volcano', 'N15 must use arctic_volcano theme');
        assert.ok(cols >= 106, `N15 doubled second half must expand grid width >= 106, got ${cols}`);
        assert.ok(lvl.grid.some((r) => r.includes('L')), 'N15 must include glowing magma river tiles L');
        assert.ok(lvl.grid.some((r) => r.includes('V')), 'N15 must include thermal-shield bridge tiles V');
        assert.ok((lvl.subgameZones || []).some((z) => z.kind === 'magma_platforms'), 'N15 must include magma_platforms subgameZone');
        assert.ok(lvl.doors.some((d) => d.type === 'thermal_shield'), 'N15 must include thermal_shield gate');
        assert.equal((lvl.coolingValves || []).length, 2, 'N15 must have 2 Cooling Valves');
        assert.ok((lvl.fireGeysers || []).length >= 4, 'N15 must have >= 4 timed fire geysers');
        assert.ok(lvl.guards.filter((g) => g.isThermalHunter).length >= 2, 'N15 must include >= 2 thermal-suit poachers');
        assert.ok((lvl.drones || []).length >= 3, 'N15 must include surveillance drones patrolling magma bridges');
        assert.ok(lvl.doors.some((d) => d.type === 'cooling_valves'), 'N15 must lock final exit behind cooling_valves gate');
      }
      if (lvl.id === 15) {
        assert.equal(lvl.theme, 'arctic_fortress', 'N16 must use arctic_fortress theme');
        assert.ok(cols >= 74 && rows >= 38, 'N16 giant fortress must be >= 74x38 tiles');
        assert.ok((lvl.spotlights || []).length >= 4, 'N16 must include searchlights');
        assert.ok(lvl.guards.some((g) => g.isRobotDog), 'N16 must include fast robot dogs');
        assert.ok(lvl.guards.some((g) => g.isPatrolSnowmobile), 'N16 must include patrol snowmobiles');
        assert.ok(lvl.guards.some((g) => g.isPoacher && g.isHeavy), 'N16 must include heavy poachers');
        assert.ok(lvl.pickups.some((pk) => pk.weapon === 'cryo_snow'), 'N16 must include cryo_snow pickup');
        assert.ok(lvl.pickups.some((pk) => pk.weapon === 'harpoon'), 'N16 must include harpoon pickup');
        assert.equal(lvl.doors.filter((d) => d.type === 'armored_fortress').length, 3, 'N16 must have 3 armored fortress gates');
        assert.ok((lvl.cryoNodes || []).length >= 3, 'N16 must have >= 3 Cryo Valve Nodes');
        assert.ok((lvl.harpoonLocks || []).length >= 3, 'N16 must have >= 3 Magnetic Harpoon Locks');
      }
      if (lvl.id === 16) {
        assert.equal(lvl.theme, 'arctic_airbase', 'N17 must use arctic_airbase theme');
        assert.ok(cols >= 74 && rows >= 38, `N17 huge airfield must be >= 74x38 tiles, got ${cols}x${rows}`);
        assert.equal(lvl.snowstorm, true, 'N17 must include snowstorm effect');
        assert.ok((lvl.stormIntensityBoost || 0) >= 0.4, 'N17 must intensify snowstorm gusts');
        assert.ok((lvl.guardFovBoost || 0) > 0, 'N17 must widen guard/camera detection cones');
        const propKinds = new Set((lvl.envProps || []).map((p) => p.kind));
        assert.ok(propKinds.has('runway_light_blue'), 'N17 must include blue runway guide lights');
        assert.ok(propKinds.has('runway_light_amber'), 'N17 must include amber runway guide lights');
        assert.ok(propKinds.has('cargo_plane'), 'N17 must include parked cargo planes');
        assert.ok(lvl.guards.filter((g) => g.isRobotDog).length >= 5, 'N17 must include >= 5 fast robot dogs (with 2 extra perimeter dogs)');
        assert.ok((lvl.subgameZones || []).some((z) => z.kind === 'glider_radar'), 'N17 must include glider_radar subgameZone');
        assert.ok(lvl.doors.some((d) => d.type === 'hangar'), 'N17 must lock exit behind hangar gate');
      }
      if (lvl.id === 17) {
        assert.equal(lvl.theme, 'cryo_lab', 'N18 must use cryo_lab theme');
        assert.ok(cols >= 70 && rows >= 36, `N18 cryo lab must be >= 70x36 tiles, got ${cols}x${rows}`);
        const propKinds = new Set((lvl.envProps || []).map((p) => p.kind));
        assert.ok(propKinds.has('cryo_capsule'), 'N18 must include glowing cyan cryo_capsule props');
        assert.ok((lvl.lasers || []).length >= 3, 'N18 must include cyclical security lasers');
        assert.ok(lvl.guards.some((g) => g.isElite), 'N18 must include elite guards');
        assert.ok((lvl.cryoFans || []).length >= 2, 'N18 must include >= 2 corridor Cryo Fans');
        assert.ok((lvl.magneticLevers || []).length >= 2, 'N18 must include >= 2 remote Magnetic Levers');
        assert.ok(lvl.pickups.some((pk) => pk.weapon === 'cryo_snow'), 'N18 must include cryo_snow pickup');
        assert.ok(lvl.pickups.some((pk) => pk.weapon === 'harpoon'), 'N18 must include harpoon pickup');
        assert.ok(lvl.doors.some((d) => d.type === 'cryo_lab_gate'), 'N18 must lock exit behind cryo_lab_gate');
      }
      if (lvl.id === 18) {
        assert.equal(lvl.theme, 'armored_convoy', 'N19 must use armored_convoy theme');
        assert.ok(cols >= 120 && rows >= 36, `N19 extended 5-car armored convoy must be >= 120x36 tiles, got ${cols}x${rows}`);
        assert.equal(lvl.glacierScroll, true, 'N19 must enable glacierScroll');
        assert.equal(lvl.windPush, true, 'N19 must enable crosswind windPush');
        assert.ok((lvl.laserTurrets || []).length >= 7, 'N19 extended convoy must include >= 7 cyclical laserTurrets');
        assert.ok(lvl.guards.some((g) => g.isPoacher && g.isHeavy), 'N19 must include heavy poachers');
        assert.ok((lvl.drones || []).length >= 4, 'N19 extended convoy must include >= 4 surveillance drones');
        assert.ok(lvl.vehicles.some((v) => v.kind === 'snowmobile' && v.x >= 56), 'N19 must place Turbo Snowmobile after middle car (x >= 56)');
        assert.equal(lvl.pickups.filter((pk) => pk.kind === 'convoy_keycard').length, 2, 'N19 must include 2 convoy_keycard pickups in extra front cars');
        assert.ok(lvl.doors.some((d) => d.type === 'convoy_gate'), 'N19 must lock final car exit behind convoy_gate');
      }
      if (lvl.id === 19) {
        assert.equal(lvl.theme, 'glacier_core', 'N20 must use glacier_core theme');
        assert.ok(cols >= 82 && rows >= 38, `N20 glacier_core must be >= 82x38 tiles, got ${cols}x${rows}`);
        assert.ok((lvl.cryoFans || []).some((f) => f.giantTurbine), 'N20 must include Giant Cryo Turbine');
        assert.ok((lvl.drawbridges || []).length >= 1, 'N20 must include harpoon drawbridge over crevasse');
        assert.ok((lvl.burningCorridors || []).length >= 1, 'N20 must include burning steam corridor');
        assert.ok(lvl.pickups.some((pk) => pk.kind === 'thermal_shield_pickup'), 'N20 must include thermal_shield_pickup');
        assert.ok((lvl.subgameZones || []).some((z) => z.kind === 'icebreaker_boss'), 'N20 must include icebreaker_boss arena zone');
        assert.ok(lvl.doors.some((d) => d.type === 'boss_core'), 'N20 must lock exit behind boss_core gate');
      }
    }

    // Campaign 2 Act II: Volcanic Island (N21-N24 surface)
    if (lvl.id >= 21 && lvl.id <= 24) {
      assert.equal(lvl.snowstorm || false, false, `${lvl.code}: Volcanic Island must not have snowstorms`);
      if (lvl.id === 21) {
        assert.equal(lvl.theme, 'tropical_beach', 'N21 must use tropical_beach theme');
        assert.equal((lvl.tropicalAntennas || []).length, 3, 'N21 must have 3 coastal antennas');
        assert.ok((lvl.spotlights || []).length >= 3, 'N21 must include sweeping spotlights');
        assert.ok(expandedDoors.some((d) => d.type === 'tropical_antennas'), 'N21 must lock exit behind tropical_antennas gate');
      }
      if (lvl.id === 22) {
        assert.equal(lvl.theme, 'biolum_jungle', 'N22 must use biolum_jungle theme');
        assert.ok(lvl.pickups.some((pk) => pk.weapon === 'camouflage'), 'N22 must include Tropical Camouflage pickup');
        assert.ok((lvl.lasers || []).length >= 3, 'N22 must include cyclical lasers');
        assert.ok((lvl.cameras || []).length >= 3, 'N22 must include security cameras');
        assert.ok(expandedDoors.some((d) => d.type === 'keycard' && d.keyColor === 'blue'), 'N22 must lock exit behind blue keycard door');
      }
      if (lvl.id === 23) {
        assert.equal(lvl.theme, 'volcano_ruins', 'N23 must use volcano_ruins theme');
        assert.ok(lvl.pickups.some((pk) => pk.weapon === 'grapple'), 'N23 must include Grappling Hook pickup');
        assert.ok((lvl.grappleAnchors || []).length >= 8, 'N23 must include >= 8 grappleAnchors');
        assert.equal((lvl.templeAltars || []).length, 3, 'N23 must include 3 templeAltars');
        assert.ok(expandedDoors.some((d) => d.type === 'temple_altars'), 'N23 must lock exit behind temple_altars gate');
        assert.ok((lvl.fireGeysers || []).length >= 3, 'N23 must include fireGeysers');
        assert.ok((lvl.drones || []).length >= 2, 'N23 must include patrolling drones');
      }
      if (lvl.id === 24) {
        assert.equal(lvl.theme, 'jungle_jeep', 'N24 must use jungle_jeep theme');
        assert.ok(lvl.vehicles.some((v) => v.kind === 'jeep'), 'N24 must include playable Jeep 4x4');
        assert.ok((lvl.boostPads || []).length >= 5, 'N24 must include >= 5 turbo boostPads');
        assert.equal((lvl.raceCheckpoints || []).length, 3, 'N24 must include 3 raceCheckpoints');
        assert.equal((lvl.racePatrols || []).length, 2, 'N24 must include 2 rival hunter 4x4 trucks');
        assert.ok(expandedDoors.some((d) => d.type === 'jeep_race'), 'N24 must lock exit behind jeep_race gate');
      }
    }

    // Expanded exploration maps for N1-N9 & N11-N13 (>= 46x26 tiles)
    assert.ok(cols >= 46 && rows >= 26, `${lvl.code}: expanded exploration map expected >=46x26, got ${cols}x${rows}`);

    // Door mechanism variety checks per level specification:
    if (lvl.id === 0 || lvl.id === 3) {
      assert.ok(lvl.doors.some((d) => d.type === 'keycard' && d.keyColor === 'blue'), `${lvl.code}: blue keycard door required`);
      assert.ok(lvl.doors.some((d) => d.type === 'keycard' && d.keyColor === 'gold'), `${lvl.code}: gold keycard door required`);
    }
    if (lvl.id === 1 || lvl.id === 6) {
      assert.ok((lvl.switches || []).length >= 2, `${lvl.code}: >=2 energy switches required`);
      assert.ok(lvl.doors.some((d) => d.type === 'switches'), `${lvl.code}: switch-powered door required`);
    }
    if (lvl.id === 2 || lvl.id === 7) {
      assert.ok(lvl.doors.some((d) => d.type === 'hack'), `${lvl.code}: terminal hack door required`);
    }
    if (lvl.id === 4 || lvl.id === 5 || lvl.id === 8) {
      assert.ok((lvl.pressureButtons || []).length >= 1, `${lvl.code}: timed pressure button required`);
      assert.ok(lvl.doors.some((d) => d.type === 'timed'), `${lvl.code}: timed gate required`);
      assert.ok(lvl.doors.some((d) => d.type === 'keycard'), `${lvl.code}: guarded master keycard door required`);
    }

    // Mandatory active patrol verification on ALL guards
    const walkableNoDoors = (c: number, r: number) => {
      const ch = lvl.grid[r]?.[c];
      return ch !== undefined && !isStaticObstacleChar(ch) && ch !== 'D' && ch !== 'K';
    };

    for (const g of lvl.guards) {
      assert.ok(g.speed > 0 && g.waypoints.length >= 2, `${lvl.code}: Guard ${g.name} must actively move with >=2 waypoints`);
      const distinctWps = new Set(g.waypoints.map((w) => `${w.x},${w.y}`));
      assert.ok(distinctWps.size >= 2, `${lvl.code}: Guard ${g.name} must not have identical waypoints`);
      for (let i = 0; i < g.waypoints.length; i++) {
        const wp = g.waypoints[i];
        const nextWp = g.waypoints[(i + 1) % g.waypoints.length];
        assert.ok(
          walkableNoDoors(Math.floor(wp.x), Math.floor(wp.y)),
          `${lvl.code}: Guard ${g.name} waypoint (${wp.x},${wp.y}) must be walkable`
        );
        const step = findNextGridStep(
          Math.floor(wp.x),
          Math.floor(wp.y),
          Math.floor(nextWp.x),
          Math.floor(nextWp.y),
          cols,
          rows,
          walkableNoDoors
        );
        assert.ok(
          step !== null,
          `${lvl.code}: Guard ${g.name} must have clear path from (${wp.x},${wp.y}) to (${nextWp.x},${nextWp.y})`
        );
      }
    }

    // Objective protection check for every keycard, switch, and timed pressure button in N1-N9
    const isOpaqueAll = (c: number, r: number) => {
      const ch = lvl.grid[r]?.[c];
      return ch === undefined || ch === '#' || ch === 'R' || ch === 'G' || ch === 'H' || ch === 'X' || ch === 'D' || ch === 'K';
    };

    for (const pk of lvl.pickups) {
      if (pk.kind !== 'keycard') continue;
      assert.ok(
        isPointProtectedByHazard(pk.x * TILE_SIZE, pk.y * TILE_SIZE, lvl.guards, lvl.cameras, lvl.drones || [], TILE_SIZE, isOpaqueAll),
        `${lvl.code}: Keycard ${pk.label || pk.keyColor} at (${pk.x},${pk.y}) must be directly guarded by hazard`
      );
    }
    for (const sw of lvl.switches || []) {
      assert.ok(
        isPointProtectedByHazard(sw.x * TILE_SIZE, sw.y * TILE_SIZE, lvl.guards, lvl.cameras, lvl.drones || [], TILE_SIZE, isOpaqueAll),
        `${lvl.code}: Switch ${sw.label} at (${sw.x},${sw.y}) must be directly guarded by hazard`
      );
    }
    for (const pb of lvl.pressureButtons || []) {
      assert.ok(
        isPointProtectedByHazard(pb.x * TILE_SIZE, pb.y * TILE_SIZE, lvl.guards, lvl.cameras, lvl.drones || [], TILE_SIZE, isOpaqueAll),
        `${lvl.code}: Pressure button ${pb.label} at (${pb.x},${pb.y}) must be directly guarded by hazard`
      );
    }

    for (const tb of lvl.thermalBeacons || []) {
      assert.ok(
        isPointProtectedByHazard(tb.x * TILE_SIZE, tb.y * TILE_SIZE, lvl.guards, lvl.cameras, lvl.drones || [], TILE_SIZE, isOpaqueAll),
        `${lvl.code}: Thermal beacon ${tb.label} at (${tb.x},${tb.y}) must be directly guarded by hazard`
      );
    }
    for (const sn of lvl.sonarConsoles || []) {
      assert.ok(
        isPointProtectedByHazard(sn.x * TILE_SIZE, sn.y * TILE_SIZE, lvl.guards, lvl.cameras, lvl.drones || [], TILE_SIZE, isOpaqueAll),
        `${lvl.code}: Sonar console ${sn.label} at (${sn.x},${sn.y}) must be directly guarded by hazard`
      );
    }
    for (const cv of lvl.coolingValves || []) {
      assert.ok(
        isPointProtectedByHazard(cv.x * TILE_SIZE, cv.y * TILE_SIZE, lvl.guards, lvl.cameras, lvl.drones || [], TILE_SIZE, isOpaqueAll),
        `${lvl.code}: Cooling valve ${cv.label || cv.id} at (${cv.x},${cv.y}) must be directly guarded by hazard`
      );
    }

    // Simulate progressive door unlocks in dependency order
    const doorAt = new Map(expandedDoors.map((d) => [`${d.col},${d.row}`, d]));
    const opened = new Set<string>();
    const hasKey = new Set<string>();
    const collectedWeapons = new Set<string>();
    const pressedButtons = new Set<number>();
    const activeSwitches = new Set<number>();
    const litBeacons = new Set<number>();
    const openedCages = new Set<number>();
    const collectedCores = new Set<number>();
    const disabledSonars = new Set<number>();
    const activeCryoNodes = new Set<string>();
    const activeHarpoonLocks = new Set<string>();
    const activeCoolingValves = new Set<string>();
    const frozenFans = new Set<string>();
    const pulledLevers = new Set<string>();
    const loweredDrawbridges = new Set<string>();
    const convoyCardIds = new Set<string>();
    const disabledAntennas = new Set<string>();
    const activeAltars = new Set<string>();
    const unlockedGrappleOrigins: Array<{ x: number; y: number }> = [];
    const completedSubgames = new Set<string>();
    let harborRaceWon = false;

    const bridgeTileSet = new Set<string>();
    const canWalkNow = (c: number, r: number) => {
      const ch = lvl.grid[r]?.[c];
      if (ch === 'C' && bridgeTileSet.has(`${c},${r}`)) return true;
      if (isStaticObstacleChar(ch)) return false;
      if (ch === 'V' && !completedSubgames.has('magma_platforms')) return false;
      if (ch === 'D' || ch === 'K') return opened.has(`${c},${r}`);
      for (const fan of lvl.cryoFans || []) {
        if (!frozenFans.has(fan.id) && (fan.blockTiles || []).some((bt) => bt.col === c && bt.row === r)) {
          return false;
        }
      }
      return true;
    };

    const isReachable = (tx: number, ty: number) => {
      const origins = [{ x: startC, y: startR }, ...unlockedGrappleOrigins];
      return origins.some((orig) => findNextGridStep(orig.x, orig.y, tx, ty, cols, rows, canWalkNow) !== null);
    };

    let changed = true;
    while (changed) {
      changed = false;

      // Complete reachable subgames
      for (const sg of lvl.subgameZones || []) {
        if (!completedSubgames.has(sg.kind) && isReachable(Math.floor(sg.x), Math.floor(sg.y))) {
          completedSubgames.add(sg.kind);
          changed = true;
        }
      }

      // Pick up reachable keycards, convoy keycards, and gadgets
      for (const pk of lvl.pickups) {
        if (pk.kind === 'keycard' && pk.keyColor && !hasKey.has(pk.keyColor)) {
          if (isReachable(Math.floor(pk.x), Math.floor(pk.y))) {
            hasKey.add(pk.keyColor);
            changed = true;
          }
        }
        if (pk.kind === 'convoy_keycard' && pk.id && !convoyCardIds.has(pk.id)) {
          if (isReachable(Math.floor(pk.x), Math.floor(pk.y))) {
            convoyCardIds.add(pk.id);
            changed = true;
          }
        }
        if (pk.kind === 'gadget' && pk.weapon && !collectedWeapons.has(pk.weapon)) {
          if (isReachable(Math.floor(pk.x), Math.floor(pk.y))) {
            collectedWeapons.add(pk.weapon);
            changed = true;
          }
        }
      }

      // Activate reachable energy switches
      (lvl.switches || []).forEach((sw, idx) => {
        if (!activeSwitches.has(idx) && isReachable(Math.floor(sw.x), Math.floor(sw.y))) {
          activeSwitches.add(idx);
          changed = true;
        }
      });

      // Act V: light reachable thermal beacons (N11)
      (lvl.thermalBeacons || []).forEach((tb, idx) => {
        if (!litBeacons.has(idx) && isReachable(Math.floor(tb.x), Math.floor(tb.y))) {
          litBeacons.add(idx);
          changed = true;
        }
      });

      // Act V: open reachable prisoner cages (N12)
      (lvl.cages || []).forEach((cg, idx) => {
        if (!openedCages.has(idx) && isReachable(Math.floor(cg.x), Math.floor(cg.y))) {
          openedCages.add(idx);
          changed = true;
        }
      });

      // Act V: collect reachable geothermal cores (N13)
      (lvl.geothermalCores || []).forEach((gc, idx) => {
        if (!collectedCores.has(idx) && isReachable(Math.floor(gc.x), Math.floor(gc.y))) {
          collectedCores.add(idx);
          changed = true;
        }
      });

      // Act V: disable reachable sonar consoles (N14)
      (lvl.sonarConsoles || []).forEach((sn, idx) => {
        if (!disabledSonars.has(idx) && isReachable(Math.floor(sn.x), Math.floor(sn.y))) {
          disabledSonars.add(idx);
          changed = true;
        }
      });

      // Act V: activate reachable cooling valves (N15)
      for (const cv of lvl.coolingValves || []) {
        if (!activeCoolingValves.has(cv.id) && isReachable(Math.floor(cv.x), Math.floor(cv.y))) {
          activeCoolingValves.add(cv.id);
          changed = true;
        }
      }

      // Act V: activate reachable Cryo Nodes & Magnetic Locks (N16)
      for (const cn of lvl.cryoNodes || []) {
        if (!activeCryoNodes.has(cn.id) && isReachable(Math.floor(cn.x), Math.floor(cn.y))) {
          activeCryoNodes.add(cn.id);
          changed = true;
        }
      }
      for (const hl of lvl.harpoonLocks || []) {
        if (!activeHarpoonLocks.has(hl.id) && isReachable(Math.floor(hl.x), Math.floor(hl.y))) {
          activeHarpoonLocks.add(hl.id);
          changed = true;
        }
      }

      // Act V: N18 Cryo Fans (frozen by cryo_snow) & Magnetic Levers (pulled across crevasses with harpoon)
      if (collectedWeapons.has('cryo_snow')) {
        for (const fan of lvl.cryoFans || []) {
          if (frozenFans.has(fan.id)) continue;
          const fc = Math.floor(fan.x);
          const fr = Math.floor(fan.y);
          let approachClear = false;
          for (let dr = -4; dr <= 4 && !approachClear; dr++) {
            for (let dc = -5; dc <= 5 && !approachClear; dc++) {
              const ac = fc + dc;
              const ar = fr + dr;
              if (canWalkNow(ac, ar) && isReachable(ac, ar)) approachClear = true;
            }
          }
          if (approachClear) {
            frozenFans.add(fan.id);
            changed = true;
          }
        }
      }
      if (collectedWeapons.has('harpoon')) {
        for (const lv of lvl.magneticLevers || []) {
          if (pulledLevers.has(lv.id)) continue;
          const lc = Math.floor(lv.x);
          const lr = Math.floor(lv.y);
          let inHarpoonRange = false;
          for (let dr = -6; dr <= 6 && !inHarpoonRange; dr++) {
            for (let dc = -7; dc <= 7 && !inHarpoonRange; dc++) {
              if (Math.hypot(dc, dr) > 7.2) continue;
              const ac = lc + dc;
              const ar = lr + dr;
              if (canWalkNow(ac, ar) && isReachable(ac, ar)) inHarpoonRange = true;
            }
          }
          if (inHarpoonRange) {
            pulledLevers.add(lv.id);
            changed = true;
          }
        }
        for (const db of lvl.drawbridges || []) {
          if (loweredDrawbridges.has(db.id)) continue;
          const wc = Math.floor(db.winchX);
          const wr = Math.floor(db.winchY);
          let inRange = false;
          for (let dr = -5; dr <= 5 && !inRange; dr++) {
            for (let dc = -5; dc <= 5 && !inRange; dc++) {
              const ac = wc + dc;
              const ar = wr + dr;
              if (canWalkNow(ac, ar) && isReachable(ac, ar)) inRange = true;
            }
          }
          if (inRange) {
            loweredDrawbridges.add(db.id);
            for (const bt of db.tiles || []) bridgeTileSet.add(`${bt.col},${bt.row}`);
            changed = true;
          }
        }
      }

      // Press reachable timed buttons -> open timed doors
      (lvl.pressureButtons || []).forEach((pb, idx) => {
        if (!pressedButtons.has(idx) && isReachable(Math.floor(pb.x), Math.floor(pb.y))) {
          pressedButtons.add(idx);
          for (const d of lvl.doors) {
            if (d.type === 'timed' && !opened.has(`${d.col},${d.row}`)) {
              opened.add(`${d.col},${d.row}`);
              changed = true;
            }
          }
        }
      });

      // Subgame-linked doors unlock immediately once subgame is won
      if (completedSubgames.has('metro_circuits')) {
        for (const d of lvl.doors) {
          if (d.type === 'circuit' && !opened.has(`${d.col},${d.row}`)) {
            opened.add(`${d.col},${d.row}`);
            changed = true;
          }
        }
      }
      if (completedSubgames.has('snowmobile_tunnel')) {
        for (const d of lvl.doors) {
          if (d.type === 'master_generator' && !opened.has(`${d.col},${d.row}`)) {
            opened.add(`${d.col},${d.row}`);
            changed = true;
          }
        }
      }
      if (completedSubgames.has('magma_platforms')) {
        for (const d of lvl.doors) {
          if (d.type === 'thermal_shield' && !opened.has(`${d.col},${d.row}`)) {
            opened.add(`${d.col},${d.row}`);
            changed = true;
          }
        }
      }
      if (completedSubgames.has('glider_radar')) {
        for (const d of lvl.doors) {
          if (d.type === 'hangar' && !opened.has(`${d.col},${d.row}`)) {
            opened.add(`${d.col},${d.row}`);
            changed = true;
          }
        }
      }
      if (completedSubgames.has('icebreaker_boss')) {
        for (const d of lvl.doors) {
          if (d.type === 'boss_core' && !opened.has(`${d.col},${d.row}`)) {
            opened.add(`${d.col},${d.row}`);
            changed = true;
          }
        }
      }
      if (!harborRaceWon && (lvl.raceCheckpoints || []).length >= 3) {
        const hasReachableCart = lvl.vehicles.some(
          (v) => (v.kind === 'cart' || v.kind === 'jeep') && isReachable(Math.floor(v.x), Math.floor(v.y))
        );
        const allCheckpointsReachable = (lvl.raceCheckpoints || []).every((cp) =>
          isReachable(Math.floor(cp.x), Math.floor(cp.y))
        );
        if (hasReachableCart && allCheckpointsReachable) {
          harborRaceWon = true;
          changed = true;
        }
      }

      // Campaign 2: tropical antennas, temple altars & grapple anchors across abyss/magma
      for (const ta of lvl.tropicalAntennas || []) {
        if (!disabledAntennas.has(ta.id) && isReachable(Math.floor(ta.x), Math.floor(ta.y))) {
          disabledAntennas.add(ta.id);
          changed = true;
        }
      }
      for (const al of lvl.templeAltars || []) {
        if (!activeAltars.has(al.id) && isReachable(Math.floor(al.x), Math.floor(al.y))) {
          activeAltars.add(al.id);
          changed = true;
        }
      }
      if (collectedWeapons.has('grapple')) {
        for (const anchorA of lvl.grappleAnchors || []) {
          if (!isReachable(Math.floor(anchorA.x), Math.floor(anchorA.y))) continue;
          for (const anchorB of lvl.grappleAnchors || []) {
            if (anchorA === anchorB) continue;
            const distPx = Math.hypot((anchorB.x - anchorA.x) * TILE_SIZE, (anchorB.y - anchorA.y) * TILE_SIZE);
            if (distPx <= 390 && !isReachable(Math.floor(anchorB.x), Math.floor(anchorB.y))) {
              unlockedGrappleOrigins.push({ x: Math.floor(anchorB.x), y: Math.floor(anchorB.y) });
              changed = true;
            }
          }
        }
      }

      // Open reachable hack / lockpick / unlocked keycard / switches / Act V & Campaign 2 doors
      for (const d of expandedDoors) {
        const key = `${d.col},${d.row}`;
        if (opened.has(key)) continue;
        const adjWalkable = [
          [d.col + 1, d.row],
          [d.col - 1, d.row],
          [d.col, d.row + 1],
          [d.col, d.row - 1],
        ].some(([ac, ar]) => canWalkNow(ac, ar) && isReachable(ac, ar));

        if (!adjWalkable) continue;
        if (d.type === 'lockpick' || d.type === 'hack') {
          opened.add(key);
          changed = true;
        } else if (d.type === 'keycard' && d.keyColor && hasKey.has(d.keyColor)) {
          opened.add(key);
          changed = true;
        } else if (d.type === 'switches' && (lvl.switches || []).length > 0 && activeSwitches.size === (lvl.switches || []).length) {
          opened.add(key);
          changed = true;
        } else if (d.type === 'beacons' && (lvl.thermalBeacons || []).length > 0 && litBeacons.size === (lvl.thermalBeacons || []).length) {
          opened.add(key);
          changed = true;
        } else if (
          d.type === 'weight_rescue' &&
          (lvl.cages || []).length > 0 &&
          openedCages.size === (lvl.cages || []).length &&
          (lvl.weightPlates || []).every((wp) => isReachable(Math.floor(wp.x), Math.floor(wp.y)))
        ) {
          opened.add(key);
          changed = true;
        } else if (
          d.type === 'generator' &&
          lvl.centralGenerator &&
          collectedCores.size >= (lvl.centralGenerator.requiredCores || 3) &&
          isReachable(Math.floor(lvl.centralGenerator.x), Math.floor(lvl.centralGenerator.y))
        ) {
          opened.add(key);
          changed = true;
        } else if (d.type === 'sonar' && (lvl.sonarConsoles || []).length > 0 && disabledSonars.size === (lvl.sonarConsoles || []).length) {
          opened.add(key);
          changed = true;
        } else if (
          d.type === 'cooling_valves' &&
          (lvl.coolingValves || []).length > 0 &&
          areAllCoolingValvesActive((lvl.coolingValves || []).map((cv) => ({ activated: activeCoolingValves.has(cv.id) })))
        ) {
          opened.add(key);
          changed = true;
        } else if (
          d.type === 'cryo_lab_gate' &&
          areAllCryoLabSystemsCleared(
            (lvl.cryoFans || []).map((f) => ({ frozen: frozenFans.has(f.id) })),
            (lvl.magneticLevers || []).map((l) => ({ activated: pulledLevers.has(l.id) }))
          )
        ) {
          opened.add(key);
          changed = true;
        } else if (
          d.type === 'convoy_gate' &&
          isConvoyGateUnlocked(Array.from(convoyCardIds), 2)
        ) {
          opened.add(key);
          changed = true;
        } else if (
          (d.type === 'harbor_race' || d.type === 'jeep_race') &&
          isHarborRaceGateUnlocked(harborRaceWon)
        ) {
          opened.add(key);
          changed = true;
        } else if (
          d.type === 'tropical_antennas' &&
          areAllTropicalAntennasDisabled((lvl.tropicalAntennas || []).map((ta) => ({ disabled: disabledAntennas.has(ta.id) })))
        ) {
          opened.add(key);
          changed = true;
        } else if (
          d.type === 'temple_altars' &&
          areAllTempleAltarsActive((lvl.templeAltars || []).map((al) => ({ activated: activeAltars.has(al.id) })))
        ) {
          opened.add(key);
          changed = true;
        } else if (
          d.type === 'armored_fortress' &&
          typeof d.gateId === 'number' &&
          isFortressGateUnlocked(
            (lvl.cryoNodes || []).map((n) => ({ gateId: n.gateId, activated: activeCryoNodes.has(n.id) })),
            (lvl.harpoonLocks || []).map((l) => ({ gateId: l.gateId, activated: activeHarpoonLocks.has(l.id) })),
            d.gateId
          )
        ) {
          opened.add(key);
          changed = true;
        }
      }
    }

    for (const pk of lvl.pickups) {
      assert.ok(isReachable(Math.floor(pk.x), Math.floor(pk.y)), `${lvl.code}: Pickup at (${pk.x},${pk.y}) must be reachable`);
    }
    for (const v of lvl.vehicles) {
      assert.ok(isReachable(Math.floor(v.x), Math.floor(v.y)), `${lvl.code}: Vehicle ${v.kind} at (${v.x},${v.y}) must be reachable`);
    }
    for (const cp of lvl.raceCheckpoints || []) {
      assert.ok(isReachable(Math.floor(cp.x), Math.floor(cp.y)), `${lvl.code}: Race checkpoint ${cp.id} at (${cp.x},${cp.y}) must be reachable`);
    }
    for (const sw of lvl.switches || []) {
      assert.ok(isReachable(Math.floor(sw.x), Math.floor(sw.y)), `${lvl.code}: Switch ${sw.label} must be reachable`);
    }
    for (const pb of lvl.pressureButtons || []) {
      assert.ok(isReachable(Math.floor(pb.x), Math.floor(pb.y)), `${lvl.code}: Timed button ${pb.label} must be reachable`);
    }
    for (const sg of lvl.subgameZones || []) {
      assert.ok(isReachable(Math.floor(sg.x), Math.floor(sg.y)), `${lvl.code}: Subgame zone ${sg.label} must be reachable`);
    }
    for (const tb of lvl.thermalBeacons || []) {
      assert.ok(isReachable(Math.floor(tb.x), Math.floor(tb.y)), `${lvl.code}: Beacon ${tb.label} must be reachable`);
    }
    for (const cg of lvl.cages || []) {
      assert.ok(isReachable(Math.floor(cg.x), Math.floor(cg.y)), `${lvl.code}: Cage ${cg.label} must be reachable`);
    }
    for (const gc of lvl.geothermalCores || []) {
      assert.ok(isReachable(Math.floor(gc.x), Math.floor(gc.y)), `${lvl.code}: Geothermal core ${gc.label} must be reachable`);
    }

    let exitFound = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (lvl.grid[r][c] === 'E') {
          exitFound = true;
          assert.ok(isReachable(c, r), `${lvl.code}: Exit tile at (${c},${r}) must be reachable after unlocking doors (${doorAt.size} doors)`);
        }
      }
    }
    assert.ok(exitFound, `${lvl.code}: must contain an exit tile E`);
  }
});

test('Level 3 Shark Race applies Level-10 2-hit stamina & 50% speed penalty', () => {
  const first = applySharkObstacleImpact(100);
  assert.equal(first.staminaHp, 50);
  assert.equal(first.slowTimer, 2.8);
  assert.equal(first.defeated, false);

  const second = applySharkObstacleImpact(first.staminaHp);
  assert.equal(second.staminaHp, 0);
  assert.equal(second.slowTimer, 2.8);
  assert.equal(second.defeated, true);
});

test('Level 3 Shark Race swim speed responds to boost rings, vertical control, and 50% slow', () => {
  const base = getSharkRaceSwimSpeed(228, 0, 0, 0);
  const surging = getSharkRaceSwimSpeed(228, 0, 0, -1);
  const braking = getSharkRaceSwimSpeed(228, 0, 0, 1);
  const boosted = getSharkRaceSwimSpeed(228, 1.2, 0, 0);
  const slowed = getSharkRaceSwimSpeed(228, 0, 2.0, 0);

  assert.ok(surging > base);
  assert.ok(braking < base);
  assert.ok(boosted > base + 100);
  assert.equal(slowed, base * 0.5);
});

test('Level 3 Shark Race evaluates 20s win, 2-hit defeat, shark catch, and timeout accurately', () => {
  assert.equal(evaluateSharkRaceOutcome(12.0, 2200, 1900, 4250, 100), 'playing');
  assert.equal(evaluateSharkRaceOutcome(3.5, 4260, 3900, 4250, 50), 'won');
  assert.equal(evaluateSharkRaceOutcome(10.0, 2100, 1900, 4250, 0), 'lost_hits');
  assert.equal(evaluateSharkRaceOutcome(8.0, 2100, 2090, 4250, 100), 'lost_caught');
  assert.equal(evaluateSharkRaceOutcome(0, 4050, 3800, 4250, 100), 'lost_timeout');
});

test('Level 3 Shark Race distributes cyan boost rings evenly across left, center, and right thirds of channel', () => {
  const channelLeft = 44;
  const channelRight = 396;
  const width = channelRight - channelLeft;
  const { obstacles, boostRings } = generateSharkRaceTrack(4250, channelLeft, channelRight);
  const kinds = new Set(obstacles.map((o) => o.kind));
  assert.ok(kinds.has('coral'));
  assert.ok(kinds.has('structure'));
  assert.ok(kinds.has('mine'));
  assert.ok(kinds.has('turbulence'));
  assert.ok(obstacles.some((o) => o.moveAmp > 0), 'Should include moving mines/currents');
  assert.ok(boostRings.length >= 6, 'Should include balanced cyan speed boost rings');
  for (const o of obstacles) {
    assert.ok(o.baseX - o.moveAmp >= channelLeft && o.baseX + o.moveAmp <= channelRight, `Obstacle ${o.id} stays inside channel`);
  }

  let leftCount = 0;
  let centerCount = 0;
  let rightCount = 0;
  for (const r of boostRings) {
    assert.ok(r.x >= channelLeft + 34 && r.x <= channelRight - 34, `Ring ${r.id} inside channel bounds`);
    const rel = (r.x - channelLeft) / width;
    if (rel < 0.34) leftCount++;
    else if (rel <= 0.66) centerCount++;
    else rightCount++;
  }
  assert.ok(leftCount >= 2, `Expected >=2 left-third rings, got ${leftCount}`);
  assert.ok(centerCount >= 2, `Expected >=2 center-third rings, got ${centerCount}`);
  assert.ok(rightCount >= 2, `Expected >=2 right-third rings, got ${rightCount}`);
});

test('Level 3 Horizontal Shark Tunnel generates bounded obstacles, currents, corals, and boost rings across vertical lanes', () => {
  const topWall = 62;
  const botWall = 378;
  const tunnelH = botWall - topWall;
  const { obstacles, boostRings, corals } = generateSharkTunnelCourse(240, 3600, topWall, botWall);

  const kinds = new Set(obstacles.map((o) => o.kind));
  assert.ok(kinds.has('jellyfish'), 'Tunnel should contain neon jellyfish obstacles');
  assert.ok(kinds.has('rock'), 'Tunnel should contain rocky obstacles');
  assert.ok(kinds.has('current'), 'Tunnel should contain underwater currents');
  assert.ok(corals.length >= 15 && corals.some((c) => c.top) && corals.some((c) => !c.top), 'Tunnel should contain top and bottom corals');
  assert.ok(boostRings.length >= 4, 'Tunnel should contain cyan boost rings');

  for (const o of obstacles) {
    assert.ok(
      o.baseY - o.moveAmp >= topWall && o.baseY + o.moveAmp <= botWall,
      `Tunnel obstacle ${o.id} (${o.kind}) remains inside tunnel walls`
    );
  }

  let topCount = 0;
  let midCount = 0;
  let botCount = 0;
  for (const r of boostRings) {
    assert.ok(r.y >= topWall + 30 && r.y <= botWall - 30, `Boost ring ${r.id} stays inside tunnel walls`);
    const rel = (r.y - topWall) / tunnelH;
    if (rel < 0.34) topCount++;
    else if (rel <= 0.66) midCount++;
    else botCount++;
  }
  assert.ok(topCount >= 1 && midCount >= 1 && botCount >= 1, 'Boost rings cover top, center, and bottom tunnel lanes');
});

test('Level 3 Horizontal Shark Tunnel evaluates playing, caught, and finish-line victory outcomes', () => {
  assert.equal(evaluateHorizontalSharkRaceOutcome(1200, 950, 3600), 'playing');
  assert.equal(evaluateHorizontalSharkRaceOutcome(1200, 1180, 3600), 'caught');
  assert.equal(evaluateHorizontalSharkRaceOutcome(3605, 3250, 3600), 'won');
});

test('Level 5 Metro Train generates pipes, electric arcs, and drones bounded to train roof', () => {
  const trainLeft = 100;
  const trainRight = 380;
  const obs = generateMetroTrainCourse(3000, trainLeft, trainRight);
  const kinds = new Set(obs.map((o) => o.kind));
  assert.ok(kinds.has('pipe'), 'Train roof course should include low pipes');
  assert.ok(kinds.has('arc'), 'Train roof course should include electric arcs');
  assert.ok(kinds.has('drone'), 'Train roof course should include sweeping drones');
  for (const o of obs) {
    assert.ok(o.baseX - o.moveAmp >= trainLeft && o.baseX + o.moveAmp <= trainRight, `Obstacle ${o.id} stays on train roof`);
    assert.equal(o.jumpable, true);
  }
  assert.equal(evaluateMetroTrainOutcome(1200, 3000, 3), 'playing');
  assert.equal(evaluateMetroTrainOutcome(3020, 3000, 2), 'won');
  assert.equal(evaluateMetroTrainOutcome(1500, 3000, 0), 'lost');
});

test('Level 7 Conveyor Gauntlet generates multi-directional belts, crates, lasers, and checks platform fall/goal bounds', () => {
  const { conveyors, crates, lasers } = generateConveyorGauntlet(80, 1040, 90, 410);
  assert.ok(conveyors.length >= 6);
  assert.ok(conveyors.some((c) => c.vx < 0) && conveyors.some((c) => c.vx > 0) && conveyors.some((c) => Math.abs(c.vy) > 0));
  assert.ok(crates.length >= 3);
  assert.ok(lasers.length >= 2);
  assert.equal(isInsidePlatformBounds(500, 250, 80, 1040, 90, 410), true);
  assert.equal(isInsidePlatformBounds(50, 250, 80, 1040, 90, 410), false);
  assert.equal(evaluateConveyorGauntletOutcome(500, 250, 980, 250, 36, 80, 1040, 90, 410), 'playing');
  assert.equal(evaluateConveyorGauntletOutcome(970, 250, 980, 250, 36, 80, 1040, 90, 410), 'won');
  assert.equal(evaluateConveyorGauntletOutcome(500, 430, 980, 250, 36, 80, 1040, 90, 410), 'fell');
});

test('Level 9 Captain Boss Battle reflects enemy electric-net shots back at Captain and tracks 3-hit victory', () => {
  const proj = { id: 1, x: 240, y: 310, vx: -120, vy: 210, radius: 12, fromBoss: true, reflected: false };
  assert.equal(reflectBossProjectile(proj, 500, 310, 620, 110, 74, 480), false);
  assert.equal(reflectBossProjectile(proj, 265, 325, 620, 110, 74, 480), true);
  assert.equal(proj.fromBoss, false);
  assert.equal(proj.reflected, true);
  assert.ok(proj.vx > 0 && proj.vy < 0, 'Reflected net must aim straight toward Captain');
  assert.equal(evaluateBossBattleOutcome(3, 3), 'playing');
  assert.equal(evaluateBossBattleOutcome(0, 2), 'won');
  assert.equal(evaluateBossBattleOutcome(2, 0), 'lost');
});

test('persistent save uses escape_antartida_save_v1, keeps all 25 levels unlocked, migrates legacy saves, and unlocks Expert Mode on N20 completion', () => {
  assert.equal(SAVE_STORAGE_KEY, 'escape_antartida_save_v1');
  assert.equal(LEGACY_PROGRESS_STORAGE_KEY, 'operacion_antartida_progress_v1');
  assert.equal(TOTAL_CAMPAIGN_LEVELS, 25);
  assert.equal(DEFAULT_MIN_UNLOCKED_IDX, 24);

  const def = createDefaultCampaignSave();
  assert.equal(def.maxUnlockedIdx, 24);
  assert.equal(def.completed.length, 25);
  assert.equal(def.expertModeUnlocked, false);
  assert.equal(def.expertModeEnabled, false);

  const legacyOnly = parseCampaignSave(null, JSON.stringify({ completed: [true, true, true], maxUnlockedIdx: 3, selectedIdx: 2 }));
  assert.equal(legacyOnly.completed[0], true);
  assert.equal(legacyOnly.completed[2], true);
  assert.equal(legacyOnly.maxUnlockedIdx, 24);
  assert.equal(legacyOnly.selectedIdx, 2);

  const updated = recordLevelCompletionSave(def, 19, 68.42, 0, 7, [{ type: 'cryo_snow', ammo: 8 }]);
  assert.equal(updated.completed[19], true);
  assert.equal(updated.maxUnlockedIdx, 24);
  assert.equal(updated.expertModeUnlocked, true);
  assert.equal(updated.records['20']?.bestTimeSec, 68.4);
  assert.equal(updated.records['20']?.minAlerts, 0);
  assert.equal(updated.records['20']?.maxStunned, 7);
  assert.ok(updated.weapons.unlocked.includes('cryo_snow'));
  assert.deepEqual(updated.weapons.loadout, [{ type: 'cryo_snow', ammo: 8 }]);
});

test('N3 fishOnly armored drones reject darts and allow fish / cryo_snow stuns', () => {
  assert.equal(canWeaponStunDrone('dart', false), true);
  assert.equal(canWeaponStunDrone('dart', true), false);
  assert.equal(canWeaponStunDrone('fish', true), true);
  assert.equal(canWeaponStunDrone('cryo_snow', true), true);
});

test('Act V mechanics: cyclical snowstorms, thermal beacons, crevasse falls, magnetic harpoon pull, 4-penguin weight plates, and generator power', () => {
  assert.ok(getSnowstormIntensity(2.0) < 0.2);
  assert.ok(getSnowstormIntensity(10.0) > 0.5);
  assert.equal(areAllBeaconsLit([{ lit: true }, { lit: false }, { lit: true }]), false);
  assert.equal(areAllBeaconsLit([{ lit: true }, { lit: true }, { lit: true }]), true);

  const testGrid = ['...', '.C.', '...'];
  assert.equal(isCrevasseFall(testGrid, 72, 72, 48, 11), true);
  assert.equal(isCrevasseFall(testGrid, 50, 72, 48, 11), false);
  assert.equal(isCrevasseFall(testGrid, 24, 24, 48, 11), false);

  const pulled = findHarpoonPullTarget(
    100,
    100,
    0,
    [
      { id: 'far', px: 500, py: 100 },
      { id: 'behind', px: 20, py: 100 },
      { id: 'front', px: 240, py: 108 },
    ],
    300
  );
  assert.equal(pulled?.id, 'front');

  const plates = [
    { px: 100, py: 100 },
    { px: 200, py: 100 },
    { px: 100, py: 200 },
    { px: 200, py: 200 },
  ];
  const allies = [
    { x: 200, y: 105 },
    { x: 102, y: 198 },
    { x: 198, y: 202 },
  ];
  assert.equal(countActiveWeightPlates(102, 102, allies, plates), 4);
  assert.equal(countActiveWeightPlates(350, 350, allies, plates), 3);

  assert.equal(isGeneratorFullyPowered(2, 3), false);
  assert.equal(isGeneratorFullyPowered(3, 3), true);
});

test('N13 Snowmobile Tunnel generates drills, ice blocks, poachers, boost gates and evaluates 25s outcomes', () => {
  const { obstacles, boostGates } = generateSnowmobileTunnelCourse(240, 5200, 62, 378);
  const kinds = new Set(obstacles.map((o) => o.kind));
  assert.ok(kinds.has('drill'));
  assert.ok(kinds.has('ice_block'));
  assert.ok(kinds.has('poacher'));
  assert.ok(boostGates.length >= 5);
  for (const o of obstacles) {
    assert.ok(o.baseY - o.moveAmp >= 62 && o.baseY + o.moveAmp <= 378);
  }
  assert.equal(evaluateSnowmobileTunnelOutcome(12.0, 2400, 5200, 3), 'playing');
  assert.equal(evaluateSnowmobileTunnelOutcome(5.0, 5210, 5200, 1), 'won');
  assert.equal(evaluateSnowmobileTunnelOutcome(10.0, 2400, 5200, 0), 'lost_hits');
  assert.equal(evaluateSnowmobileTunnelOutcome(0, 4900, 5200, 2), 'lost_timeout');
});

test('N14 Sonar, N15 Volcano Magma & Thermal Shield, and N16 Dual-Gadget Armored Gates behave accurately', () => {
  assert.equal(areAllSonarDisabled([{ disabled: true }, { disabled: false }, { disabled: true }]), false);
  assert.equal(areAllSonarDisabled([{ disabled: true }, { disabled: true }, { disabled: true }]), true);

  assert.equal(canCrossVolcanicHeat('L', true), false);
  assert.equal(canCrossVolcanicHeat('V', false), false);
  assert.equal(canCrossVolcanicHeat('V', true), true);
  assert.equal(canCrossVolcanicHeat('.', false), true);

  const { platforms, eruptions } = generateMagmaPlatformCourse(100, 1040, 260);
  assert.ok(platforms.length >= 5);
  assert.ok(eruptions.length >= 3);
  assert.equal(evaluateMagmaPlatformOutcome(500, 1040, 2, false), 'playing');
  assert.equal(evaluateMagmaPlatformOutcome(1050, 1040, 1, false), 'won');
  assert.equal(evaluateMagmaPlatformOutcome(500, 1040, 2, true), 'lost');
  assert.equal(evaluateMagmaPlatformOutcome(500, 1040, 0, false), 'lost');

  const cryoNodes = [{ gateId: 1, activated: true }, { gateId: 2, activated: true }];
  const harpoonLocks = [{ gateId: 1, activated: false }, { gateId: 2, activated: true }];
  assert.equal(isFortressGateUnlocked(cryoNodes, harpoonLocks, 1), false);
  assert.equal(isFortressGateUnlocked(cryoNodes, harpoonLocks, 2), true);
});

test('N15 Cooling Valves & Fire Geysers, N17 Glider Radar Course, N18 Cryo Lab Systems, and N19 Convoy Wind & Laser Turrets', () => {
  assert.equal(areAllCoolingValvesActive([]), false);
  assert.equal(areAllCoolingValvesActive([{ activated: true }, { activated: false }]), false);
  assert.equal(areAllCoolingValvesActive([{ activated: true }, { activated: true }]), true);

  const geyserActive = isFireGeyserActive(0.4, 0, 1.25, 3.2);
  const geyserWarn = isFireGeyserActive(2.8, 0, 1.25, 3.2);
  const geyserCalm = isFireGeyserActive(1.8, 0, 1.25, 3.2);
  assert.equal(geyserActive.active, true);
  assert.equal(geyserWarn.warning, true);
  assert.equal(geyserCalm.active, false);
  assert.equal(geyserCalm.warning, false);

  const glider = generateGliderRadarCourse(160, 4600, 64, 376);
  assert.equal(glider.towers.length, 3);
  assert.ok(glider.hazards.some((h) => h.kind === 'wind_gust'));
  assert.ok(glider.hazards.some((h) => h.kind === 'flare'));
  assert.ok(glider.boostRings.length >= 4);
  for (const h of glider.hazards) {
    assert.ok(h.baseY - h.moveAmp >= 64 && h.baseY + h.moveAmp <= 376, `Glider hazard ${h.id} stays inside sky bounds`);
  }
  assert.equal(evaluateGliderRadarOutcome(12.0, 2, 3, 2), 'playing');
  assert.equal(evaluateGliderRadarOutcome(8.0, 3, 3, 2), 'won');
  assert.equal(evaluateGliderRadarOutcome(10.0, 1, 3, 0), 'lost_hits');
  assert.equal(evaluateGliderRadarOutcome(0, 2, 3, 2), 'lost_timeout');

  assert.equal(areAllCryoLabSystemsCleared([{ frozen: true }], [{ activated: false }]), false);
  assert.equal(areAllCryoLabSystemsCleared([{ frozen: true }, { frozen: true }], [{ activated: true }, { activated: true }]), true);

  const wind0 = getGlacierConvoyWindPush(0.5);
  assert.ok(wind0.vx < 0);
  assert.ok(Number.isFinite(wind0.vy));

  const turretOn = isTurretLaserFiring(0.3, 0, 1.4, 3.4);
  const turretWarn = isTurretLaserFiring(3.0, 0, 1.4, 3.4);
  assert.equal(turretOn.active, true);
  assert.equal(turretWarn.active, false);
  assert.equal(turretWarn.warning, true);
});

test('N19 convoy keycards, N20 burning steam & Mecha Spider Boss phases, and Expert Mode +28% speed scale accurately', () => {
  assert.equal(getExpertEnemySpeedMultiplier(false), 1.0);
  assert.equal(getExpertEnemySpeedMultiplier(true), 1.28);

  assert.equal(isConvoyGateUnlocked(['l19-card-1'], 2), false);
  assert.equal(isConvoyGateUnlocked(['l19-card-1', 'l19-card-1'], 2), false);
  assert.equal(isConvoyGateUnlocked(['l19-card-1', 'l19-card-2'], 2), true);

  assert.equal(canCrossBurningSteam(false), false);
  assert.equal(canCrossBurningSteam(true), true);

  assert.equal(getIcebreakerBossPhase(100, 100), 'A');
  assert.equal(getIcebreakerBossPhase(66, 100), 'A');
  assert.equal(getIcebreakerBossPhase(65, 100), 'B');
  assert.equal(getIcebreakerBossPhase(31, 100), 'B');
  assert.equal(getIcebreakerBossPhase(30, 100), 'C');
  assert.equal(getIcebreakerBossPhase(5, 100), 'C');

  assert.equal(evaluateIcebreakerBossOutcome(45, 3), 'playing');
  assert.equal(evaluateIcebreakerBossOutcome(0, 2), 'won');
  assert.equal(evaluateIcebreakerBossOutcome(25, 0), 'lost');
});

test('Level 6 Harbor Race tracks sequential 3-checkpoint progress, rival patrol & damage loss, gate unlock, and arcade cart drift', () => {
  const cps = [
    { id: 'cp1', x: 3960, y: 1752, radius: 74, reached: false },
    { id: 'cp2', x: 4248, y: 312, radius: 74, reached: false },
    { id: 'cp3', x: 2712, y: 720, radius: 74, reached: false },
  ];

  // Stepping into cp2 out of order does not advance progress
  const outOfOrder = evaluateHarborCheckpointStep(4248, 312, 'cart', cps, 0);
  assert.equal(outOfOrder.capturedIdx, null);
  assert.equal(outOfOrder.nextIdx, 0);

  // Foot player cannot capture checkpoint; Cart does
  const onFoot = evaluateHarborCheckpointStep(3960, 1752, 'none', cps, 0);
  assert.equal(onFoot.capturedIdx, null);

  const step1 = evaluateHarborCheckpointStep(3960, 1752, 'cart', cps, 0);
  assert.equal(step1.capturedIdx, 0);
  assert.equal(step1.nextIdx, 1);
  assert.equal(step1.completedAll, false);

  const step2 = evaluateHarborCheckpointStep(4248, 312, 'cart', cps, step1.nextIdx);
  assert.equal(step2.capturedIdx, 1);
  assert.equal(step2.nextIdx, 2);

  const step3 = evaluateHarborCheckpointStep(2712, 720, 'cart', cps, step2.nextIdx);
  assert.equal(step3.capturedIdx, 2);
  assert.equal(step3.nextIdx, 3);
  assert.equal(step3.completedAll, true);

  assert.equal(evaluateHarborRaceOutcome(false, false, false), 'racing');
  assert.equal(evaluateHarborRaceOutcome(true, false, false), 'won');
  assert.equal(evaluateHarborRaceOutcome(false, true, false), 'lost_rival');
  assert.equal(evaluateHarborRaceOutcome(true, false, true), 'lost_wrecked');

  assert.equal(isHarborRaceGateUnlocked(false), false);
  assert.equal(isHarborRaceGateUnlocked(true), true);

  // Arcade cart drift maintains forward inertia while turning smoothly and boosts under turbo
  const straight = stepArcadeCartVelocity(395, 0, 0, 1, 0, 395, 1650, 1 / 60);
  assert.ok(straight.vx > 380);
  assert.ok(straight.slipSpeed < 5);

  const cornerTurn = stepArcadeCartVelocity(395, 0, 0, 0, 1, 395, 1650, 1 / 60);
  assert.ok(cornerTurn.vy > 0 && cornerTurn.vx > 200, 'Cart carries forward momentum into corner drift');
  assert.ok(cornerTurn.slipSpeed > 20, 'Corner turn induces controlled lateral drift slip');

  const turboTurn = stepArcadeCartVelocity(395, 0, 0, 1, 0, 505, 2200, 0.25);
  assert.ok(turboTurn.vx > 450, 'Turbo accelerates cart beyond base 395 px/s');
});

test('Campaign 2 Volcanic Island helpers: camouflage, grapple anchors, antennas, altars, jeep race, submarine currents & speeds', () => {
  assert.equal(getSpeedMultiplier('jeep', false), 2.55);
  assert.equal(getSpeedMultiplier('jeep', true), 3.25);
  assert.equal(getSpeedMultiplier('submarine', false), 2.3);
  assert.equal(getSpeedMultiplier('submarine', true), 3.1);

  for (const theme of ['tropical_beach', 'biolum_jungle', 'volcano_ruins', 'jungle_jeep', 'volcano_caves_sub']) {
    assert.equal(getMusicThemeForLevel(theme), 'volcanic_island', `${theme} maps to volcanic_island music`);
  }

  assert.equal(isPlayerHiddenByCamouflage(0), false);
  assert.equal(isPlayerHiddenByCamouflage(4.2), true);

  const bestAnchor = findGrappleAnchorTarget(100, 100, 0, [
    { id: 'behind', px: 20, py: 100 },
    { id: 'too_far', px: 600, py: 100 },
    { id: 'target', px: 290, py: 105 },
  ]);
  assert.equal(bestAnchor?.id, 'target');

  assert.equal(areAllTropicalAntennasDisabled([]), false);
  assert.equal(areAllTropicalAntennasDisabled([{ disabled: true }, { disabled: false }]), false);
  assert.equal(areAllTropicalAntennasDisabled([{ disabled: true }, { disabled: true }]), true);

  assert.equal(areAllTempleAltarsActive([]), false);
  assert.equal(areAllTempleAltarsActive([{ activated: true }, { activated: false }]), false);
  assert.equal(areAllTempleAltarsActive([{ activated: true }, { activated: true }]), true);

  const curOut = getBubbleCurrentForce(500, 500, [{ px: 100, py: 100, radius: 130, vx: 140, vy: -50 }], 1.0);
  assert.equal(curOut.x, 0);
  assert.equal(curOut.y, 0);
  const curIn = getBubbleCurrentForce(110, 100, [{ px: 100, py: 100, radius: 130, vx: 140, vy: -50 }], 1.0);
  assert.ok(curIn.x > 60 && curIn.y < -20);

  const jeepCp = evaluateHarborCheckpointStep(400, 400, 'jeep', [{ id: 'jp1', x: 400, y: 400, radius: 80, reached: false }], 0);
  assert.equal(jeepCp.capturedIdx, 0);
  assert.equal(jeepCp.completedAll, true);

  assert.equal(evaluateJeepRaceOutcome(false, false, false), 'racing');
  assert.equal(evaluateJeepRaceOutcome(true, false, false), 'won');
  assert.equal(evaluateJeepRaceOutcome(false, true, false), 'lost_rival');
  assert.equal(evaluateJeepRaceOutcome(true, false, true), 'lost_wrecked');
});





