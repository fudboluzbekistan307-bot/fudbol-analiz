import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createService, createMockProvider, scoreMatrix, analyzeMatch, phaseFor, simulateMatch } from '../src/index.js';

const HOUR = 3600_000;
const NOW = Date.parse('2026-09-23T10:30:00Z');
const service = createService(createMockProvider(), { clock: () => NOW });

test('ehtimollar yig\'indisi 1 ga teng', () => {
  const m = scoreMatrix(1.6, 1.1);
  assert.ok(Math.abs(m.homeWin + m.draw + m.awayWin - 1) < 0.001);
  assert.ok(m.homeWin > m.awayWin);
});

test('tahlil bosqichlari', () => {
  assert.equal(phaseFor(100).key, 'waiting');
  assert.equal(phaseFor(50).key, 'early');
  assert.equal(phaseFor(10).key, 'main');
  assert.equal(phaseFor(2).key, 'final');
});

test("o'yinlar ro'yxati va deterministiklik", () => {
  const a = service.listMatches();
  const b = service.listMatches();
  assert.ok(a.length > 5);
  assert.deepEqual(a.map((m) => m.id), b.map((m) => m.id));
  assert.ok(a.some((m) => m.status === 'live'), 'demo live o\'yin bo\'lishi kerak');
});

test('72 soatdan uzoq o\'yin uchun tahlil yopiq', () => {
  const far = service.listMatches().find((m) => Date.parse(m.kickoff) - NOW > 72 * HOUR);
  assert.ok(far);
  const a = service.getAnalysis(far.id);
  assert.equal(a.available, false);
});

test('yaqin o\'yin uchun to\'liq tahlil', () => {
  const near = service.listMatches().find((m) => m.status === 'scheduled' && Date.parse(m.kickoff) - NOW < 72 * HOUR);
  const a = service.getAnalysis(near.id);
  assert.equal(a.available, true);
  assert.ok(a.factors.length >= 8);
  assert.ok(a.expectedGoals.home > 0 && a.expectedGoals.away > 0);
  const p = a.probabilities;
  assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 0.001);
});

test('live holat', () => {
  const live = service.liveMatches()[0];
  const s = service.getLive(live.id);
  assert.equal(s.status, 'live');
  assert.ok(s.stats.possession.home + s.stats.possession.away === 100);
});

test("simulyatsiyada o'rtacha gollar λ ga yaqin", () => {
  let total = 0;
  const N = 400;
  for (let i = 0; i < N; i++) {
    const sim = simulateMatch({ id: `t${i}` }, { home: 1.5, away: 1.1 }, null);
    const last = sim.stats.at(-1).score;
    total += last.home + last.away;
  }
  const avg = total / N;
  assert.ok(avg > 2.0 && avg < 3.3, `o'rtacha ${avg}`);
});
