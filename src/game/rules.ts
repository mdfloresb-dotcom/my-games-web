export interface Vec2 {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TILE_SIZE = 48;

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function angleDiff(a: number, b: number): number {
  return normalizeAngle(a - b);
}

/**
 * Resolves circle vs tile-grid AABB collisions with smooth wall sliding.
 * Checks a 3x3 neighborhood of tiles around the circle and pushes out along
 * the minimum penetration vector.
 */
export function resolveCircleGridCollision(
  x: number,
  y: number,
  radius: number,
  tileSize: number,
  isSolid: (col: number, row: number) => boolean
): Vec2 {
  let cx = x;
  let cy = y;

  for (let pass = 0; pass < 2; pass++) {
    const minCol = Math.floor((cx - radius) / tileSize) - 1;
    const maxCol = Math.floor((cx + radius) / tileSize) + 1;
    const minRow = Math.floor((cy - radius) / tileSize) - 1;
    const maxRow = Math.floor((cy + radius) / tileSize) + 1;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (!isSolid(col, row)) continue;

        const rx = col * tileSize;
        const ry = row * tileSize;
        const closestX = clamp(cx, rx, rx + tileSize);
        const closestY = clamp(cy, ry, ry + tileSize);
        const dx = cx - closestX;
        const dy = cy - closestY;
        const distSq = dx * dx + dy * dy;

        if (distSq < radius * radius) {
          const dist = Math.sqrt(distSq);
          if (dist > 0.0001) {
            const overlap = radius - dist;
            cx += (dx / dist) * overlap;
            cy += (dy / dist) * overlap;
          } else {
            // Center is inside tile; push out along shortest axis
            const leftPen = cx - rx;
            const rightPen = rx + tileSize - cx;
            const topPen = cy - ry;
            const bottomPen = ry + tileSize - cy;
            const minPen = Math.min(leftPen, rightPen, topPen, bottomPen);
            if (minPen === leftPen) cx = rx - radius;
            else if (minPen === rightPen) cx = rx + tileSize + radius;
            else if (minPen === topPen) cy = ry - radius;
            else cy = ry + tileSize + radius;
          }
        }
      }
    }
  }

  return { x: cx, y: cy };
}

/**
 * Casts a ray through a tile grid using fine stepping and returns hit distance.
 */
export function castGridRay(
  ox: number,
  oy: number,
  angle: number,
  maxDist: number,
  tileSize: number,
  isOpaque: (col: number, row: number) => boolean,
  stepSize = 6
): number {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let dist = 0;
  while (dist < maxDist) {
    dist = Math.min(maxDist, dist + stepSize);
    const px = ox + cos * dist;
    const py = oy + sin * dist;
    const col = Math.floor(px / tileSize);
    const row = Math.floor(py / tileSize);
    if (isOpaque(col, row)) {
      // Binary refine hit edge for clean visual cones
      let lo = Math.max(0, dist - stepSize);
      let hi = dist;
      for (let i = 0; i < 4; i++) {
        const mid = (lo + hi) * 0.5;
        const mc = Math.floor((ox + cos * mid) / tileSize);
        const mr = Math.floor((oy + sin * mid) / tileSize);
        if (isOpaque(mc, mr)) hi = mid;
        else lo = mid;
      }
      return hi;
    }
  }
  return maxDist;
}

/**
 * Checks whether a target point is inside a vision cone and not occluded by walls.
 */
export function isPointInVisionCone(
  px: number,
  py: number,
  ox: number,
  oy: number,
  dir: number,
  halfFov: number,
  range: number,
  tileSize: number,
  isOpaque: (col: number, row: number) => boolean
): boolean {
  const dx = px - ox;
  const dy = py - oy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist < 4) return true;

  const angleToTarget = Math.atan2(dy, dx);
  if (Math.abs(angleDiff(angleToTarget, dir)) > halfFov) return false;

  const rayDist = castGridRay(ox, oy, angleToTarget, dist, tileSize, isOpaque, 6);
  return rayDist >= dist - 4;
}

/**
 * Evaluates a lockpick timing strike.
 */
export function evaluateLockpickHit(
  cursorPos: number,
  zoneStart: number,
  zoneEnd: number
): 'hit' | 'miss' {
  return cursorPos >= zoneStart && cursorPos <= zoneEnd ? 'hit' : 'miss';
}

/**
 * Computes next BFS tile step from start (sc, sr) toward goal (gc, gr) on walkable grid.
 */
export function findNextGridStep(
  sc: number,
  sr: number,
  gc: number,
  gr: number,
  cols: number,
  rows: number,
  isWalkable: (col: number, row: number) => boolean
): { col: number; row: number } | null {
  if (sc === gc && sr === gr) return { col: gc, row: gr };
  if (gc < 0 || gc >= cols || gr < 0 || gr >= rows) return null;

  const total = cols * rows;
  const visited = new Uint8Array(total);
  const parent = new Int32Array(total).fill(-1);
  const queue: number[] = [];

  const startIdx = sr * cols + sc;
  const goalIdx = gr * cols + gc;
  visited[startIdx] = 1;
  queue.push(startIdx);

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  let found = false;
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    if (curr === goalIdx) {
      found = true;
      break;
    }
    const c = curr % cols;
    const r = Math.floor(curr / cols);
    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const nIdx = nr * cols + nc;
      if (visited[nIdx]) continue;
      if (!isWalkable(nc, nr) && nIdx !== goalIdx) continue;
      visited[nIdx] = 1;
      parent[nIdx] = curr;
      queue.push(nIdx);
    }
  }

  if (!found) return null;

  let step = goalIdx;
  while (parent[step] !== -1 && parent[step] !== startIdx) {
    step = parent[step];
  }
  return { col: step % cols, row: Math.floor(step / cols) };
}

export type VehicleType = 'none' | 'skateboard' | 'cart' | 'moto' | 'boat';

export function getSpeedMultiplier(vehicle: VehicleType, turboActive = false): number {
  if (vehicle === 'skateboard') return 1.75;
  if (vehicle === 'cart') return 2.1;
  if (vehicle === 'moto') return turboActive ? 3.35 : 2.4;
  if (vehicle === 'boat') return turboActive ? 3.1 : 2.25;
  return 1.0;
}

/**
 * Evaluates a 2.5s ON / 2.5s OFF security laser cycle.
 */
export function isLaserActiveAtTime(elapsedSec: number, phaseOffset = 0, intervalSec = 2.5): boolean {
  const period = intervalSec * 2;
  const t = (((elapsedSec + phaseOffset) % period) + period) % period;
  return t < intervalSec;
}

/**
 * Evaluates a timed steam pipe hazard cycle (active -> cooldown -> amber warning).
 */
export function getSteamCyclePhase(
  elapsedSec: number,
  phaseOffset = 0,
  activeDuration = 1.5,
  cyclePeriod = 3.8,
  warningLead = 0.65
): { active: boolean; warning: boolean } {
  const period = Math.max(activeDuration + 0.5, cyclePeriod);
  const t = (((elapsedSec + phaseOffset) % period) + period) % period;
  return {
    active: t < activeDuration,
    warning: t >= activeDuration && t >= period - warningLead,
  };
}

export function isSteamActiveAtTime(
  elapsedSec: number,
  phaseOffset = 0,
  activeDuration = 1.5,
  cyclePeriod = 3.8
): boolean {
  return getSteamCyclePhase(elapsedSec, phaseOffset, activeDuration, cyclePeriod).active;
}

/**
 * Pushes a circle cleanly out of an axis-aligned rectangle (used for traffic vehicles and moving containers).
 */
