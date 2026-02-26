export type PersistedGame = {
  dateKey: string;
  solution: string;
  guesses: string[];
  status: "ongoing" | "won" | "lost";
};

export type Stats = {
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  maxStreak: number;
  // distribution for 1..6
  guessDistribution: number[];
};

const GAME_KEY = "gavindle:game";
const STATS_KEY = "gavindle:stats";

export function getDateKey(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(d);
  const year = parts.find(p => p.type === "year")?.value ?? "";
  const month = parts.find(p => p.type === "month")?.value ?? "";
  const day = parts.find(p => p.type === "day")?.value ?? "";
  return `${year}-${month}-${day}`;
}

export function loadGame(): PersistedGame | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GAME_KEY);
    return raw ? (JSON.parse(raw) as PersistedGame) : null;
  } catch {
    return null;
  }
}

export function saveGame(game: PersistedGame) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GAME_KEY, JSON.stringify(game));
  } catch {
    // ignore
  }
}

export function loadStats(): Stats {
  if (typeof window === "undefined") {
    return {
      gamesPlayed: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: [0, 0, 0, 0, 0, 0]
    };
  }
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) {
      return {
        gamesPlayed: 0,
        wins: 0,
        currentStreak: 0,
        maxStreak: 0,
        guessDistribution: [0, 0, 0, 0, 0, 0]
      };
    }
    return JSON.parse(raw) as Stats;
  } catch {
    return {
      gamesPlayed: 0,
      wins: 0,
      currentStreak: 0,
      maxStreak: 0,
      guessDistribution: [0, 0, 0, 0, 0, 0]
    };
  }
}

export function saveStats(stats: Stats) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore
  }
}



