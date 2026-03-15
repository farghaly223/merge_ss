'use strict';

/* ════════════════════════════════════════════════════════
   ANIMAL MERGE — PERFECT SOLVER
   Algorithm  : Expectimax + IDDFS (depth 2→8, 180ms budget)
   Heuristic  : Zig-Zag weight matrix + Triple-10 ladder
   Goal       : 3× Level-10 tiles simultaneously
════════════════════════════════════════════════════════ */

/* Zig-Zag serpentine weight matrix
   Bottom-left corner = highest weight (4^16)
   Forces Lv10s to stack at row-3 col-0,1,2  */
const ZZ = (() => {
  const e = (n) => Math.pow(4, n);
  const raw = [
    [e(1),  e(2),  e(3),  e(4) ],
    [e(8),  e(7),  e(6),  e(5) ],
    [e(9),  e(10), e(11), e(12)],
    [e(16), e(15), e(14), e(13)],
  ];
  const max = raw[3][0];
  return raw.map(r => r.map(v => v / max));
})();

const DIRS         = ['up', 'down', 'left', 'right'];
const LADDER_IDEAL = [10, 10, 10, 9, 8, 7, 6, 5];
const SPAWNS       = [[1, 0.9], [2, 0.1]];
const TIME_MS      = 175;

/* Zobrist hash table — seeded once per process */
const ZT = Array.from({ length: 4 * 4 * 11 }, () => (Math.random() * 0xFFFFFFFF) | 0);

function zhash(g) {
  let h = 0;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      h ^= ZT[(r * 4 + c) * 11 + g[r][c]];
  return h;
}

function cloneGrid(g) { return g.map(r => r.slice()); }

function emptyList(g) {
  const e = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (!g[r][c]) e.push([r, c]);
  return e;
}

/* Slide one row left and merge equal adjacent tiles */
function slideRow(row) {
  const a = row.filter(x => x > 0);
  const out = [];
  for (let i = 0; i < a.length; i++) {
    if (i + 1 < a.length && a[i] === a[i + 1]) { out.push(Math.min(a[i] + 1, 10)); i++; }
    else out.push(a[i]);
  }
  while (out.length < 4) out.push(0);
  return out;
}

function applyMove(g, dir) {
  const ng = cloneGrid(g);
  let moved = false;

  if (dir === 'left') {
    for (let r = 0; r < 4; r++) {
      const n = slideRow(ng[r]);
      if (n.join() !== ng[r].join()) moved = true;
      ng[r] = n;
    }
  } else if (dir === 'right') {
    for (let r = 0; r < 4; r++) {
      const n = slideRow(ng[r].slice().reverse()).reverse();
      if (n.join() !== ng[r].join()) moved = true;
      ng[r] = n;
    }
  } else if (dir === 'up') {
    for (let c = 0; c < 4; c++) {
      const col = ng.map(row => row[c]);
      const n   = slideRow(col);
      if (n.join() !== col.join()) moved = true;
      for (let r = 0; r < 4; r++) ng[r][c] = n[r];
    }
  } else { /* down */
    for (let c = 0; c < 4; c++) {
      const col = ng.map(row => row[c]);
      const n   = slideRow(col.slice().reverse()).reverse();
      if (n.join() !== col.join()) moved = true;
      for (let r = 0; r < 4; r++) ng[r][c] = n[r];
    }
  }
  return { g: ng, moved };
}

function canMove(g) {
  return DIRS.some(d => applyMove(g, d).moved);
}

/* Multi-target heuristic — never stops after first Lv10 */
function evalBoard(g, moveCount, isUpMove) {
  let snakeScore = 0, tripleBonus = 0, tileCnt = 0, islandPen = 0;
  const DR = [-1, 1, 0, 0], DC = [0, 0, -1, 1];

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = g[r][c];
      snakeScore += v * ZZ[r][c];
      if (v === 10) tripleBonus += 1000;
      else if (v === 9) tripleBonus += 200;
      else if (v === 8) tripleBonus += 40;
      if (v) tileCnt++;
      /* island penalty */
      if (v > 2) {
        let hasNeighbour = false;
        for (let d = 0; d < 4; d++) {
          const nr = r + DR[d], nc = c + DC[d];
          if (nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && g[nr][nc] && Math.abs(v - g[nr][nc]) <= 1)
            hasNeighbour = true;
        }
        if (!hasNeighbour) islandPen += v * 0.5;
      }
    }
  }

  /* ladder bonus: reward sorted descending chain */
  const vals = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) if (g[r][c]) vals.push(g[r][c]);
  vals.sort((a, b) => b - a);
  let ladderBonus = 0;
  for (let i = 0; i < Math.min(vals.length, LADDER_IDEAL.length); i++) {
    const diff = vals[i] - LADDER_IDEAL[i];
    if (diff === 0)      ladderBonus += LADDER_IDEAL[i] * 5;
    else if (diff > 0)   ladderBonus += LADDER_IDEAL[i] * 2;
    else                 ladderBonus -= Math.abs(diff) * 2;
  }

  const chainBonus  = (16 - tileCnt) * 3;
  const emptyBonus  = emptyList(g).length * 2.8;
  const upPenalty   = isUpMove ? -80 : 0;
  const effMult     = 1.0 + (moveCount / 200) * 0.6;

  const raw = snakeScore * 12 + ladderBonus * 1.5 + tripleBonus
            + chainBonus * 1.2 + emptyBonus - islandPen + upPenalty;
  return {
    total: raw * effMult,
    snakeScore, ladderBonus, tripleBonus, chainBonus,
    emptyBonus, islandPen, upPenalty, effMult,
  };
}

