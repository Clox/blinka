import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const PAIR_LIFETIME_MS = 4 * 60 * 60 * 1000;
const MAX_EVENTS_PER_PAIR = 100;
const STATE_FILE = process.env.BLINKA_STATE_FILE;
const STATUSES = new Set(["klar", "vantar_pa_svar", "vantar_pa_godkannande", "avbruten", "fel"]);

function loadPairs() {
  if (!STATE_FILE) return new Map();
  let raw;
  try { raw = readFileSync(STATE_FILE, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return new Map(); throw error; }
  const saved = JSON.parse(raw);
  if (saved.version !== 1 || !Array.isArray(saved.pairs)) throw new Error("Invalid Blinka state file");
  const result = new Map();
  for (const [id, pair] of saved.pairs) {
    if (!/^[0-9a-f-]{36}$/.test(id) || !/^[0-9a-f-]{36}$/.test(pair.readToken) ||
      !Number.isSafeInteger(pair.createdAt) || !Number.isSafeInteger(pair.lastEventId) ||
      !Array.isArray(pair.events) || pair.events.some(event => !Number.isSafeInteger(event.id) ||
        !STATUSES.has(event.lage) || typeof event.receivedAt !== "string")) {
      throw new Error("Invalid Blinka state file");
    }
    if (Date.now() - pair.createdAt < PAIR_LIFETIME_MS) result.set(id, pair);
  }
  return result;
}

const pairs = loadPairs();
function savePairs() {
  if (!STATE_FILE) return;
  mkdirSync(dirname(STATE_FILE), { recursive: true, mode: 0o700 });
  const temp = `${STATE_FILE}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temp, JSON.stringify({ version: 1, pairs: [...pairs] }), { mode: 0o600, flag: "wx" });
  renameSync(temp, STATE_FILE);
}

function getPair(id) {
  const pair = pairs.get(id);
  if (pair && Date.now() - pair.createdAt < PAIR_LIFETIME_MS) return pair;
  if (pairs.delete(id)) savePairs();
  return null;
}

async function readSmallJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1024) throw new Error("Request too large");
  }
  return JSON.parse(raw);
}

function json(res, code, value) {
  res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
}
function requestError(res, error) {
  if (error instanceof SyntaxError || error?.message === "Request too large") return json(res, 400, { error: "Invalid JSON" });
  console.error("Blinka request failed:", error);
  return json(res, 500, { error: "Server state failure" });
}

function makeMcpServer() {
  const server = new McpServer(
    { name: "blinka-signal-probe", version: "0.4.0" },
    { instructions: "Blinka behavior test: When this chat has a Blinka pairing ID supplied by the user, call signalera with that same ID and your observed handoff reason once immediately before each reply. Reuse it only in this chat, never in another chat or when unsure which ID applies. Use klar only after finishing the requested task, vantar_pa_svar when asking the user for missing input, and fel only after an actual failure. Do not signal without a reliable ID or if the user asks you not to. This is model-reported status, not proof of browser work; never infer completion from inactivity." },
  );

  server.registerTool(
    "signalera",
    {
      title: "Signalera till Blinka (transportprov)",
      description: "Send one model-reported handoff signal to the Chrome tab paired with the Blinka ID supplied by the user in this chat. Reuse the same ID before later replies in this chat only when its identity remains clear; never guess or use it in another chat. Choose klar for completed work, vantar_pa_svar for a question that blocks progress, vantar_pa_godkannande for required approval, avbruten only for a known interruption, or fel for an actual failure. Do not call without a reliable ID or against the user's request. This is not independent verification of work status.",
      inputSchema: {
        probe_id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
        lage: z.enum(["klar", "vantar_pa_svar", "vantar_pa_godkannande", "avbruten", "fel"]),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ probe_id, lage }) => {
      const receivedAt = new Date().toISOString();
      const pair = getPair(probe_id);
      if (!pair) return { isError: true, content: [{ type: "text", text: "Okänt eller utgånget parnings-ID." }] };
      if (pair.events.length >= MAX_EVENTS_PER_PAIR) return { isError: true, content: [{ type: "text", text: "Parningens händelsekö är full." }] };
      const eventId = ++pair.lastEventId;
      pair.events.push({ id: eventId, lage, receivedAt });
      try { savePairs(); }
      catch (error) { pair.events.pop(); pair.lastEventId--; console.error("Blinka state save failed:", error); return { isError: true, content: [{ type: "text", text: "Kunde inte spara signalen." }] }; }
      console.log(JSON.stringify({ event: "signalera", probe_id, eventId, lage, receivedAt }));
      return {
        content: [{ type: "text", text: `Blinka-servern tog emot parnings-ID ${probe_id} med läget ${lage} kl. ${receivedAt}.` }],
      };
    },
  );

  return server;
}

createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/pair") {
    try {
      const { pair_id, read_token } = await readSmallJson(req);
      const valid = value => typeof value === "string" && /^[0-9a-f-]{36}$/.test(value);
      if (!valid(pair_id) || !valid(read_token)) return json(res, 400, { error: "Invalid pairing data" });
      for (const id of pairs.keys()) getPair(id);
      if (pairs.size >= 100) return json(res, 429, { error: "Too many pairings" });
      if (pairs.has(pair_id)) return json(res, 409, { error: "Pairing already exists" });
      pairs.set(pair_id, { readToken: read_token, createdAt: Date.now(), lastEventId: 0, events: [] });
      try { savePairs(); } catch (error) { pairs.delete(pair_id); throw error; }
      return json(res, 200, { ok: true });
    } catch (error) { return requestError(res, error); }
  }
  if (req.method === "POST" && req.url === "/events") {
    try {
      const { pair_id, read_token, after = 0 } = await readSmallJson(req);
      const pair = getPair(pair_id);
      if (!pair || pair.readToken !== read_token) return json(res, 404, { error: "Pairing not found" });
      if (!Number.isSafeInteger(after) || after < 0) return json(res, 400, { error: "Invalid cursor" });
      const remaining = pair.events.filter(event => event.id > after);
      if (remaining.length !== pair.events.length) {
        const previous = pair.events;
        pair.events = remaining;
        try { savePairs(); } catch (error) { pair.events = previous; throw error; }
      }
      return json(res, 200, { events: pair.events.slice(0, 20) });
    } catch (error) { return requestError(res, error); }
  }
  if (req.method === "POST" && req.url === "/unpair") {
    try {
      const { pair_id, read_token } = await readSmallJson(req);
      const pair = getPair(pair_id);
      if (!pair || pair.readToken !== read_token) return json(res, 404, { error: "Pairing not found" });
      pairs.delete(pair_id);
      try { savePairs(); } catch (error) { pairs.set(pair_id, pair); throw error; }
      return json(res, 200, { ok: true });
    } catch (error) { return requestError(res, error); }
  }
  if (req.url !== "/mcp" || !["POST", "GET", "DELETE"].includes(req.method)) {
    res.writeHead(404).end("Not Found");
    return;
  }

  const server = makeMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error("MCP request failed:", error);
    if (!res.headersSent) res.writeHead(500).end("Internal server error");
  }
}).listen(port, host, () => {
  console.log(`Blinka MCP transportprov: http://${host}:${port}/mcp`);
});
