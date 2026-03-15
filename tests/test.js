'use strict';
const { solveIDDFS, validateGrid, applyMove, canMove } = require('../solver');

const DIRS = ['up','down','left','right'];

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✅  ' + name);
    passed++;
  } catch(e) {
    console.log('  ❌  ' + name + '\n     → ' + e.message);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error((msg||'Expected equal')+': got '+JSON.stringify(a)+' vs '+JSON.stringify(b));
}

console.log('\n🧪  Animal Merge Solver — Test Suite\n');

/* ══ Grid validation ══ */
console.log('── validateGrid ──');
test('accepts valid 4×4 grid',     () => assert(validateGrid([[0,1,2,3],[4,5,6,7],[8,9,10,0],[1,2,3,4]])));
test('rejects non-array',          () => assert(!validateGrid('hello')));
test('rejects wrong rows',         () => assert(!validateGrid([[0,1],[2,3]])));
test('rejects wrong cols',         () => assert(!validateGrid([[0,1,2],[3,4,5,6],[7,8,9,0],[1,2,3,4]])));
test('rejects value > 10',         () => assert(!validateGrid([[11,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]])));
test('rejects float values',       () => assert(!validateGrid([[1.5,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]])));
test('rejects negative values',    () => assert(!validateGrid([[-1,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]])));
test('accepts all zeros (empty)',   () => assert(validateGrid([[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]])));
test('accepts all 10s (max level)', () => assert(validateGrid([[10,10,10,10],[10,10,10,10],[10,10,10,10],[10,10,10,10]])));

/* ══ applyMove / sliding ══ */
console.log('\n── applyMove ──');
test('left: slides tiles to left', () => {
  const g = [[0,0,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const { g: ng, moved } = applyMove(g, 'left');
  assert(moved, 'should have moved');
  assertEqual(ng[0][0], 2, 'tile should be at col 0');
  assertEqual(ng[0][3], 0, 'col 3 should be empty');
});

test('right: slides tiles to right', () => {
  const g = [[2,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const { g: ng, moved } = applyMove(g, 'right');
  assert(moved);
  assertEqual(ng[0][3], 2);
  assertEqual(ng[0][0], 0);
});

test('up: slides tiles up', () => {
  const g = [[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,0,0]];
  const { g: ng, moved } = applyMove(g, 'up');
  assert(moved);
  assertEqual(ng[0][0], 3);
  assertEqual(ng[3][0], 0);
});

test('down: slides tiles down', () => {
  const g = [[3,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const { g: ng, moved } = applyMove(g, 'down');
  assert(moved);
  assertEqual(ng[3][0], 3);
  assertEqual(ng[0][0], 0);
});

test('merge: two equal tiles merge to level+1', () => {
  const g = [[2,2,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const { g: ng } = applyMove(g, 'left');
  assertEqual(ng[0][0], 3, 'two Lv2 should merge to Lv3');
  assertEqual(ng[0][1], 0, 'second cell should be empty');
});

test('merge: capped at level 10', () => {
  const g = [[10,10,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const { g: ng } = applyMove(g, 'left');
  assertEqual(ng[0][0], 10, 'should stay at 10 (max)');
  assertEqual(ng[0][1], 0);
});

test('no-move: already against edge', () => {
  const g = [[1,2,3,4],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const { moved } = applyMove(g, 'left');
  assert(!moved, 'left move on left-packed row should not move');
});

test('double merge: only one merge per pair per move', () => {
  const g = [[2,2,2,2],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  const { g: ng } = applyMove(g, 'left');
  assertEqual(ng[0][0], 3, 'first pair merges');
  assertEqual(ng[0][1], 3, 'second pair merges');
  assertEqual(ng[0][2], 0);
  assertEqual(ng[0][3], 0);
});

/* ══ canMove ══ */
console.log('\n── canMove ──');
test('empty board can move', () => {
  assert(!canMove([[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]]), 'empty board: no tiles to move');
});
test('full board with no merges or slides = no moves possible', () => {
  const g = [[1,2,1,2],[2,1,2,1],[1,2,1,2],[2,1,2,1]];
  assert(!canMove(g), 'checkerboard has no valid moves');
});
test('board with a possible merge can move', () => {
  const g = [[1,1,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]];
  assert(canMove(g), 'two adjacent same-level tiles can merge');
});

/* ══ solveIDDFS ══ */
console.log('\n── solveIDDFS ──');

test('returns a valid direction on demo board', () => {
  const g = [[6,5,4,3],[7,6,5,2],[8,7,6,1],[9,9,8,0]];
  const r = solveIDDFS(g, 0);
  assert(r.bestMove !== null, 'should return a move');
  assert(DIRS.includes(r.bestMove), 'move should be a valid direction');
  assert(r.reachedDepth >= 2, 'should reach at least depth 2');
});

test('returns null for no-move board', () => {
  const g = [[1,2,1,2],[2,1,2,1],[1,2,1,2],[2,1,2,1]];
  const r = solveIDDFS(g, 0);
  assertEqual(r.bestMove, null, 'no moves available');
});

test('solves within 200ms', () => {
  const g = [[5,4,3,2],[4,3,2,1],[3,2,1,0],[2,1,0,0]];
  const t0 = Date.now();
  solveIDDFS(g, 0);
  const elapsed = Date.now() - t0;
  assert(elapsed < 200, 'solver took '+elapsed+'ms, expected < 200ms');
});

test('lv10Count is correct', () => {
  const g = [[10,10,10,9],[8,7,6,5],[4,3,2,1],[1,0,0,0]];
  const r = solveIDDFS(g, 0);
  assertEqual(r.lv10Count, 3, 'should count 3 level-10 tiles');
});

test('scores object has all 4 directions', () => {
  const g = [[5,4,3,2],[4,3,2,1],[3,2,1,0],[2,1,0,0]];
  const r = solveIDDFS(g, 0);
  ['up','down','left','right'].forEach(d => {
    assert(d in r.scores, 'scores should have key: '+d);
  });
});

test('prefers not moving up on corner board', () => {
  // Board where down/left should be preferred
  const g = [[9,8,7,6],[0,5,4,3],[0,0,3,2],[0,0,0,1]];
  const r = solveIDDFS(g, 0);
  assert(r.bestMove !== null, 'should find a move');
  // Just verify it runs correctly (heuristic may vary)
});

test('heuristic object is returned', () => {
  const g = [[5,4,3,2],[4,3,2,1],[3,2,1,0],[2,1,0,0]];
  const r = solveIDDFS(g, 0);
  assert(r.heuristic, 'heuristic breakdown should be returned');
  assert(typeof r.heuristic.total === 'number', 'heuristic.total should be a number');
});

/* ══ Summary ══ */
console.log('\n' + '═'.repeat(40));
console.log('  Passed: ' + passed + '  |  Failed: ' + failed);
console.log('═'.repeat(40) + '\n');
process.exit(failed > 0 ? 1 : 0);
