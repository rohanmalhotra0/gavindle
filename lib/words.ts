export const CUSTOM_SOLUTIONS = ["tomas", "colin", "timmy", "carys", "rohan","dixie","abbie","asahi", 
  "gavin","carts","beers","ethan","smart","mikey","dance","drink","poker","lacyy","aidan","zachs","zsliz","abbys",
  "conor","vinki","gavvy","gmans","nadia","meera","hispa","pools","drugs","dwyer","phebe","drunk","funny","udayy",
  "naomi","saraa","mayor","verny","money","vodka","zynss","goats","pivot","condo","jerzy","pizza","slice",
  "stock","degen","trade","gambl","value","drive","fresh","dance","excel","feast","lukos","lukas","lucky","chino","corse","uncle",
  "bains","uvaaa","psutf","dance","finan","thors","ippos","anime","sushi","corny"]as const;

const length = CUSTOM_SOLUTIONS.length;
console.log(length);

  // for birthday do happy !!!!
export type Solution = typeof CUSTOM_SOLUTIONS[number];

function getESTDate(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  return {
    year: parseInt(parts.find(p => p.type === "year")?.value ?? "0", 10),
    month: parseInt(parts.find(p => p.type === "month")?.value ?? "0", 10),
    day: parseInt(parts.find(p => p.type === "day")?.value ?? "0", 10)
  };
}

function daysBetweenEST(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startEST = getESTDate(start);
  const endEST = getESTDate(end);
  const startUTC = Date.UTC(startEST.year, startEST.month - 1, startEST.day);
  const endUTC = Date.UTC(endEST.year, endEST.month - 1, endEST.day);
  return Math.floor((endUTC - startUTC) / msPerDay);
}

const EPOCH = new Date(Date.UTC(2024, 0, 1)); // 2024-01-01 UTC

// Specific date overrides (UTC), format YYYY-MM-DD
const DATE_OVERRIDES: Record<string, Solution> = {
  "2026-02-02": "tomas"
};

export function getDailyIndex(date: Date = new Date()): number {
  const days = daysBetweenEST(EPOCH, date);
  const len = CUSTOM_SOLUTIONS.length;
  return ((days % len) + len) % len;
}

export function getDailySolution(date: Date = new Date()): Solution {
  const est = getESTDate(date);
  const overrideKey = `${est.year}-${String(est.month).padStart(2, "0")}-${String(est.day).padStart(2, "0")}`;
  if (DATE_OVERRIDES[overrideKey]) {
    return DATE_OVERRIDES[overrideKey];
  }
  const index = getDailyIndex(date);
  return CUSTOM_SOLUTIONS[index];
}

export function normalizeGuess(input: string): string {
  return input.toLowerCase().replace(/[^a-z]/g, "").slice(0, 5);
}

export function isFiveLetters(input: string): boolean {
  return /^[a-z]{5}$/.test(input);
}


