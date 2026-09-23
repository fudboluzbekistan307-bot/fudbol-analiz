// Yuqori darajadagi servis: provider + tahlil + live ni birlashtiradi.
// API server ham, Telegram bot ham faqat shu servis orqali ishlaydi.

import { analyzeMatch, phaseFor } from './analysis.js';
import { liveState } from './live.js';

const HOUR = 3600_000;

export function createService(provider, { clock = () => Date.now() } = {}) {
  // Live simulyatsiya uchun o'yin oldi λ (kickoffdan 1 daqiqa oldingi yakuniy tahlil)
  const preMatchCache = new Map();
  function preMatch(match) {
    if (preMatchCache.has(match.id)) return preMatchCache.get(match.id);
    const at = Date.parse(match.kickoff) - 60_000;
    const ctx = provider.getContext(match, at);
    const a = analyzeMatch(match, ctx, at);
    const v = { lambdas: a.expectedGoals, referee: ctx.referee, probabilities: a.probabilities };
    preMatchCache.set(match.id, v);
    if (preMatchCache.size > 2000) preMatchCache.delete(preMatchCache.keys().next().value);
    return v;
  }

  function summary(match, now) {
    const hours = (Date.parse(match.kickoff) - now) / HOUR;
    const out = { ...match, phase: phaseFor(hours) };
    if (match.status !== 'scheduled') {
      const pm = preMatch(match);
      const live = liveState(match, pm.lambdas, pm.referee, now);
      out.score = live.score;
      out.clock = live.clock;
    }
    if (hours <= 72) {
      if (match.status === 'scheduled') {
        const a = analyzeMatch(match, provider.getContext(match, now), now);
        out.probabilities = a.probabilities;
        out.expectedGoals = a.expectedGoals;
        out.confidence = a.confidence;
      } else {
        out.probabilities = preMatch(match).probabilities;
      }
    }
    return out;
  }

  return {
    providerName: provider.name,

    listMatches({ from, to } = {}) {
      const now = clock();
      const f = from ?? now - 24 * HOUR;
      const t = to ?? now + 7 * 24 * HOUR;
      return provider.listMatches({ from: f, to: t, now }).map((m) => summary(m, now));
    },

    liveMatches() {
      const now = clock();
      return provider
        .listMatches({ from: now - 3 * HOUR, to: now, now })
        .filter((m) => m.status === 'live')
        .map((m) => summary(m, now));
    },

    getMatch(id) {
      const now = clock();
      const m = provider.getMatch(id, now);
      return m ? summary(m, now) : null;
    },

    getAnalysis(id) {
      const now = clock();
      const m = provider.getMatch(id, now);
      if (!m) return null;
      if (m.status !== 'scheduled') {
        // O'yin boshlangan — yakuniy (kickoff oldi) tahlilni qaytaramiz
        const at = Date.parse(m.kickoff) - 60_000;
        return { ...analyzeMatch(m, provider.getContext(m, at), at), frozen: true };
      }
      return analyzeMatch(m, provider.getContext(m, now), now);
    },

    /** Tahlil qanday o'zgarib borganini ko'rsatish uchun: 72h, 48h, 24h, 6h, 1h nuqtalar. */
    getAnalysisTimeline(id) {
      const now = clock();
      const m = provider.getMatch(id, now);
      if (!m) return null;
      const ko = Date.parse(m.kickoff);
      return [72, 48, 24, 6, 1]
        .map((h) => ko - h * HOUR)
        .filter((t) => t <= now)
        .map((t) => {
          const a = analyzeMatch(m, provider.getContext(m, t), t);
          return { at: new Date(t).toISOString(), hoursBefore: Math.round((ko - t) / HOUR), phase: a.phase, probabilities: a.probabilities, expectedGoals: a.expectedGoals, confidence: a.confidence };
        });
    },

    getLive(id) {
      const now = clock();
      const m = provider.getMatch(id, now);
      if (!m) return null;
      const pm = preMatch(m);
      return { ...liveState(m, pm.lambdas, pm.referee, now), preMatch: pm.probabilities };
    },
  };
}