export function resolveCircleRectCollision(
  cx: number,
  cy: number,
  radius: number,
  rx: number,
  ry: number,
  rw: number,
  rh: number
): { x: number; y: number; hit: boolean } {
  const closestX = clamp(cx, rx, rx + rw);
  const closestY = clamp(cy, ry, ry + rh);
  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;
  if (distSq >= radius * radius) {
    return { x: cx, y: cy, hit: false };
  }
  const dist = Math.sqrt(distSq);
  if (dist > 0.0001) {
    const overlap = radius - dist;
    return {
      x: cx + (dx / dist) * overlap,
      y: cy + (dy / dist) * overlap,
      hit: true,
    };
  }
  const lp = cx - rx;
  const rp = rx + rw - cx;
  const tp = cy - ry;
  const bp = ry + rh - cy;
  const m = Math.min(lp, rp, tp, bp);
  if (m === lp) return { x: rx - radius, y: cy, hit: true };
  if (m === rp) return { x: rx + rw + radius, y: cy, hit: true };
  if (m === tp) return { x: cx, y: ry - radius, hit: true };
  return { x: cx, y: ry + rh + radius, hit: true };
}

export interface TimedButtonStatus {
  active: boolean;
  remaining: number;
  progress: number;
}

/**
 * Evaluates a timed pressure button countdown state.
 */
export function isTimedButtonActive(
  elapsedSec: number,
  activatedAt: number | null,
  durationSec: number
): TimedButtonStatus {
  if (activatedAt === null || durationSec <= 0) {
    return { active: false, remaining: 0, progress: 0 };
  }
  const remaining = Math.max(0, activatedAt + durationSec - elapsedSec);
  return {
    active: remaining > 0,
    remaining,
    progress: clamp(remaining / durationSec, 0, 1),
  };
}

export type ActMusicTheme = 'zoo' | 'city' | 'ship' | 'ocean';

export function getMusicThemeForLevel(levelIdx: number): ActMusicTheme {
  if (levelIdx <= 2) return 'zoo';
  if (levelIdx <= 5) return 'city';
  if (levelIdx <= 8) return 'ship';
  return 'ocean';
}

/**
 * Computes live music BPM based on campaign act and pursuit intensity (0..1).
 */
export function getDynamicMusicBpm(levelIdx: number, chaseIntensity: number): number {
  const theme = getMusicThemeForLevel(levelIdx);
  const baseByTheme: Record<ActMusicTheme, number> = {
    zoo: 102,
    city: 116,
    ship: 110,
    ocean: 124,
  };
  const chaseBoostByTheme: Record<ActMusicTheme, number> = {
    zoo: 34,
    city: 32,
    ship: 36,
    ocean: 30,
  };
  return Math.round(baseByTheme[theme] + clamp(chaseIntensity, 0, 1) * chaseBoostByTheme[theme]);
}

/**
 * Checks whether a target is within a police patrol vehicle's proximity detection radius.
 */
export function isWithinProximityRadius(
  px: number,
  py: number,
  ox: number,
  oy: number,
  radius: number
): boolean {
  if (radius <= 0) return false;
  return Math.hypot(px - ox, py - oy) <= radius;
}

export interface ConveyorBelt {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

/**
 * Sums directional push force from any conveyor belts overlapping point (px, py).
 */
export function getConveyorForceAtPoint(
  px: number,
  py: number,
  conveyors: ConveyorBelt[]
): Vec2 {
  let vx = 0;
  let vy = 0;
  for (const cb of conveyors) {
    if (px >= cb.x && px <= cb.x + cb.w && py >= cb.y && py <= cb.y + cb.h) {
      vx += cb.vx;
      vy += cb.vy;
    }
  }
  return { x: vx, y: vy };
}

/**
 * Computes lateral ocean storm wave push acceleration (px/s^2) for Level 10.
 */
export function getOceanStormWavePush(elapsedSec: number, playerY: number): Vec2 {
  const waveA = Math.sin(elapsedSec * 1.45 + playerY * 0.004) * 68;
  const waveB = Math.cos(elapsedSec * 2.5 - playerY * 0.0025) * 28;
  return {
    x: waveA + waveB,
    y: Math.cos(elapsedSec * 1.15 + playerY * 0.0035) * 24,
  };
}

/**
 * Computes normalized 0..100 distance progress toward the Antarctic coast.
 */
export function getNavalProgressPercent(
  playerY: number,
  spawnY: number,
  exitY: number
): number {
  const span = spawnY - exitY;
  if (span <= 0) return 100;
  return clamp(((spawnY - playerY) / span) * 100, 0, 100);
}

export interface IcebergImpactResult {
  hullHp: number;
  slowTimer: number;
  slowDuration: number;
  defeated: boolean;
  sunk: boolean;
  damaged: boolean;
}

/**
 * Applies a 50% hull penalty and 3.0s 50% speed reduction upon colliding with an iceberg in Level 10.
 */
export function applyIcebergImpact(hullHp: number, iceInvulnTimer = 0): IcebergImpactResult {
  if (iceInvulnTimer > 0) {
    return {
      hullHp,
      slowTimer: 0,
      slowDuration: 0,
      defeated: hullHp <= 0,
      sunk: hullHp <= 0,
      damaged: false,
    };
  }
  const nextHp = Math.max(0, hullHp - 50);
  return {
    hullHp: nextHp,
    slowTimer: 3.0,
    slowDuration: 3.0,
    defeated: nextHp <= 0,
    sunk: nextHp <= 0,
    damaged: true,
  };
}

export interface LockpickConfig {
  speed: number;
  zoneWidth: number;
}

/**
 * Computes +2 grade difficulty parameters for lockpick & terminal hack doors.
 */
export function getLockpickDifficultyConfig(
  baseZoneWidth = 0.16,
  levelIdx = 0,
  stage = 1
): LockpickConfig {
  const tierBoost = levelIdx >= 6 ? 0.25 : levelIdx >= 3 ? 0.12 : 0;
  const baseSpeed = 1.92 + tierBoost;
  const stageIndex = Math.max(0, stage - 1);
  const speed = baseSpeed * Math.pow(1.18, stageIndex);
  const startWidth = clamp(baseZoneWidth * 0.78, 0.085, 0.165);
  const zoneWidth = Math.max(0.078, startWidth * Math.pow(0.82, stageIndex));
  return { speed, zoneWidth };
}

export type CircuitTileKind = 'straight' | 'elbow' | 'tee' | 'cross' | 'source' | 'sink' | 'empty';

export interface CircuitTile {
  kind: CircuitTileKind;
  rot: number; // 0..3 clockwise quarter turns
}

// Bitmask directions: U=1, R=2, D=4, L=8
const DIR_U = 1;
const DIR_R = 2;
const DIR_D = 4;
const DIR_L = 8;

function rotateMask(mask: number, rot: number): number {
  const steps = ((rot % 4) + 4) % 4;
  let m = mask;
  for (let i = 0; i < steps; i++) {
    let next = 0;
    if (m & DIR_U) next |= DIR_R;
    if (m & DIR_R) next |= DIR_D;
    if (m & DIR_D) next |= DIR_L;
    if (m & DIR_L) next |= DIR_U;
    m = next;
  }
  return m;
}

export function getCircuitConnections(tile: CircuitTile): number {
  let base = 0;
  if (tile.kind === 'straight') base = DIR_L | DIR_R;
  else if (tile.kind === 'elbow') base = DIR_U | DIR_R;
  else if (tile.kind === 'tee') base = DIR_L | DIR_U | DIR_R;
  else if (tile.kind === 'cross') base = DIR_U | DIR_R | DIR_D | DIR_L;
  else if (tile.kind === 'source') base = DIR_R;
  else if (tile.kind === 'sink') base = DIR_L;
  return tile.kind === 'source' || tile.kind === 'sink' ? base : rotateMask(base, tile.rot);
}

/**
 * Computes powered tiles via BFS from all source tiles and checks if every sink is energized.
 */
export function evaluateCircuitFlow(grid: CircuitTile[][]): {
  solved: boolean;
  powered: boolean[][];
} {
  const rows = grid.length;
  const cols = rows > 0 ? grid[0].length : 0;
  const powered = Array.from({ length: rows }, () => Array<boolean>(cols).fill(false));
  const queue: Array<[number, number]> = [];
  let sinkTotal = 0;
  let sinkLit = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c].kind === 'source') {
        powered[r][c] = true;
        queue.push([r, c]);
      } else if (grid[r][c].kind === 'sink') {
        sinkTotal++;
      }
    }
  }

  const neighbors: Array<[number, number, number, number]> = [
    [-1, 0, DIR_U, DIR_D],
    [0, 1, DIR_R, DIR_L],
    [1, 0, DIR_D, DIR_U],
    [0, -1, DIR_L, DIR_R],
  ];

  let head = 0;
  while (head < queue.length) {
    const [r, c] = queue[head++];
    const mask = getCircuitConnections(grid[r][c]);
    for (const [dr, dc, outBit, inBit] of neighbors) {
      if (!(mask & outBit)) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
      if (powered[nr][nc]) continue;
      const nMask = getCircuitConnections(grid[nr][nc]);
      if (!(nMask & inBit)) continue;
      powered[nr][nc] = true;
      if (grid[nr][nc].kind === 'sink') sinkLit++;
      queue.push([nr, nc]);
    }
  }

  return {
    solved: sinkTotal > 0 && sinkLit === sinkTotal,
    powered,
  };
}

