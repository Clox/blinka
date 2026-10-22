import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";
const pairs = new Map();
const PAIR_LIFETIME_MS = 30 * 60 * 1000;

function getPair(id) {
  const pair = pairs.get(id);
  if (pair && Date.now() - pair.createdAt < PAIR_LIFETIME_MS) return pair;
  pairs.delete(id);
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

function makeMcpServer() {
  const server = new McpServer(
    { name: "blinka-signal-probe", version: "0.3.0" },
    { instructions: "Blinka behavior test: When the current user message includes a Blinka pairing ID, call signalera with that ID and your observed handoff reason once immediately before your reply. Use klar only after finishing the requested task, vantar_pa_svar when asking the user for missing input, and fel only after an actual failure. Do not signal without an ID or if the user asks you not to. This is model-reported status, not proof of browser work; never infer completion from inactivity." },
  );

  server.registerTool(
    "signalera",
    {
      title: "Signalera till Blinka (transportprov)",
      description: "Send one model-reported handoff signal to the Chrome tab paired with the Blinka ID in the current user message. In this test call once before replying, even if the user does not name this tool. Choose klar for completed work, vantar_pa_svar for a question that blocks progress, vantar_pa_godkannande for required approval, avbruten only for a known interruption, or fel for an actual failure. Do not call without an ID or against the user's request. This is not independent verification of work status.",
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
      pair.status = "attention";
      pair.lage = lage;
      console.log(JSON.stringify({ event: "signalera", probe_id, lage, receivedAt }));
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
      if (pairs.size >= 100) return json(res, 429, { error: "Too many pairings" });
      if (pairs.has(pair_id)) return json(res, 409, { error: "Pairing already exists" });
      pairs.set(pair_id, { readToken: read_token, createdAt: Date.now(), status: "pending" });
      return json(res, 200, { ok: true });
    } catch { return json(res, 400, { error: "Invalid JSON" }); }
  }
  if (req.method === "POST" && req.url === "/events") {
    try {
      const { pair_id, read_token } = await readSmallJson(req);
      const pair = getPair(pair_id);
      if (!pair || pair.readToken !== read_token) return json(res, 404, { error: "Pairing not found" });
      return json(res, 200, { status: pair.status, lage: pair.lage ?? null });
    } catch { return json(res, 400, { error: "Invalid JSON" }); }
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
