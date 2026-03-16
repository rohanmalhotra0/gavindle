export const CUSTOM_SOLUTIONS = [
  "tomas", "colin", "timmy", "carys", "rohan", "dixie", "abbie", "asahi",
  "beers", "ethan", "smart", "mikey", "dance", "poker", "zachs", "zsliz",
  "booze", "siege", "harly", "conor", "vinki", "gavvy", "gmans", "nadia",
  "meera", "hispa", "pools", "drugs", "dwyer", "phebe", "drunk", "funny",
  "udayy", "vodka", "zynss", "goats", "pivot", "condo", "jerzy", "pizza",
  "slice", "sixin", "vroni", "psuva", "flush", "stock", "degen", "trade",
  "value", "drive", "fresh", "excel", "feast", "lukos", "lucky", "chino",
  "corse", "uncle", "bains", "uvaaa", "finan", "thors", "ippos", "anime",
  "sushi", "corny", "cunty", "lukoz", "wahoo", "hokie", "livia", "gavix",
  "haydn", "hedge", "quant", "sigma", "greek", "cents", "oddsy", "parks",
  "rally", "froth", "bluff", "stonk", "bread", "waves", "mocha", "clutch",
  "vibes", "bloom", "skate", "flint", "champ", "brisk", "glide", "crisp",
  "alpha", "basis", "delta", "theta", "gamma", "vegas", "yield", "bulls",
  "bears", "risky", "asset", "price", "chart", "candy", "money", "swaps",
  "macro", "micro", "split", "crown", "prime", "toast", "spicy", "sweat",
  "scoop", "swish", "hoops", "cline", "trend", "graph", "ratio", "penny",
  "coins", "audit", "kitty", "cabin", "chill", "laser", "basil", "mango",
  "pearl", "frost", "smirk", "shiny", "ghost", "storm", "quake", "torch",
  "racer", "fable", "tiger", "eagle", "shark", "otter", "whale", "zebra",
  "koala", "panda", "moose", "goose", "camel", "peach", "grape", "berry",
  "melon", "apple", "guava", "lemon", "cocoa", "cream", "syrup", "bagel",
  "nacho", "fries", "tacos", "ramen", "donut", "latte", "cider", "steak",
  "chess", "cards", "joker", "royal", "blitz", "arena", "quest", "rogue",
  "knock", "snipe", "creep", "glove", "smash", "swirl", "gleam", "flame",
  "spark", "tempo", "sonic", "vinyl", "lyric", "remix", "chord", "drums",
  "piano", "metal", "disco", "house", "funky", "jazzy", "hover", "pixel",
  "codec", "stack", "array", "queue", "bytes", "cache", "debug", "patch",
  "merge", "clone", "build", "scrum", "agile", "react", "flask", "swift",
  "linux", "shell", "logic", "proof", "model", "train", "epoch", "token",
  "agent", "llama", "sword", "armor", "cable", "radar", "drone", "orbit",
  "comet", "lunar", "solar", "venus", "earth", "pluto", "saturn", "marsy",
  "novae", "kings", "queer", "xerox", "vapor", "cubic", "dandy", "snack",
  "wrath", "mirth", "giddy", "bunny", "dream", "sleek", "tribe", "vital",
  "moral", "saint", "slyly", "witty", "zesty", "yeast", "noble", "civic",
  "bongo", "banjo", "kazoo", "fjord", "jolly", "mimic", "ninja", "olive",
  "perky", "quirk", "rumor", "sunny", "tulip", "ultra", "valor", "waltz",
  "yacht", "zonal", "adore", "brave", "caper", "dodge", "eclat", "fancy",
  "grind", "haste", "inbox", "jaunt", "kneel", "latch", "mirth", "nudge",
  "omega", "prism", "quirk", "rouge", "shard", "truce", "urban", "vigor",
  "woven", "yummy", "zippy", "aloft", "briar", "cairn", "dwell", "ember",
  "folly", "grove", "hasty", "ivory", "jewel", "knelt", "lumen", "mossy",
  "nifty", "opine", "pluck", "quell", "raven", "snarl", "trail", "udder",
  "vaunt", "woven", "yearn", "zesty", "amuse", "broil", "canny", "droll",
  "ensue", "flick", "gorge", "hound", "idiom", "jumpy", "karma", "lilac",
  "mauve", "niece", "oaken", "pique", "quasi", "riper", "sable", "tawny",
  "unify", "vixen", "weary", "xenon", "young", "zazzy"
] as const;

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


