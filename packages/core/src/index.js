export { createService } from './service.js';
export { createMockProvider, statusAt } from './mockProvider.js';
export { analyzeMatch, phaseFor, scoreMatrix, ANALYSIS_WINDOW_HOURS } from './analysis.js';
export { liveState, simulateMatch, inPlayProbabilities, clockAt } from './live.js';
export { LEAGUES, TEAMS } from './teams.js';

import { createMockProvider } from './mockProvider.js';

/** DATA_PROVIDER env bo'yicha provider tanlash. Haqiqiy API qo'shilganda shu yerga qo'shiladi. */
export function createProvider(name = process.env.DATA_PROVIDER || 'mock') {
  switch (name) {
    case 'mock':
      return createMockProvider();
    default:
      throw new Error(`Noma'lum DATA_PROVIDER: ${name}. Hozircha faqat "mock" mavjud.`);
  }
}