export interface RushHourBlock {
  id: string;
  x: number;
  y: number;
  len: number;
  dir: 'h' | 'v';
  isTarget?: boolean;
  color?: string;
}

/**
 * Checks whether moving a Rush Hour block by `delta` integer cells is collision-free inside `gridSize`.
 */
export function canMoveRushHourBlock(
  blocks: RushHourBlock[],
  blockId: string,
  delta: number,
  gridSize = 6
): boolean {
  const target = blocks.find((b) => b.id === blockId);
  if (!target || delta === 0) return false;
  const step = delta > 0 ? 1 : -1;
  const steps = Math.abs(delta);

  const occ = Array.from({ length: gridSize }, () => Array<boolean>(gridSize).fill(false));
  for (const b of blocks) {
    if (b.id === blockId) continue;
    for (let k = 0; k < b.len; k++) {
      const bx = b.dir === 'h' ? b.x + k : b.x;
      const by = b.dir === 'v' ? b.y + k : b.y;
      if (bx >= 0 && bx < gridSize && by >= 0 && by < gridSize) {
        occ[by][bx] = true;
      }
    }
  }

  for (let s = 1; s <= steps; s++) {
    const nx = target.dir === 'h' ? target.x + step * s : target.x;
    const ny = target.dir === 'v' ? target.y + step * s : target.y;
    for (let k = 0; k < target.len; k++) {
      const cx = target.dir === 'h' ? nx + k : nx;
      const cy = target.dir === 'v' ? ny + k : ny;
      if (cx < 0 || cx >= gridSize || cy < 0 || cy >= gridSize || occ[cy][cx]) {
        return false;
      }
    }
  }
  return true;
}

export function stepRushHourBlock(
  blocks: RushHourBlock[],
  blockId: string,
  delta: number,
  gridSize = 6
): RushHourBlock[] {
  if (!canMoveRushHourBlock(blocks, blockId, delta, gridSize)) return blocks;
  return blocks.map((b) => {
    if (b.id !== blockId) return b;
    return {
      ...b,
      x: b.dir === 'h' ? b.x + delta : b.x,
      y: b.dir === 'v' ? b.y + delta : b.y,
    };
  });
}

export function isRushHourSolved(blocks: RushHourBlock[], gridSize = 6): boolean {
  const target = blocks.find((b) => b.isTarget);
  if (!target) return false;
  return target.dir === 'h' && target.x + target.len >= gridSize;
}

/**
 * Evaluates a circular navigation radar dial alignment (normalized 0..1 turns).
 */
export function evaluateNavDialStrike(
  pos: number,
  zoneCenter: number,
  zoneHalfWidth: number
): 'hit' | 'miss' {
  const a = ((pos % 1) + 1) % 1;
  const b = ((zoneCenter % 1) + 1) % 1;
  const rawDiff = Math.abs(a - b);
  const circularDiff = Math.min(rawDiff, 1 - rawDiff);
  return circularDiff <= zoneHalfWidth ? 'hit' : 'miss';
}

function pointSegDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = clamp(((px - x1) * dx + (py - y1) * dy) / lenSq, 0, 1);
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Verifies that an objective position is directly guarded by at least one active patrol, drone, or camera.
 */
export function isPointProtectedByHazard(
  px: number,
  py: number,
  guards: Array<{ waypoints: Vec2[] }>,
  cameras: Array<{ x: number; y: number; baseAngle: number; sweep: number; range: number; fov: number }>,
  drones: Array<{ waypoints: Vec2[] }>,
  tileSize: number,
  isOpaque: (col: number, row: number) => boolean
): boolean {
  const guardRadius = 3.8 * tileSize;

  for (const g of guards) {
    const pts = g.waypoints;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (pointSegDist(px, py, a.x * tileSize, a.y * tileSize, b.x * tileSize, b.y * tileSize) <= guardRadius) {
        return true;
      }
    }
  }

  for (const dr of drones) {
    const pts = dr.waypoints;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      if (pointSegDist(px, py, a.x * tileSize, a.y * tileSize, b.x * tileSize, b.y * tileSize) <= guardRadius) {
        return true;
      }
    }
  }

  for (const cam of cameras) {
    const ox = cam.x * tileSize;
    const oy = cam.y * tileSize;
    const dist = Math.hypot(px - ox, py - oy);
    if (dist > cam.range) continue;
    const ang = Math.atan2(py - oy, px - ox);
    const maxSweepAngle = cam.sweep + cam.fov * 0.5;
    if (Math.abs(angleDiff(ang, cam.baseAngle)) <= maxSweepAngle) {
      const hitDist = castGridRay(ox, oy, ang, dist, tileSize, isOpaque, 6);
      if (hitDist >= dist - 6) return true;
    }
  }

  return false;
}

export type SharkObstacleKind = 'coral' | 'structure' | 'mine' | 'turbulence';

export interface SharkTrackObstacle {
  id: number;
  kind: SharkObstacleKind;
  x: number;
  baseX: number;
  dist: number;
  radius: number;
  w: number;
  h: number;
  moveAmp: number;
  moveFreq: number;
  phase: number;
  destroyed: boolean;
}

export interface SharkBoostRing {
  id: number;
  x: number;
  dist: number;
  radius: number;
  collected: boolean;
}

export interface SharkImpactResult {
  staminaHp: number;
  slowTimer: number;
  defeated: boolean;
}

/**
 * Applies the Level-10-matching 2-hit rule for the Level 3 vertical shark race:
 * 50% stamina loss per hit and 2.8s of 50% speed reduction.
 */
export function applySharkObstacleImpact(staminaHp: number): SharkImpactResult {
  const nextHp = Math.max(0, staminaHp - 50);
  return {
    staminaHp: nextHp,
    slowTimer: 2.8,
    defeated: nextHp <= 0,
  };
}

/**
 * Computes upward swim speed for the Level 3 vertical shark chase.
 */
export function getSharkRaceSwimSpeed(
  baseSpeed: number,
  boostTimer: number,
  slowTimer: number,
  verticalInput = 0
): number {
  const inputAdj = verticalInput < 0 ? 42 : verticalInput > 0 ? -36 : 0;
  const boostAdj = boostTimer > 0 ? 155 : 0;
  const raw = Math.max(90, baseSpeed + inputAdj + boostAdj);
  return slowTimer > 0 ? raw * 0.5 : raw;
}

export type SharkRaceOutcome = 'playing' | 'won' | 'lost_hits' | 'lost_caught' | 'lost_timeout';

/**
 * Evaluates win/loss outcome for the 20-second vertical shark escape race.
 */
