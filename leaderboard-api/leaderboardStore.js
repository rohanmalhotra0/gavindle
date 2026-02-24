const fs = require("node:fs/promises");
const path = require("node:path");

/**
 * @typedef {"win" | "loss"} GameResult
 *
 * @typedef {Object} PlayerRecord
 * @property {string} key
 * @property {string} displayName
 * @property {number} gamesPlayed
 * @property {number} wins
 * @property {number} losses
 * @property {number} winPercentage
 * @property {number | null} bestGuesses
 * @property {number} totalGuessesInWins
 * @property {number | null} avgGuessesOnWins
 * @property {number} currentStreak
 * @property {number} bestStreak
 * @property {string | null} lastPlayedAt
 *
 * @typedef {Object} LeaderboardFile
 * @property {1} version
 * @property {string} updatedAt
 * @property {Record<string, PlayerRecord>} players
 * @property {Record<string, Record<string, true>>=} submissions  // dateKey -> playerKey -> true
 */

function normalizeName(name) {
  return String(name).trim().toLowerCase().replace(/\s+/g, " ");
}

function emptyLeaderboard() {
  return { version: 1, updatedAt: new Date().toISOString(), players: {}, submissions: {} };
}

function isLeaderboardFile(maybe) {
  if (!maybe || typeof maybe !== "object") return false;
  if (maybe.version !== 1) return false;
  if (!maybe.players || typeof maybe.players !== "object") return false;
  return true;
}

function computeDerivedStats(player) {
  const gamesPlayed = Number.isFinite(player.gamesPlayed) ? player.gamesPlayed : 0;
  const wins = Number.isFinite(player.wins) ? player.wins : 0;
  const totalGuessesInWins = Number.isFinite(player.totalGuessesInWins) ? player.totalGuessesInWins : 0;

  const winPercentage = gamesPlayed > 0 ? (wins / gamesPlayed) * 100 : 0;
  const avgGuessesOnWins = wins > 0 ? totalGuessesInWins / wins : null;
  const bestGuesses = wins > 0 && Number.isFinite(player.bestGuesses) ? player.bestGuesses : null;

  return { winPercentage, avgGuessesOnWins, bestGuesses };
}

async function loadLeaderboard(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!isLeaderboardFile(parsed)) throw new Error("Invalid leaderboard shape");
    if (!parsed.submissions || typeof parsed.submissions !== "object") parsed.submissions = {};
    return parsed;
  } catch (err) {
    const code = err && typeof err === "object" ? err.code : undefined;
    if (code !== "ENOENT") {
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const dir = path.dirname(filePath);
      const base = path.basename(filePath, path.extname(filePath));
      const backup = path.join(dir, `${base}.corrupt.${ts}.json`);
      try {
        await fs.rename(filePath, backup);
      } catch {
        // ignore
      }
    }
    return emptyLeaderboard();
  }
}

async function saveLeaderboard(filePath, data) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  const normalized = {
    version: 1,
    updatedAt: new Date().toISOString(),
    players: data.players || {},
    submissions: data.submissions && typeof data.submissions === "object" ? data.submissions : {}
  };

  for (const key of Object.keys(normalized.players)) {
    const p = normalized.players[key];
    normalized.players[key] = { ...p, ...computeDerivedStats(p), key };
  }

  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  const json = JSON.stringify(normalized, null, 2) + "\n";
  await fs.writeFile(tmpPath, json, "utf8");
  await fs.rename(tmpPath, filePath);
}

function upsertPlayerResult(leaderboard, input) {
  const dateKey = String(input.dateKey || "").trim();
  if (!dateKey) throw new Error("dateKey is required.");

  const rawName = String(input.name || "");
  const key = normalizeName(rawName);
  if (!key) throw new Error("Name is required.");

  /** @type {GameResult} */
  const result = input.result;
  if (result !== "win" && result !== "loss") throw new Error('Result must be "win" or "loss".');

  const nowIso = new Date().toISOString();
  const players = leaderboard.players || (leaderboard.players = {});
  const submissions = leaderboard.submissions || (leaderboard.submissions = {});
  const day = submissions[dateKey] || (submissions[dateKey] = {});

  // Idempotent per (dateKey, playerKey): don't double count.
  if (day[key]) {
    const existing = players[key];
    if (existing) {
      existing.displayName = rawName.trim() || existing.displayName;
      players[key] = { ...existing, ...computeDerivedStats(existing), key };
    }
    return leaderboard;
  }

  /** @type {PlayerRecord} */
  const existing = players[key] || {
    key,
    displayName: rawName.trim() || key,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    winPercentage: 0,
    bestGuesses: null,
    totalGuessesInWins: 0,
    avgGuessesOnWins: null,
    currentStreak: 0,
    bestStreak: 0,
    lastPlayedAt: null
  };

  existing.displayName = rawName.trim() || existing.displayName;
  existing.gamesPlayed += 1;
  existing.lastPlayedAt = nowIso;

  if (result === "win") {
    const guesses = input.guesses;
    if (!Number.isInteger(guesses) || guesses < 1 || guesses > 6) {
      throw new Error("Guesses must be an integer from 1 to 6 for a win.");
    }
    existing.wins += 1;
    existing.totalGuessesInWins += guesses;
    existing.bestGuesses = existing.bestGuesses == null ? guesses : Math.min(existing.bestGuesses, guesses);
    existing.currentStreak += 1;
    existing.bestStreak = Math.max(existing.bestStreak, existing.currentStreak);
  } else {
    const guesses = input.guesses;
    if (!(guesses == null || guesses === 6)) {
      throw new Error("For a loss, guesses must be 6 or omitted.");
    }
    existing.losses += 1;
    existing.currentStreak = 0;
  }

  day[key] = true;
  players[key] = { ...existing, ...computeDerivedStats(existing), key };
  leaderboard.updatedAt = new Date().toISOString();

  return leaderboard;
}

// Serialize writes inside a single instance.
let writeChain = Promise.resolve();
function withWriteLock(fn) {
  writeChain = writeChain.then(fn, fn);
  return writeChain;
}

module.exports = {
  normalizeName,
  computeDerivedStats,
  loadLeaderboard,
  saveLeaderboard,
  upsertPlayerResult,
  withWriteLock
};

