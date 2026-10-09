// Single source of truth for campus venues, categories and handoff checkpoints.
// The client fetches these from GET /api/meta, so edit them only here.

const letters = (from, to) => {
  const out = [];
  for (let c = from.charCodeAt(0); c <= to.charCodeAt(0); c++) out.push(String.fromCharCode(c));
  return out;
};

export const VENUE_GROUPS = [
  {
    group: 'Academic Blocks',
    venues: ['SJT', 'TT', 'PRP', 'SMV', 'MB', 'GDN', 'CDMM'],
  },
  {
    group: "Men's Hostels",
    venues: letters('A', 'T').map((l) => `MH-${l}`),
  },
  {
    group: "Ladies' Hostels",
    venues: letters('A', 'J').map((l) => `LH-${l}`),
  },
  {
    group: 'Food Courts',
    venues: ['Gazebo', 'Food Mall', 'DC'],
  },
  {
    group: 'Library',
    venues: ['Central Library'],
  },
  {
    group: 'Sports',
    venues: ['Sports Complex'],
  },
];

export const VENUES = VENUE_GROUPS.flatMap((g) => g.venues);

export const VENUE_TO_GROUP = Object.fromEntries(
  VENUE_GROUPS.flatMap((g) => g.venues.map((v) => [v, g.group])),
);

export const CATEGORIES = [
  'ID Cards',
  'Room Keys',
  'Calculators',
  'Lab Equipment',
  'Earphones',
  'Wallets',
];

// Staffed, well-lit spots where returns can be handed over safely.
export const CHECKPOINTS = [
  'SJT Ground Floor Reception',
  'Central Library Security Desk',
  'TT Ground Floor Reception',
  'PRP Main Entrance Security',
  'Main Gate Security Office',
  'Food Mall Entrance',
];

export const ITEM_TYPES = ['lost', 'found'];