export function evaluateSharkRaceOutcome(
  timeRemaining: number,
  playerDist: number,
  sharkDist: number,
  targetDist: number,
  staminaHp: number
): SharkRaceOutcome {
  if (staminaHp <= 0) return 'lost_hits';
  if (sharkDist >= playerDist - 18) return 'lost_caught';
  if (playerDist >= targetDist) return 'won';
  if (timeRemaining <= 0) return 'lost_timeout';
  return 'playing';
}

/**
 * Generates a balanced, navigable 20-second vertical obstacle and boost ring track inside the aquarium channel.
 */
export function generateSharkRaceTrack(
  targetDist = 4250,
  channelLeft = 44,
  channelRight = 396
): { obstacles: SharkTrackObstacle[]; boostRings: SharkBoostRing[] } {
  const obstacles: SharkTrackObstacle[] = [];
  const boostRings: SharkBoostRing[] = [];
  const width = channelRight - channelLeft;
  const laneCount = 4;
  const laneW = width / laneCount;
  const kinds: SharkObstacleKind[] = ['coral', 'mine', 'turbulence', 'structure'];
  const thirdPattern: Array<'left' | 'center' | 'right'> = [
    'right',
    'center',
    'left',
    'center',
    'right',
    'left',
    'center',
    'right',
  ];

  let obsId = 1;
  let ringId = 1;
  let prevSafeLane = 1;

  // Deterministic pseudo-random helper so every race has clean fair lanes with balanced thirds
  let seed = 31337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let d = 520, band = 0; d <= targetDist - 240; d += 175, band++) {
    const isRingBand = band % 3 === 1;
    const isApproachBand = band % 3 === 0;
    const ringSlotIdx = Math.floor(band / 3);
    const targetThird = thirdPattern[ringSlotIdx % thirdPattern.length];
    const targetLaneForRing =
      targetThird === 'left' ? 0 : targetThird === 'right' ? 3 : ringSlotIdx % 2 === 0 ? 1 : 2;

    let safeLane: number;
    if (isRingBand) {
      safeLane = targetLaneForRing;
    } else if (isApproachBand && band > 0) {
      const nextRingSlot = Math.floor((band + 1) / 3);
      const nextThird = thirdPattern[nextRingSlot % thirdPattern.length];
      const nextLane =
        nextThird === 'left' ? 0 : nextThird === 'right' ? 3 : nextRingSlot % 2 === 0 ? 1 : 2;
      const diff = nextLane - prevSafeLane;
      safeLane = clamp(prevSafeLane + Math.sign(diff), 0, laneCount - 1);
    } else {
      const shift = rand() < 0.34 ? -1 : rand() < 0.68 ? 1 : 0;
      safeLane = clamp(prevSafeLane + shift, 0, laneCount - 1);
    }
    prevSafeLane = safeLane;

    // Place 1 or 2 obstacles on non-safe lanes in this band
    const countThisBand = band % 3 === 2 ? 2 : 1;
    let placed = 0;
    for (let attempt = 0; attempt < 8 && placed < countThisBand; attempt++) {
      const lane = Math.floor(rand() * laneCount);
      if (lane === safeLane) continue;
      if (
        obstacles.some(
          (o) =>
            Math.abs(o.dist - d) < 40 &&
            Math.abs(o.baseX - (channelLeft + (lane + 0.5) * laneW)) < laneW * 0.7
        )
      ) {
        continue;
      }
      const kind = kinds[(band + placed + Math.floor(rand() * 2)) % kinds.length];
      const cx = channelLeft + (lane + 0.5) * laneW + (rand() - 0.5) * 14;
      const isMobile = kind === 'mine' || kind === 'turbulence' ? band % 2 === 1 : false;
      const maxAmp = Math.min(34, laneW * 0.3);
      const moveAmp = isMobile ? maxAmp : 0;
      const radius = kind === 'mine' ? 17 : kind === 'turbulence' ? 23 : kind === 'coral' ? 21 : 22;

      obstacles.push({
        id: obsId++,
        kind,
        x: cx,
        baseX: clamp(cx, channelLeft + radius + moveAmp + 6, channelRight - radius - moveAmp - 6),
        dist: d + placed * 38,
        radius,
        w: kind === 'structure' ? 46 : radius * 2,
        h: kind === 'structure' ? 26 : radius * 2,
        moveAmp,
        moveFreq: isMobile ? 1.8 + rand() * 1.1 : 0,
        phase: rand() * Math.PI * 2,
        destroyed: false,
      });
      placed++;
    }

    // Place a bright cyan speed boost ring evenly distributed across left, center, and right thirds
    if (isRingBand) {
      let frac = 0.5;
      if (targetThird === 'left') frac = 0.14 + rand() * 0.12;
      else if (targetThird === 'right') frac = 0.74 + rand() * 0.12;
      else frac = 0.43 + rand() * 0.14;

      const rx = clamp(channelLeft + width * frac, channelLeft + 34, channelRight - 34);
      boostRings.push({
        id: ringId++,
        x: rx,
        dist: d + 84,
        radius: 22,
        collected: false,
      });
    }
  }

  return { obstacles, boostRings };
}

export type TunnelObstacleKind = 'jellyfish' | 'rock' | 'current';

export interface TunnelObstacle {
  id: number;
  kind: TunnelObstacleKind;
  x: number;
  y: number;
  baseY: number;
  radius: number;
  w: number;
  h: number;
  moveAmp: number;
  moveFreq: number;
  phase: number;
  currentVx: number;
  currentVy: number;
}

