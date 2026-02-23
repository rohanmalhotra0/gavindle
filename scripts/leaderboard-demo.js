#!/usr/bin/env node
/* eslint-disable no-console */

const path = require("node:path");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");

const {
  loadLeaderboard,
  saveLeaderboard,
  upsertPlayerResult,
  sortPlayersForLeaderboard
} = require("./leaderboard");

async function createPrompter() {
  if (stdin.isTTY) {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    return {
      ask: (q) => rl.question(q),
      close: () => rl.close()
    };
  }

  // Non-interactive (piped) mode: read all lines up-front.
  const input = await new Promise((resolve) => {
    let data = "";
    stdin.setEncoding("utf8");
    stdin.on("data", (chunk) => {
      data += chunk;
    });
    stdin.on("end", () => resolve(data));
    stdin.on("error", () => resolve(data));
    stdin.resume();
  });

  const lines = String(input).split(/\r?\n/);
  let i = 0;

  return {
    ask: async (q) => {
      stdout.write(q);
      return String(lines[i++] ?? "");
    },
    close: () => {}
  };
}

function formatPercent(n) {
  if (!Number.isFinite(n)) return "";
  return `${n.toFixed(1)}%`;
}

function formatNumberOrBlank(n, digits = 2) {
  if (n == null) return "";
  if (!Number.isFinite(n)) return "";
  return digits === 0 ? String(Math.round(n)) : n.toFixed(digits);
}

async function main() {
  const filePath = path.resolve(process.cwd(), "leaderboard.json");
  const prompt = await createPrompter();

  try {
    const name = (await prompt.ask("Display name: ")).trim();
    if (!name) throw new Error("Name is required.");

    const resultRaw = (await prompt.ask('Result ("win" or "loss"): ')).trim().toLowerCase();
    if (resultRaw !== "win" && resultRaw !== "loss") {
      throw new Error('Result must be "win" or "loss".');
    }

    /** @type {number | null | undefined} */
    let guesses = undefined;
    if (resultRaw === "win") {
      const g = (await prompt.ask("Guesses (1-6): ")).trim();
      const n = Number(g);
      if (!Number.isInteger(n) || n < 1 || n > 6) throw new Error("Guesses must be an integer 1-6.");
      guesses = n;
    } else {
      const g = (await prompt.ask("Guesses (optional; enter 6 or blank): ")).trim();
      if (g === "") guesses = undefined;
      else {
        const n = Number(g);
        if (!(n === 6)) throw new Error("For a loss, guesses must be 6 or blank.");
        guesses = 6;
      }
    }

    let leaderboard = await loadLeaderboard(filePath);
    leaderboard = upsertPlayerResult(leaderboard, {
      name,
      result: resultRaw,
      guesses: guesses ?? null
    });
    await saveLeaderboard(filePath, leaderboard);

    const players = Object.values(leaderboard.players || {});
    sortPlayersForLeaderboard(players);

    const rows = players.map((p, idx) => ({
      Rank: idx + 1,
      Player: p.displayName,
      "Win %": formatPercent(p.winPercentage),
      Played: p.gamesPlayed,
      Wins: p.wins,
      Losses: p.losses,
      "Best (guesses)": p.bestGuesses ?? "",
      "Avg (wins)": formatNumberOrBlank(p.avgGuessesOnWins, 2),
      "Streak (cur/best)": `${p.currentStreak}/${p.bestStreak}`,
      "Last played": p.lastPlayedAt ?? ""
    }));

    console.log("");
    console.log(`Saved to ${filePath}`);
    console.table(rows);
  } finally {
    prompt.close();
  }
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exitCode = 1;
});

