// Mock ligalar va jamoalar. rating — Elo uslubidagi kuch, attack/defense — 1.0 atrofida koeffitsiyent.
// Futbolchilar ismlari to'qima (mock), haqiqiy o'yinchilarga tegishli emas.

export const LEAGUES = [
  { id: 'epl', name: 'Premier League', country: 'Angliya', flag: '🏴' },
  { id: 'laliga', name: 'La Liga', country: 'Ispaniya', flag: '🇪🇸' },
  { id: 'uzsl', name: 'Superliga', country: "O'zbekiston", flag: '🇺🇿' },
];

const T = (id, name, short, leagueId, rating, attack, defense, city, stadium) => ({
  id, name, short, leagueId, rating, attack, defense, city, stadium,
});

export const TEAMS = [
  T('ars', 'Arsenal', 'ARS', 'epl', 1905, 1.18, 0.82, 'London', 'Emirates Stadium'),
  T('mci', 'Manchester City', 'MCI', 'epl', 1930, 1.25, 0.84, 'Manchester', 'Etihad Stadium'),
  T('liv', 'Liverpool', 'LIV', 'epl', 1915, 1.24, 0.86, 'Liverpool', 'Anfield'),
  T('che', 'Chelsea', 'CHE', 'epl', 1840, 1.10, 0.92, 'London', 'Stamford Bridge'),
  T('tot', 'Tottenham', 'TOT', 'epl', 1800, 1.12, 1.02, 'London', 'Tottenham Hotspur Stadium'),
  T('new', 'Newcastle', 'NEW', 'epl', 1810, 1.05, 0.93, 'Newcastle', "St James' Park"),
  T('avl', 'Aston Villa', 'AVL', 'epl', 1795, 1.06, 0.97, 'Birmingham', 'Villa Park'),
  T('mun', 'Manchester United', 'MUN', 'epl', 1780, 1.00, 1.00, 'Manchester', 'Old Trafford'),

  T('rma', 'Real Madrid', 'RMA', 'laliga', 1940, 1.26, 0.83, 'Madrid', 'Santiago Bernabéu'),
  T('bar', 'Barcelona', 'BAR', 'laliga', 1925, 1.28, 0.90, 'Barcelona', 'Camp Nou'),
  T('atm', 'Atlético Madrid', 'ATM', 'laliga', 1860, 1.02, 0.80, 'Madrid', 'Metropolitano'),
  T('ath', 'Athletic Club', 'ATH', 'laliga', 1790, 0.98, 0.92, 'Bilbao', 'San Mamés'),
  T('vil', 'Villarreal', 'VIL', 'laliga', 1775, 1.04, 1.00, 'Villarreal', 'La Cerámica'),
  T('rso', 'Real Sociedad', 'RSO', 'laliga', 1765, 0.96, 0.95, 'San Sebastián', 'Anoeta'),
  T('bet', 'Real Betis', 'BET', 'laliga', 1760, 1.00, 1.00, 'Sevilya', 'Benito Villamarín'),
  T('sev', 'Sevilla', 'SEV', 'laliga', 1735, 0.94, 1.02, 'Sevilya', 'Ramón Sánchez-Pizjuán'),

  T('pak', 'Paxtakor', 'PAK', 'uzsl', 1620, 1.12, 0.88, 'Toshkent', 'Paxtakor Markaziy'),
  T('nas', 'Nasaf', 'NAS', 'uzsl', 1610, 1.08, 0.90, 'Qarshi', 'Qarshi Markaziy'),
  T('nav', 'Navbahor', 'NAV', 'uzsl', 1575, 1.00, 0.95, 'Namangan', 'Markaziy stadion'),
  T('qiz', 'Qizilqum', 'QIZ', 'uzsl', 1470, 0.90, 1.10, 'Zarafshon', 'Yoshlar stadioni'),
  T('agm', 'AGMK', 'AGM', 'uzsl', 1560, 1.00, 0.97, 'Olmaliq', 'Metallurg'),
  T('bun', 'Bunyodkor', 'BUN', 'uzsl', 1540, 0.97, 1.00, 'Toshkent', 'Milliy stadion'),
  T('nef', "Neftchi", 'NEF', 'uzsl', 1555, 1.00, 0.98, "Farg'ona", 'Istiqlol'),
  T('sog', "So'g'diyona", 'SOG', 'uzsl', 1500, 0.94, 1.05, 'Jizzax', "Sog'diyona"),
];

const FIRST = ['Aziz', 'Bekzod', 'Jasur', 'Sardor', 'Otabek', 'Diyor', 'Eldor', 'Rustam', 'Marco', 'Luis', 'Tom', 'Jack', 'Pablo', 'Adrien', 'Ivan', 'Kenji'];
const LAST = ['Karimov', 'Toshev', 'Rahimov', 'Olimov', 'Silva', 'Hart', 'Moreno', 'Lindqvist', 'Novak', 'Duarte', 'Brooks', 'Yusupov', 'Haydarov', 'Costa', 'Weber', 'Sato'];
const POSITIONS = [
  { pos: 'GK', label: 'Darvozabon' },
  { pos: 'DF', label: 'Himoyachi' },
  { pos: 'DF', label: 'Himoyachi' },
  { pos: 'DF', label: 'Himoyachi' },
  { pos: 'MF', label: 'Yarim himoyachi' },
  { pos: 'MF', label: 'Yarim himoyachi' },
  { pos: 'MF', label: 'Yarim himoyachi' },
  { pos: 'FW', label: 'Hujumchi' },
  { pos: 'FW', label: 'Hujumchi' },
  { pos: 'FW', label: 'Hujumchi' },
];

/** Jamoaning asosiy tarkibi (mock). importance: 0..1 — o'yinchining jamoa uchun ahamiyati. */
export function squadFor(team, rng) {
  return POSITIONS.map((p, i) => ({
    id: `${team.id}-p${i}`,
    name: `${rng.pick(FIRST)} ${rng.pick(LAST)}`,
    position: p.pos,
    positionLabel: p.label,
    importance: Number(rng.float(i === 0 ? 0.5 : 0.25, i >= 7 ? 1 : 0.8).toFixed(2)),
  }));
}

export const teamById = (id) => TEAMS.find((t) => t.id === id);
export const leagueById = (id) => LEAGUES.find((l) => l.id === id);
