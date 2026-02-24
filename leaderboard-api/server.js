const http = require("node:http");
const { URL } = require("node:url");

const {
  loadLeaderboard,
  saveLeaderboard,
  upsertPlayerResult,
  withWriteLock
} = require("./leaderboardStore");

const PORT = Number(process.env.PORT || 8080);
const DATA_PATH = process.env.LEADERBOARD_PATH || "/data/leaderboard.json";
const MAX_BODY_BYTES = 32 * 1024;

function send(res, status, body, headers = {}) {
  const json = body == null ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers
  });
  res.end(json);
}

function corsHeaders(req) {
  // No auth; keep it simple.
  const origin = req.headers.origin || "*";
  return {
    "access-control-allow-origin": origin === "null" ? "*" : origin,
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600"
  };
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("Request too large."));
        req.destroy();
        return;
      }
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", () => reject(new Error("Request failed.")));
  });
}

const server = http.createServer(async (req, res) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/health") {
    send(res, 200, { ok: true }, headers);
    return;
  }

  if (url.pathname !== "/leaderboard") {
    send(res, 404, { error: "Not found" }, headers);
    return;
  }

  if (req.method === "GET") {
    const lb = await loadLeaderboard(DATA_PATH);
    send(res, 200, lb, headers);
    return;
  }

  if (req.method === "POST") {
    try {
      const body = await readJsonBody(req);
      const next = await withWriteLock(async () => {
        const lb = await loadLeaderboard(DATA_PATH);
        const updated = upsertPlayerResult(lb, {
          dateKey: body.dateKey,
          name: body.name,
          result: body.result,
          guesses: body.guesses
        });
        await saveLeaderboard(DATA_PATH, updated);
        return updated;
      });
      send(res, 200, next, headers);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Bad request.";
      send(res, 400, { error: msg }, headers);
    }
    return;
  }

  send(res, 405, { error: "Method not allowed" }, headers);
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Leaderboard API listening on :${PORT}`);
});

