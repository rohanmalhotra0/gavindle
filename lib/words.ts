export const CUSTOM_SOLUTIONS = ["tomas", "colin", "timmy", "carys", "rohan","dixie","abbie","asahi", 
  "gavin","carts","beers","ethan","smart","mikey","dance","drink","poker","lacyy","aidan","zachs","zsliz","abbys","conor",]as const;
const length = CUSTOM_SOLUTIONS.length;
console.log(length);

  // for birthday do happy !!!!
export type Solution = typeof CUSTOM_SOLUTIONS[number];

function daysBetweenUTC(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const startUTC = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUTC = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((endUTC - startUTC) / msPerDay);
}

const EPOCH = new Date(Date.UTC(2024, 0, 1)); // 2024-01-01 UTC

// Specific date overrides (UTC), format YYYY-MM-DD
const DATE_OVERRIDES: Record<string, Solution> = {
  "2026-02-02": "tomas"
};

export function getDailyIndex(date: Date = new Date()): number {
  const days = daysBetweenUTC(EPOCH, date);
  const len = CUSTOM_SOLUTIONS.length;
  return ((days % len) + len) % len;
}

export function getDailySolution(date: Date = new Date()): Solution {
  const overrideKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
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


