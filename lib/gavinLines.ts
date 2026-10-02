// Gavin's reactions for the end of a game.

/** Win reaction by number of guesses (1-6). */
export const WIN_REACTIONS: Record<number, string> = {
  1: "GENIUS. Gavin is speechless.",
  2: "Gavin is SO proud of you!",
  3: "Gavin approves.",
  4: "Solid. Gavin nods.",
  5: "Gavin was getting nervous...",
  6: "Phew! Gavin almost fainted."
};

export const WIN_TEXT = "You win! Gavin would be so proud of you!";

export function winReaction(guesses: number): string {
  return WIN_REACTIONS[Math.min(6, Math.max(1, Math.round(guesses)))];
}

/** Sad lines for a loss; one per day, rotating. */
export const LOSS_LINES = [
  "Gavin is severely disappointed.",
  "Gavin needs a moment alone.",
  "Gavin is not mad. Just disappointed.",
  "Gavin will remember this.",
  "Gavin has left the group chat.",
  "Gavin is staring out the window."
];

export function lossLine(dayIndex: number): string {
  const n = LOSS_LINES.length;
  return LOSS_LINES[((Math.floor(dayIndex) % n) + n) % n];
}

/** Leaderboard points for today: win = 7 - guesses (minus 1 with a hint, min 0), loss = 0. */
export function pointsToday(won: boolean, guesses: number, hintUsed: boolean): number {
  if (!won) return 0;
  return Math.max(0, 7 - Math.min(6, Math.max(1, guesses)) - (hintUsed ? 1 : 0));
}
