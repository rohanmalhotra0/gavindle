/**
 * Leaderboard badges, computed client-side from a player's game rows.
 *
 * To add a badge, add one entry to BADGES (and, if it needs a new number, a field
 * to BadgeFacts filled in by computeBadgeFacts in lib/leaderboardStats.ts).
 * The array order is the display priority: the table shows the first 3 earned.
 */

/** Everything a badge rule may look at, derived from one player's rows. */
export type BadgeFacts = {
  gamesPlayed: number;
  /** Distinct days (date_key) played. */
  daysPlayed: number;
  wins: number;
  /** Wins where the hint was not used. */
  winsWithoutHint: number;
  /** Fewest guesses in any win (null when no wins). */
  bestGuesses: number | null;
  /** Longest run of consecutive days with a win. */
  bestWinStreak: number;
  /** Longest run of consecutive days played (win or loss). */
  bestPlayStreak: number;
};

export type BadgeDef = {
  id: string;
  emoji: string;
  name: string;
  /** How to earn it, shown in the player details. */
  description: string;
  earned: (facts: BadgeFacts) => boolean;
};

export const BADGES: readonly BadgeDef[] = [
  {
    id: "perfect-week",
    emoji: "\u{1F4AF}",
    name: "Perfect Week",
    description: "Won 7 days in a row",
    earned: (f) => f.bestWinStreak >= 7
  },
  {
    id: "genius",
    emoji: "\u{1F9E0}",
    name: "Genius",
    description: "Won in 1 or 2 guesses",
    earned: (f) => f.bestGuesses != null && f.bestGuesses <= 2
  },
  {
    id: "on-fire",
    emoji: "\u{1F525}",
    name: "On Fire",
    description: "Played 7 days in a row",
    earned: (f) => f.bestPlayStreak >= 7
  },
  {
    id: "no-hints",
    emoji: "\u{1F9CA}",
    name: "No Hints",
    description: "10 wins without using a hint",
    earned: (f) => f.winsWithoutHint >= 10
  },
  {
    id: "regular",
    emoji: "\u{1F3C3}",
    name: "Regular",
    description: "Played on 20 different days",
    earned: (f) => f.daysPlayed >= 20
  },
  {
    id: "first-win",
    emoji: "\u{1F3AF}",
    name: "First Win",
    description: "Won a game",
    earned: (f) => f.wins >= 1
  }
];

const BY_ID = new Map(BADGES.map((b) => [b.id, b]));

export function badgeById(id: string): BadgeDef | undefined {
  return BY_ID.get(id);
}

/** Ids of every earned badge, in display priority order. */
export function earnedBadgeIds(facts: BadgeFacts): string[] {
  return BADGES.filter((b) => b.earned(facts)).map((b) => b.id);
}

/** Merge badge id lists, keeping display priority order and dropping unknown ids. */
export function mergeBadgeIds(...lists: (readonly string[] | undefined)[]): string[] {
  const set = new Set<string>();
  for (const l of lists) for (const id of l ?? []) set.add(id);
  return BADGES.filter((b) => set.has(b.id)).map((b) => b.id);
}

/** Badge definitions for a list of ids (unknown ids skipped). */
export function badgesFromIds(ids: readonly string[] | undefined): BadgeDef[] {
  return mergeBadgeIds(ids).map((id) => BY_ID.get(id) as BadgeDef);
}