/* Expectimax with alpha-beta on MAX nodes */
function expectimax(g, depth, isMax, mc, alpha, beta, lastUp, tt, t0) {
  if (Date.now() - t0 > TIME_MS || depth === 0) return evalBoard(g, mc, lastUp).total;

  const hash   = zhash(g);
  const cached = tt.get(hash);
  if (cached && cached.depth >= depth) return cached.score;

  let score;
  if (isMax) {
    const ordDirs = ['down', 'left', 'right', 'up']; // up last = discouraged
    let best = -Infinity;
    for (const dir of ordDirs) {
      const { g: ng, moved } = applyMove(cloneGrid(g), dir);
      if (!moved) continue;
      const v = expectimax(ng, depth - 1, false, mc + 1, alpha, beta, dir === 'up', tt, t0);
      if (v > best) best = v;
      alpha = Math.max(alpha, v);
      if (beta <= alpha) break;
    }
    score = best === -Infinity ? evalBoard(g, mc, false).total : best;
  } else {
    const empties = emptyList(g);
    if (!empties.length) return expectimax(g, depth - 1, true, mc, alpha, beta, false, tt, t0);
    const sample  = empties.length > 4 ? empties.slice(0, 4) : empties;
    let expected  = 0, totalW = 0;
    for (const [er, ec] of sample) {
      for (const [spLv, prob] of SPAWNS) {
        const ng   = cloneGrid(g);
        ng[er][ec] = spLv;
        expected  += expectimax(ng, depth - 1, true, mc, -Infinity, Infinity, false, tt, t0) * prob;
        totalW    += prob;
      }
    }
    score = expected / totalW;
  }

  tt.set(hash, { score, depth });
  return score;
}

/* IDDFS wrapper — runs deeper until time budget runs out */
function solveIDDFS(grid, moveCount = 0) {
  const t0 = Date.now();
  const tt = new Map();
  const scores = { up: null, down: null, left: null, right: null };
  let reachedDepth = 0;

  for (let depth = 2; depth <= 8; depth++) {
    if (Date.now() - t0 > TIME_MS * 0.75) break;

    let anyMoved = false;
    const iter   = {};
    for (const dir of DIRS) {
      const { g: ng, moved } = applyMove(cloneGrid(grid), dir);
      if (!moved) { iter[dir] = null; continue; }
      anyMoved   = true;
      iter[dir]  = expectimax(ng, depth - 1, false, moveCount + 1, -Infinity, Infinity, dir === 'up', tt, t0);
    }
    if (!anyMoved) break;
    Object.assign(scores, iter);
    reachedDepth = depth;
    if (Date.now() - t0 > TIME_MS) break;
  }

  const valid = DIRS.filter(d => scores[d] !== null);
  if (!valid.length) return { bestMove: null, scores, reachedDepth, elapsed: Date.now() - t0, lv10Count: 0 };

  const maxScore = Math.max(...valid.map(d => scores[d]));
  const tied     = valid.filter(d => Math.abs(scores[d] - maxScore) < 1e-4);

  /* Tie-break: maximise empty cells, penalise up */
  const bestMove = tied.reduce((a, b) => {
    const ea = emptyList(applyMove(cloneGrid(grid), a).g).length - (a === 'up' ? 2 : 0);
    const eb = emptyList(applyMove(cloneGrid(grid), b).g).length - (b === 'up' ? 2 : 0);
    return eb > ea ? b : a;
  });

  const lv10Count = grid.flat().filter(v => v === 10).length;
  const heuristic = evalBoard(applyMove(cloneGrid(grid), bestMove).g, moveCount + 1, bestMove === 'up');

  return { bestMove, scores, reachedDepth, elapsed: Date.now() - t0, lv10Count, heuristic };
}

/* Validate incoming grid from client */
function validateGrid(grid) {
  if (!Array.isArray(grid) || grid.length !== 4) return false;
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== 4) return false;
    for (const v of row)
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 10) return false;
  }
  return true;
}

module.exports = { solveIDDFS, validateGrid, applyMove, canMove };
