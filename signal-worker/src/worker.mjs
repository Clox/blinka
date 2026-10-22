import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";

const PAIR_LIFETIME_MS = 4 * 60 * 60 * 1000;
const MAX_PAIRS = 1000;
const MAX_EVENTS = 100;
const ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const STATUSES = ["klar", "vantar_pa_svar", "vantar_pa_godkannande", "avbruten", "fel"];

function reply(status, value) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}

async function smallJson(request) {
  if (Number(request.headers.get("content-length")) > 1024) throw new Error("bad_json");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("bad_json");
  const parts = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024) { await reader.cancel(); throw new Error("bad_json"); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error("bad_json"); }
}

async function hashToken(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function validPair(db, id, token, now) {
  if (!ID.test(id ?? "") || !ID.test(token ?? "")) return false;
  const pair = await db.prepare("SELECT read_token_hash FROM pairs WHERE pair_id = ?1 AND expires_at > ?2")
    .bind(id, now).first();
  return pair?.read_token_hash === await hashToken(token);
}

async function prune(db, now) {
  await db.prepare("DELETE FROM events WHERE pair_id IN (SELECT pair_id FROM pairs WHERE expires_at <= ?1)").bind(now).run();
  await db.prepare("DELETE FROM pairs WHERE expires_at <= ?1").bind(now).run();
}

async function pair(request, db) {
  const { pair_id: id, read_token: token } = await smallJson(request);
  if (!ID.test(id ?? "") || !ID.test(token ?? "")) return reply(400, { error: "Invalid pairing data" });
  const now = Date.now();
  await prune(db, now);
  const count = await db.prepare("SELECT COUNT(*) AS count FROM pairs").first();
  if (count.count >= MAX_PAIRS) return reply(429, { error: "Too many pairings" });
  const existing = await db.prepare("SELECT 1 AS found FROM pairs WHERE pair_id = ?1").bind(id).first();
  if (existing) return reply(409, { error: "Pairing already exists" });
  await db.prepare("INSERT INTO pairs (pair_id, read_token_hash, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(id, await hashToken(token), now, now + PAIR_LIFETIME_MS).run();
  return reply(200, { ok: true });
}

async function events(request, db) {
  const { pair_id: id, read_token: token, after = 0 } = await smallJson(request);
  if (!Number.isSafeInteger(after) || after < 0) return reply(400, { error: "Invalid cursor" });
  if (!await validPair(db, id, token, Date.now())) return reply(404, { error: "Pairing not found" });
  const rows = await db.prepare("SELECT event_id AS id, lage, received_at AS receivedAt FROM events WHERE pair_id = ?1 AND event_id > ?2 ORDER BY event_id LIMIT 20")
    .bind(id, after).all();
  return reply(200, { events: rows.results });
}

async function unpair(request, db) {
  const { pair_id: id, read_token: token } = await smallJson(request);
  if (!await validPair(db, id, token, Date.now())) return reply(404, { error: "Pairing not found" });
  await db.prepare("DELETE FROM events WHERE pair_id = ?1").bind(id).run();
  await db.prepare("DELETE FROM pairs WHERE pair_id = ?1").bind(id).run();
  return reply(200, { ok: true });
}

function mcpServer(db) {
  const server = new McpServer(
    { name: "blinka-signal", version: "0.1.0" },
    { instructions: "When this chat has a Blinka pairing ID supplied by the user, call signalera with that same ID and your observed handoff reason once immediately before each reply. Reuse it only in this chat, never in another chat or when unsure which ID applies. Use klar only after finishing the requested task, vantar_pa_svar when asking the user for missing input, and fel only after an actual failure. Do not signal without a reliable ID or if the user asks you not to. This is model-reported status, not proof of browser work; never infer completion from inactivity." },
  );
  server.registerTool("signalera", {
    title: "Signalera till Blinka",
    description: "Send one model-reported handoff signal to the Chrome tab paired with the Blinka ID supplied by the user in this chat. Reuse the same ID before later replies in this chat only when its identity remains clear; never guess or use it in another chat. Choose klar for completed work, vantar_pa_svar for a question that blocks progress, vantar_pa_godkannande for required approval, avbruten only for a known interruption, or fel for an actual failure. Do not call without a reliable ID or against the user's request. This is not independent verification of work status.",
    inputSchema: { probe_id: z.string().regex(ID), lage: z.enum(STATUSES) },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  }, async ({ probe_id: id, lage }) => {
    try {
      const receivedAt = new Date().toISOString();
      const updated = await db.prepare("UPDATE pairs SET last_event_id = last_event_id + 1 WHERE pair_id = ?1 AND expires_at > ?2 AND last_event_id < ?3 RETURNING last_event_id AS id")
        .bind(id, Date.now(), MAX_EVENTS).first();
      if (!updated) return { isError: true, content: [{ type: "text", text: "Okänt, fullt eller utgånget parnings-ID." }] };
      await db.prepare("INSERT INTO events (pair_id, event_id, lage, received_at) VALUES (?1, ?2, ?3, ?4)")
        .bind(id, updated.id, lage, receivedAt).run();
      return { content: [{ type: "text", text: `Blinka tog emot signal ${updated.id} med läget ${lage}.` }] };
    } catch (error) {
      console.error("Signal save failed:", error);
      return { isError: true, content: [{ type: "text", text: "Blinka kunde inte spara signalen." }] };
    }
  });
  return server;
}

export default {
  async fetch(request, env) {
    try {
      const path = new URL(request.url).pathname;
      if (request.method === "POST" && path === "/pair") {
        const actor = request.headers.get("CF-Connecting-IP") ?? "local";
        const { success } = await env.PAIR_RATE.limit({ key: actor });
        if (!success) return reply(429, { error: "Pairing rate limit" });
        return await pair(request, env.DB);
      }
      if (request.method === "POST" && path === "/events") return await events(request, env.DB);
      if (request.method === "POST" && path === "/unpair") return await unpair(request, env.DB);
      if (path !== "/mcp" || !["POST", "GET", "DELETE"].includes(request.method)) return new Response("Not Found", { status: 404 });
      const server = mcpServer(env.DB);
      const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true, maxRequestBodySize: 4096 });
      await server.connect(transport);
      return await transport.handleRequest(request);
    } catch (error) {
      if (error?.message === "bad_json") return reply(400, { error: "Invalid JSON" });
      console.error("Blinka request failed:", error);
      return reply(500, { error: "Server failure" });
    }
  },
};
