import { getDailyIndex } from "@/lib/words";

export const ROHAN_QUOTES = [
  "Gavindle doesn't reward hope. It rewards process.",
  "Confidence is built in practice, not in guess three.",
  "If you want green, earn it.",
  "Lock in. Then let the tiles speak.",
  "You don't need luck. You need a plan.",
  "Every guess should do a job.",
  "Guessing random is donating attempts.",
  "Play calm. Play sharp.",
  "Execution beats emotion every time.",
  "Speed is cool. Precision is deadly.",
  "Your streak is your discipline in public.",
  "Today's puzzle is a mirror.",
  "No tilt. Just tactics.",
  "A great solve is just good habits stacked.",
  "You can't bluff the board.",
  "Intentional guesses win games.",
  "Don't chase the answer. Box it in.",
  "Control the letters. Control the outcome."
];

export function getRohanQuote(d: Date = new Date()): string {
  const idx = getDailyIndex(d);
  return ROHAN_QUOTES[((idx % ROHAN_QUOTES.length) + ROHAN_QUOTES.length) % ROHAN_QUOTES.length];
}