export interface TunnelBoostRing {
  id: number;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

export interface TunnelCorals {
  x: number;
  top: boolean;
  h: number;
  w: number;
  color: string;
}

/**
 * Generates a navigable left-to-right underwater tunnel race with jellyfish, rocks, currents, boost rings, and corals.
 */
export function generateSharkTunnelCourse(
  startX = 240,
  targetX = 3600,
  topWall = 62,
  botWall = 378
): {
  obstacles: TunnelObstacle[];
  boostRings: TunnelBoostRing[];
  corals: TunnelCorals[];
} {
  const obstacles: TunnelObstacle[] = [];
  const boostRings: TunnelBoostRing[] = [];
  const corals: TunnelCorals[] = [];
  const tunnelH = botWall - topWall;
  const laneCount = 3;
  const laneH = tunnelH / laneCount;

  let seed = 424242;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  let obsId = 1;
  let ringId = 1;
  let prevSafeLane = 1;
  const thirdPattern: Array<'top' | 'center' | 'bottom'> = ['top', 'center', 'bottom', 'center', 'top', 'bottom'];

  for (let x = startX + 340, band = 0; x <= targetX - 240; x += 215, band++) {
    const isRingBand = band % 3 === 1;
    const ringSlotIdx = Math.floor(band / 3);
    const targetThird = thirdPattern[ringSlotIdx % thirdPattern.length];
    const targetLane = targetThird === 'top' ? 0 : targetThird === 'bottom' ? 2 : 1;

    let safeLane: number;
    if (isRingBand) {
      safeLane = targetLane;
    } else {
      const shift = rand() < 0.35 ? -1 : rand() < 0.7 ? 1 : 0;
      safeLane = clamp(prevSafeLane + shift, 0, laneCount - 1);
    }
    prevSafeLane = safeLane;

    // Place 1 obstacle or current on a non-safe lane
    const blockedLane = (safeLane + 1 + Math.floor(rand() * 2)) % laneCount;
    const laneCenterY = topWall + (blockedLane + 0.5) * laneH;
    const kindRoll = rand();
    let kind: TunnelObstacleKind = 'jellyfish';
    if (band % 4 === 2) kind = 'current';
    else if (kindRoll < 0.48) kind = 'rock';

    if (kind === 'current') {
      const pushDir = blockedLane === 0 ? 1 : blockedLane === 2 ? -1 : rand() < 0.5 ? -1 : 1;
      obstacles.push({
        id: obsId++,
        kind: 'current',
        x: x + (rand() - 0.5) * 30,
        y: laneCenterY,
        baseY: laneCenterY,
        radius: 36,
        w: 118,
        h: 64,
        moveAmp: 0,
        moveFreq: 0,
        phase: rand() * Math.PI * 2,
        currentVx: -105,
        currentVy: pushDir * 145,
      });
    } else if (kind === 'rock') {
      const radius = 25 + Math.round(rand() * 6);
      const yPos = clamp(laneCenterY + (rand() - 0.5) * 18, topWall + radius + 6, botWall - radius - 6);
      obstacles.push({
        id: obsId++,
        kind: 'rock',
        x: x + (rand() - 0.5) * 30,
        y: yPos,
        baseY: yPos,
        radius,
        w: radius * 2,
        h: radius * 1.8,
        moveAmp: 0,
        moveFreq: 0,
        phase: rand() * Math.PI * 2,
        currentVx: 0,
        currentVy: 0,
      });
    } else {
      const radius = 21;
      const moveAmp = Math.min(28, laneH * 0.25);
      const yPos = clamp(laneCenterY, topWall + radius + moveAmp + 6, botWall - radius - moveAmp - 6);
      obstacles.push({
        id: obsId++,
        kind: 'jellyfish',
        x: x + (rand() - 0.5) * 28,
        y: yPos,
        baseY: yPos,
        radius,
        w: radius * 2,
        h: radius * 2,
        moveAmp,
        moveFreq: 2.1 + rand() * 1.0,
        phase: rand() * Math.PI * 2,
        currentVx: 0,
        currentVy: 0,
      });
    }

    // Optional second obstacle on remaining non-safe lane every 2nd band for tension
    if (band % 2 === 0) {
      const otherLane = [0, 1, 2].find((l) => l !== safeLane && l !== blockedLane);
      if (otherLane !== undefined) {
        const y2 = topWall + (otherLane + 0.5) * laneH;
        const isJelly = band % 4 === 0;
        const r2 = isJelly ? 20 : 24;
        obstacles.push({
          id: obsId++,
          kind: isJelly ? 'jellyfish' : 'rock',
          x: x + 78,
          y: clamp(y2, topWall + r2 + 12, botWall - r2 - 12),
          baseY: clamp(y2, topWall + r2 + 12, botWall - r2 - 12),
          radius: r2,
          w: r2 * 2,
          h: r2 * 2,
          moveAmp: isJelly ? 18 : 0,
          moveFreq: isJelly ? 2.4 : 0,
          phase: rand() * Math.PI * 2,
          currentVx: 0,
          currentVy: 0,
        });
      }
    }

    // Cyan speed boost rings evenly across top/center/bottom along the safe lane
    if (isRingBand) {
      const ry = clamp(
        topWall + (safeLane + 0.5) * laneH + (rand() - 0.5) * 14,
        topWall + 34,
        botWall - 34
      );
      boostRings.push({
        id: ringId++,
        x: x + 95,
        y: ry,
        radius: 22,
        collected: false,
      });
    }
  }

  // Minimalist coral silhouettes along the top and bottom edges of the tunnel
  const coralPalette = ['#0EA5E9', '#22D3EE', '#F472B6', '#38BDF8', '#2DD4BF'];
  for (let cx = 60, idx = 0; cx < targetX + 320; cx += 65 + Math.floor(rand() * 45), idx++) {
    corals.push({
      x: cx,
      top: idx % 3 === 0,
      h: 18 + Math.round(rand() * 24),
      w: 16 + Math.round(rand() * 22),
      color: coralPalette[idx % coralPalette.length],
    });
  }

  return { obstacles, boostRings, corals };
}

export type HorizontalSharkRaceOutcome = 'playing' | 'won' | 'caught';

/**
 * Evaluates win or caught condition for the horizontal Level 3 underwater tunnel race.
 */
export function evaluateHorizontalSharkRaceOutcome(
  playerX: number,
  sharkX: number,
  targetX: number
): HorizontalSharkRaceOutcome {
  if (sharkX >= playerX - 24) return 'caught';
  if (playerX >= targetX) return 'won';
  return 'playing';
}

// =========================================================
// LEVEL 5: METRO TRAIN ROOF CHASE
// =========================================================
export type MetroObstacleKind = 'pipe' | 'arc' | 'drone';

export interface MetroTrainObstacle {
  id: number;
  kind: MetroObstacleKind;
  dist: number;
  x: number;
  baseX: number;
  w: number;
  h: number;
  radius: number;
  moveAmp: number;
  moveFreq: number;
  phase: number;
  jumpable: boolean;
}

export function generateMetroTrainCourse(
  targetDist = 3000,
  trainLeft = 100,
  trainRight = 380
): MetroTrainObstacle[] {
  const obstacles: MetroTrainObstacle[] = [];
  const roofW = trainRight - trainLeft;
  const laneCount = 3;
  const laneW = roofW / laneCount;

  let seed = 557799;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  let id = 1;
  for (let dist = 340, band = 0; dist <= targetDist - 240; dist += 210, band++) {
    const roll = rand();
    if (band % 4 === 1) {
      // Full-width low overhead pipe (must Jump/Dash over!)
      obstacles.push({
        id: id++,
        kind: 'pipe',
        dist,
        x: (trainLeft + trainRight) * 0.5,
        baseX: (trainLeft + trainRight) * 0.5,
        w: roofW - 14,
        h: 24,
        radius: 16,
        moveAmp: 0,
        moveFreq: 0,
        phase: rand() * Math.PI * 2,
        jumpable: true,
      });
    } else if (roll < 0.52) {
      // High-voltage electric arc pylons covering 1-2 lanes
      const openLane = Math.floor(rand() * laneCount);
      for (let lane = 0; lane < laneCount; lane++) {
        if (lane === openLane) continue;
        if (rand() < 0.45 && lane !== (openLane + 1) % laneCount) continue;
        const cx = trainLeft + (lane + 0.5) * laneW;
        obstacles.push({
          id: id++,
          kind: 'arc',
          dist,
          x: cx,
          baseX: cx,
          w: laneW * 0.72,
          h: 28,
          radius: 18,
          moveAmp: 0,
          moveFreq: 0,
          phase: rand() * Math.PI * 2,
          jumpable: true,
        });
      }
    } else {
      // Sweeping tunnel drone hovering above roof
      const margin = 38;
      const centerX = (trainLeft + trainRight) * 0.5;
      const amp = Math.max(20, roofW * 0.5 - margin);
      obstacles.push({
        id: id++,
        kind: 'drone',
        dist,
        x: centerX,
        baseX: centerX,
        w: 34,
        h: 34,
        radius: 17,
        moveAmp: amp,
        moveFreq: 2.1 + rand() * 0.9,
        phase: rand() * Math.PI * 2,
        jumpable: true,
      });
    }
  }

  return obstacles;
}

export type MetroTrainOutcome = 'playing' | 'won' | 'lost';

export function evaluateMetroTrainOutcome(
  dist: number,
  targetDist: number,
  hp: number
): MetroTrainOutcome {
  if (hp <= 0) return 'lost';
  if (dist >= targetDist) return 'won';
  return 'playing';
}

// =========================================================
// LEVEL 7: CONVEYOR GAUNTLET OBSTACLE COURSE
// =========================================================
export interface GauntletConveyor {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

export interface GauntletSlidingCrate {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  phase: number;
}

export interface GauntletMovingLaser {
  id: number;
  x1: number;
  x2: number;
  yTop: number;
  yBot: number;
  x: number;
  speed: number;
  phase: number;
  pulseInterval: number;
}

export function generateConveyorGauntlet(
  platLeft = 80,
  platRight = 1040,
  platTop = 90,
  platBot = 410
): {
  conveyors: GauntletConveyor[];
  crates: GauntletSlidingCrate[];
  lasers: GauntletMovingLaser[];
} {
  const platH = platBot - platTop;
  const midY = (platTop + platBot) * 0.5;
  const conveyors: GauntletConveyor[] = [
    { id: 1, x: platLeft + 145, y: platTop + 14, w: 135, h: 112, vx: -115, vy: 110 },
    { id: 2, x: platLeft + 145, y: platBot - 126, w: 135, h: 112, vx: 120, vy: -115 },
    { id: 3, x: platLeft + 330, y: midY - 68, w: 160, h: 136, vx: -145, vy: 0 },
    { id: 4, x: platLeft + 330, y: platTop + 8, w: 150, h: 72, vx: 130, vy: 45 },
    { id: 5, x: platLeft + 330, y: platBot - 80, w: 150, h: 72, vx: 130, vy: -45 },
    { id: 6, x: platLeft + 540, y: platTop + 16, w: 145, h: 135, vx: 0, vy: 155 },
    { id: 7, x: platLeft + 540, y: platBot - 151, w: 145, h: 135, vx: 0, vy: -155 },
    { id: 8, x: platLeft + 735, y: midY - 95, w: 135, h: 190, vx: -135, vy: 85 },
  ];

  const crates: GauntletSlidingCrate[] = [
    {
      id: 1,
      x1: platLeft + 295,
      y1: platTop + 44,
      x2: platLeft + 295,
      y2: platBot - 44,
      x: platLeft + 295,
      y: midY,
      w: 52,
      h: 46,
      speed: 1.55,
      phase: 0.2,
    },
    {
      id: 2,
      x1: platLeft + 505,
      y1: platBot - 46,
      x2: platLeft + 505,
      y2: platTop + 46,
      x: platLeft + 505,
      y: midY,
      w: 54,
      h: 48,
      speed: 1.75,
      phase: 1.8,
    },
    {
      id: 3,
      x1: platLeft + 710,
      y1: platTop + 48,
      x2: platLeft + 710,
      y2: platBot - 48,
      x: platLeft + 710,
      y: midY,
      w: 54,
      h: 48,
      speed: 1.9,
      phase: 3.1,
    },
    {
      id: 4,
      x1: platLeft + 565,
      y1: midY,
      x2: platRight - 140,
      y2: midY,
      x: platLeft + 680,
      y: midY,
      w: 48,
      h: 44,
      speed: 1.45,
      phase: 0.9,
    },
  ];

  const lasers: GauntletMovingLaser[] = [
    {
      id: 1,
      x1: platLeft + 220,
      x2: platLeft + 380,
      yTop: platTop + 10,
      yBot: platTop + platH * 0.56,
      x: platLeft + 300,
      speed: 1.5,
      phase: 0.0,
      pulseInterval: 2.2,
    },
    {
      id: 2,
      x1: platLeft + 440,
      x2: platLeft + 640,
      yTop: platTop + platH * 0.42,
      yBot: platBot - 10,
      x: platLeft + 540,
      speed: 1.7,
      phase: 1.5,
      pulseInterval: 2.0,
    },
    {
      id: 3,
      x1: platLeft + 680,
      x2: platRight - 115,
      yTop: platTop + 12,
      yBot: platBot - 12,
      x: platLeft + 780,
      speed: 1.85,
      phase: 0.7,
      pulseInterval: 2.1,
    },
  ];

  return { conveyors, crates, lasers };
}

export function isInsidePlatformBounds(
  x: number,
  y: number,
  platLeft: number,
  platRight: number,
  platTop: number,
  platBot: number
): boolean {
  return x >= platLeft && x <= platRight && y >= platTop && y <= platBot;
}

export type ConveyorGauntletOutcome = 'playing' | 'won' | 'fell';

export function evaluateConveyorGauntletOutcome(
  x: number,
  y: number,
  goalX: number,
  goalY: number,
  goalRadius: number,
  platLeft: number,
  platRight: number,
  platTop: number,
  platBot: number
): ConveyorGauntletOutcome {
  if (!isInsidePlatformBounds(x, y, platLeft, platRight, platTop, platBot)) return 'fell';
  if (Math.hypot(x - goalX, y - goalY) <= goalRadius) return 'won';
  return 'playing';
}

// =========================================================
// LEVEL 9: BRIDGE CAPTAIN BOSS BATTLE
// =========================================================
export interface BossProjectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  fromBoss: boolean;
  reflected: boolean;
}

/**
 * Attempts to deflect nearby enemy electric-net projectiles back toward the Security Captain.
 */
export function reflectBossProjectile(
  proj: BossProjectile,
  playerX: number,
  playerY: number,
  bossX: number,
  bossY: number,
  reflectRadius = 74,
  returnSpeed = 480
): boolean {
  if (!proj.fromBoss || proj.reflected) return false;
  if (Math.hypot(proj.x - playerX, proj.y - playerY) > reflectRadius) return false;
  const dx = bossX - proj.x;
  const dy = bossY - proj.y;
  const dist = Math.hypot(dx, dy) || 1;
  proj.fromBoss = false;
  proj.reflected = true;
  proj.vx = (dx / dist) * returnSpeed;
  proj.vy = (dy / dist) * returnSpeed;
  return true;
}

export type BossBattleOutcome = 'playing' | 'won' | 'lost';

export function evaluateBossBattleOutcome(
  bossHp: number,
  playerHp: number
): BossBattleOutcome {
  if (bossHp <= 0) return 'won';
  if (playerHp <= 0) return 'lost';
  return 'playing';
}

// =========================================================
// CAMPAIGN PERSISTENCE (escape_antartida_save_v1)
// =========================================================
export const SAVE_STORAGE_KEY = 'escape_antartida_save_v1';
export const LEGACY_PROGRESS_STORAGE_KEY = 'operacion_antartida_progress_v1';
export const TOTAL_CAMPAIGN_LEVELS = 16;
export const DEFAULT_MIN_UNLOCKED_IDX = 13; // N14 (Acto V) unlocked by default for testing

export interface LevelRecord {
  bestTimeSec: number | null;
  minAlerts: number | null;
  maxStunned: number;
  clears: number;
}

export interface SavedWeaponEntry {
  type: string;
  ammo: number;
}

export interface CampaignSaveData {
  version: 1;
  completed: boolean[];
  maxUnlockedIdx: number;
  selectedIdx: number;
  weapons: {
    unlocked: string[];
    loadout: SavedWeaponEntry[];
  };
  records: Record<string, LevelRecord>;
}

export function createDefaultCampaignSave(totalLevels = TOTAL_CAMPAIGN_LEVELS): CampaignSaveData {
  return {
    version: 1,
    completed: Array(totalLevels).fill(false),
    maxUnlockedIdx: Math.min(totalLevels - 1, DEFAULT_MIN_UNLOCKED_IDX),
    selectedIdx: 0,
    weapons: {
      unlocked: [],
      loadout: [],
    },
    records: {},
  };
}

export function parseCampaignSave(
  rawJson: string | null,
  legacyRawJson: string | null = null,
  totalLevels = TOTAL_CAMPAIGN_LEVELS
): CampaignSaveData {
  const def = createDefaultCampaignSave(totalLevels);
  const parseJsonObj = (s: string | null): Record<string, unknown> | null => {
    if (!s) return null;
    try {
      const parsed = JSON.parse(s);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  };

  const primary = parseJsonObj(rawJson);
  const legacy = parseJsonObj(legacyRawJson);
  const src = primary || legacy;
  if (!src) return def;

  const rawCompleted = Array.isArray(src.completed) ? src.completed : [];
  const completed = Array.from({ length: totalLevels }, (_, i) => Boolean(rawCompleted[i]));

  let maxUnlockedIdx =
    typeof src.maxUnlockedIdx === 'number' && Number.isFinite(src.maxUnlockedIdx)
      ? Math.max(0, Math.min(totalLevels - 1, Math.floor(src.maxUnlockedIdx)))
      : 0;

  maxUnlockedIdx = Math.max(maxUnlockedIdx, Math.min(totalLevels - 1, DEFAULT_MIN_UNLOCKED_IDX));
  for (let i = 0; i < totalLevels - 1; i++) {
    if (completed[i]) maxUnlockedIdx = Math.max(maxUnlockedIdx, i + 1);
  }

  const rawSelected =
    typeof src.selectedIdx === 'number' && Number.isFinite(src.selectedIdx)
      ? Math.floor(src.selectedIdx)
      : 0;
  const selectedIdx = Math.max(0, Math.min(maxUnlockedIdx, rawSelected));

  const rawWeapons =
    src.weapons && typeof src.weapons === 'object' ? (src.weapons as Record<string, unknown>) : {};
  const unlockedWeapons = Array.isArray(rawWeapons.unlocked)
    ? Array.from(new Set(rawWeapons.unlocked.filter((x): x is string => typeof x === 'string' && x.length > 0)))
    : [];
  const loadout: SavedWeaponEntry[] = Array.isArray(rawWeapons.loadout)
    ? rawWeapons.loadout
        .filter(
          (w): w is SavedWeaponEntry =>
            Boolean(w) &&
            typeof w === 'object' &&
            typeof (w as SavedWeaponEntry).type === 'string' &&
            typeof (w as SavedWeaponEntry).ammo === 'number' &&
            (w as SavedWeaponEntry).ammo > 0
        )
        .map((w) => ({ type: w.type, ammo: Math.floor(w.ammo) }))
    : [];

  const records: Record<string, LevelRecord> = {};
  if (src.records && typeof src.records === 'object') {
    for (const [k, val] of Object.entries(src.records as Record<string, unknown>)) {
      if (!val || typeof val !== 'object') continue;
      const rec = val as Partial<LevelRecord>;
      records[k] = {
        bestTimeSec: typeof rec.bestTimeSec === 'number' && Number.isFinite(rec.bestTimeSec) ? rec.bestTimeSec : null,
        minAlerts: typeof rec.minAlerts === 'number' && Number.isFinite(rec.minAlerts) ? rec.minAlerts : null,
        maxStunned: typeof rec.maxStunned === 'number' && Number.isFinite(rec.maxStunned) ? rec.maxStunned : 0,
        clears: typeof rec.clears === 'number' && Number.isFinite(rec.clears) ? rec.clears : 0,
      };
    }
  }

  return {
    version: 1,
    completed,
    maxUnlockedIdx,
    selectedIdx,
    weapons: {
      unlocked: unlockedWeapons,
      loadout,
    },
    records,
  };
}

export function recordLevelCompletionSave(
  save: CampaignSaveData,
  levelIdx: number,
  elapsedSec: number,
  alertsTriggered: number,
  guardsStunned: number,
  currentWeapons: SavedWeaponEntry[] = [],
  totalLevels = TOTAL_CAMPAIGN_LEVELS
): CampaignSaveData {
  const nextCompleted = save.completed.slice();
  if (levelIdx >= 0 && levelIdx < totalLevels) {
    nextCompleted[levelIdx] = true;
  }
  const nextMaxUnlocked = Math.max(
    save.maxUnlockedIdx,
    Math.min(totalLevels - 1, DEFAULT_MIN_UNLOCKED_IDX),
    Math.min(totalLevels - 1, levelIdx + 1)
  );
  const key = String(levelIdx + 1);
  const prevRec = save.records[key];
  const roundedTime = Math.round(Math.max(0, elapsedSec) * 10) / 10;
  const nextRec: LevelRecord = {
    bestTimeSec: prevRec && prevRec.bestTimeSec !== null ? Math.min(prevRec.bestTimeSec, roundedTime) : roundedTime,
    minAlerts: prevRec && prevRec.minAlerts !== null ? Math.min(prevRec.minAlerts, alertsTriggered) : alertsTriggered,
    maxStunned: prevRec ? Math.max(prevRec.maxStunned, guardsStunned) : guardsStunned,
    clears: (prevRec ? prevRec.clears : 0) + 1,
  };

  const unlockedSet = new Set(save.weapons.unlocked);
  const cleanLoadout: SavedWeaponEntry[] = [];
  for (const w of currentWeapons) {
    if (w && w.type) {
      unlockedSet.add(w.type);
      if (w.ammo > 0) cleanLoadout.push({ type: w.type, ammo: Math.floor(w.ammo) });
    }
  }

  return {
    version: 1,
    completed: nextCompleted,
    maxUnlockedIdx: nextMaxUnlocked,
    selectedIdx: Math.min(totalLevels - 1, levelIdx + 1),
    weapons: {
      unlocked: Array.from(unlockedSet),
      loadout: cleanLoadout,
    },
    records: {
      ...save.records,
      [key]: nextRec,
    },
  };
}

// =========================================================
// LEVEL 3 FISH-ONLY DRONES & ACT V MECHANICS (N11, N12, N13)
// =========================================================
export function canWeaponStunDrone(weaponType: string, fishOnly: boolean): boolean {
  if (!fishOnly) return true;
  return weaponType === 'fish' || weaponType === 'cryo_snow';
}

/**
 * Returns cyclical snowstorm intensity [0..0.58] for Level 11.
 * Alternates between crisp Aurora clarity and drifting snow gusts.
 */
export function getSnowstormIntensity(elapsedSec: number): number {
  const cycle = 15.0;
  const t = ((elapsedSec % cycle) + cycle) % cycle;
  if (t < 6.0) return 0.08;
  if (t < 8.5) return 0.08 + ((t - 6.0) / 2.5) * 0.48;
  if (t < 12.5) return 0.56;
  return 0.56 - ((t - 12.5) / 2.5) * 0.48;
}

export function areAllBeaconsLit(beacons: Array<{ lit: boolean }>): boolean {
  return beacons.length > 0 && beacons.every((b) => b.lit);
}

/**
 * Returns true if an entity's center falls squarely into a cavern crevasse ('C') tile.
 */
export function isCrevasseFall(
  grid: string[],
  worldX: number,
  worldY: number,
  tileSize = 48,
  edgeMarginPx = 11
): boolean {
  const c = Math.floor(worldX / tileSize);
  const r = Math.floor(worldY / tileSize);
  if (r < 0 || r >= grid.length || c < 0 || c >= grid[0].length) return false;
  if (grid[r][c] !== 'C') return false;
  const localX = worldX - c * tileSize;
  const localY = worldY - r * tileSize;
  return (
    localX >= edgeMarginPx &&
    localX <= tileSize - edgeMarginPx &&
    localY >= edgeMarginPx &&
    localY <= tileSize - edgeMarginPx
  );
}

export interface PullableTarget {
  id: string;
  px: number;
  py: number;
  collected?: boolean;
}

/**
 * Finds the best collectible/core in front of the penguin for the Magnetic Harpoon to pull.
 */
export function findHarpoonPullTarget<T extends PullableTarget>(
  originX: number,
  originY: number,
  aimAngle: number,
  targets: T[],
  maxRange = 300,
  halfConeRad = 0.52
): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  const dirX = Math.cos(aimAngle);
  const dirY = Math.sin(aimAngle);

  for (const item of targets) {
    if (item.collected) continue;
    const dx = item.px - originX;
    const dy = item.py - originY;
    const dist = Math.hypot(dx, dy);
    if (dist < 18 || dist > maxRange) continue;
    const dot = Math.max(-1, Math.min(1, (dx * dirX + dy * dirY) / dist));
    const ang = Math.acos(dot);
    if (ang > halfConeRad) continue;
    const score = dist + ang * 140;
    if (score < bestScore) {
      bestScore = score;
      best = item;
    }
  }
  return best;
}

/**
 * Checks whether the player plus all 3 rescued penguins are positioned on the 4 weight switches.
 */
export function countActiveWeightPlates(
  playerX: number,
  playerY: number,
  allies: Array<{ x: number; y: number }>,
  plates: Array<{ px: number; py: number }>,
  triggerRadius = 34
): number {
  const entities = [{ x: playerX, y: playerY }, ...allies];
  let count = 0;
  for (const plate of plates) {
    const occupied = entities.some((e) => Math.hypot(e.x - plate.px, e.y - plate.py) <= triggerRadius);
    if (occupied) count++;
  }
  return count;
}

export function isGeneratorFullyPowered(depositedCores: number, requiredCores = 3): boolean {
  return depositedCores >= requiredCores;
}

// =========================================================
// LEVEL 13 SUBGAME: TURBO SNOWMOBILE EXTRACTION TUNNEL (25s)
// =========================================================
export interface SnowmobileTunnelObstacle {
  id: number;
  kind: 'drill' | 'ice_block' | 'poacher';
  x: number;
  y: number;
  baseY: number;
  radius: number;
  moveAmp: number;
  moveFreq: number;
  phase: number;
}

export interface SnowmobileBoostGate {
  id: number;
  x: number;
  y: number;
  radius: number;
  collected: boolean;
}

export function generateSnowmobileTunnelCourse(
  startX = 240,
  targetDist = 5200,
  topWall = 62,
  botWall = 378
): { obstacles: SnowmobileTunnelObstacle[]; boostGates: SnowmobileBoostGate[] } {
  const tunnelH = botWall - topWall;
  const obstacles: SnowmobileTunnelObstacle[] = [];
  const boostGates: SnowmobileBoostGate[] = [];

  let seed = 13379;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  let id = 1;
  for (let x = startX + 340; x < targetDist - 260; x += 205) {
    const roll = rand();
    if (roll < 0.36) {
      // Moving industrial drill sweeping vertically across tunnel lane
      const margin = 46;
      const baseY = topWall + margin + rand() * (tunnelH - margin * 2);
      const maxAmp = Math.min(baseY - (topWall + 24), (botWall - 24) - baseY, 85);
      obstacles.push({
        id: id++,
        kind: 'drill',
        x,
        y: baseY,
        baseY,
        radius: 22,
        moveAmp: Math.max(18, maxAmp),
        moveFreq: 2.3 + rand() * 0.9,
        phase: rand() * Math.PI * 2,
      });
    } else if (roll < 0.72) {
      // Solid glacial ice block
      const y = topWall + 42 + rand() * (tunnelH - 84);
      obstacles.push({
        id: id++,
        kind: 'ice_block',
        x,
        y,
        baseY: y,
        radius: 23,
        moveAmp: 0,
        moveFreq: 0,
        phase: rand() * Math.PI * 2,
      });
    } else {
      // Patrolling poacher inside extraction tunnel
      const margin = 48;
      const baseY = topWall + margin + rand() * (tunnelH - margin * 2);
      const maxAmp = Math.min(baseY - (topWall + 24), (botWall - 24) - baseY, 64);
      obstacles.push({
        id: id++,
        kind: 'poacher',
        x,
        y: baseY,
        baseY,
        radius: 19,
        moveAmp: Math.max(14, maxAmp),
        moveFreq: 1.8 + rand() * 0.7,
        phase: rand() * Math.PI * 2,
      });
    }
  }

  let gid = 1;
  for (let x = startX + 490; x < targetDist - 360; x += 560) {
    const laneRel = gid % 3 === 1 ? 0.22 : gid % 3 === 2 ? 0.5 : 0.78;
    const y = topWall + 34 + (tunnelH - 68) * laneRel;
    boostGates.push({ id: gid++, x, y, radius: 22, collected: false });
  }

  return { obstacles, boostGates };
}

export type SnowmobileTunnelOutcome = 'playing' | 'won' | 'lost_hits' | 'lost_timeout';

export function evaluateSnowmobileTunnelOutcome(
  timeLeft: number,
  playerX: number,
  targetX: number,
  hp: number
): SnowmobileTunnelOutcome {
  if (hp <= 0) return 'lost_hits';
  if (playerX >= targetX) return 'won';
  if (timeLeft <= 0) return 'lost_timeout';
  return 'playing';
}

// =========================================================
// LEVEL 14 / 15 / 16 PURE ACT V MECHANICS
// =========================================================
export function areAllSonarDisabled(consoles: Array<{ disabled: boolean }>): boolean {
  return consoles.length > 0 && consoles.every((c) => c.disabled);
}

export function canCrossVolcanicHeat(tileChar: string, hasThermalShield: boolean): boolean {
  if (tileChar === 'L') return false;
  if (tileChar === 'V') return hasThermalShield;
  return true;
}

export interface MagmaMovingPlatform {
  id: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x: number;
  y: number;
  w: number;
  h: number;
  speed: number;
  phase: number;
}

export interface MagmaEruptionGeyser {
  id: number;
  x: number;
  y: number;
  radius: number;
  period: number;
  activeDur: number;
  phase: number;
}

export function generateMagmaPlatformCourse(
  startX = 100,
  targetX = 1040,
  midY = 260
): {
  platforms: MagmaMovingPlatform[];
  eruptions: MagmaEruptionGeyser[];
} {
  const platforms: MagmaMovingPlatform[] = [
    { id: 1, x1: 210, y1: midY - 58, x2: 210, y2: midY + 58, x: 210, y: midY, w: 96, h: 68, speed: 1.35, phase: 0.2 },
    { id: 2, x1: 325, y1: midY + 62, x2: 410, y2: midY - 62, x: 360, y: midY, w: 94, h: 66, speed: 1.45, phase: 1.4 },
    { id: 3, x1: 495, y1: midY - 72, x2: 495, y2: midY + 72, x: 495, y: midY, w: 96, h: 66, speed: 1.6, phase: 2.5 },
    { id: 4, x1: 605, y1: midY, x2: 715, y2: midY, x: 660, y: midY, w: 98, h: 68, speed: 1.5, phase: 0.7 },
    { id: 5, x1: 790, y1: midY - 68, x2: 880, y2: midY + 68, x: 835, y: midY, w: 98, h: 68, speed: 1.65, phase: 1.9 },
  ];

  const eruptions: MagmaEruptionGeyser[] = [
    { id: 1, x: Math.round((startX + targetX) * 0.28), y: midY - 34, radius: 34, period: 3.1, activeDur: 1.15, phase: 0.4 },
    { id: 2, x: Math.round((startX + targetX) * 0.48), y: midY + 32, radius: 36, period: 2.9, activeDur: 1.1, phase: 1.7 },
    { id: 3, x: Math.round((startX + targetX) * 0.67), y: midY - 12, radius: 36, period: 3.0, activeDur: 1.15, phase: 2.6 },
    { id: 4, x: Math.round((startX + targetX) * 0.83), y: midY + 26, radius: 34, period: 2.8, activeDur: 1.05, phase: 0.9 },
  ];

  return { platforms, eruptions };
}

export type MagmaPlatformOutcome = 'playing' | 'won' | 'lost';

export function evaluateMagmaPlatformOutcome(
  playerX: number,
  targetX: number,
  hp: number,
  fellInMagma: boolean
): MagmaPlatformOutcome {
  if (hp <= 0 || fellInMagma) return 'lost';
  if (playerX >= targetX) return 'won';
  return 'playing';
}

export function isFortressGateUnlocked(
  cryoNodes: Array<{ gateId: number; activated: boolean }>,
  harpoonLocks: Array<{ gateId: number; activated: boolean }>,
  gateId: number
): boolean {
  const cryo = cryoNodes.filter((n) => n.gateId === gateId);
  const harpoon = harpoonLocks.filter((l) => l.gateId === gateId);
  return cryo.length > 0 && harpoon.length > 0 && cryo.every((n) => n.activated) && harpoon.every((l) => l.activated);
}

