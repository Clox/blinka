import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const wrangler = new URL("../node_modules/.bin/wrangler", import.meta.url).pathname;

async function run(args) {
  const child = spawn(wrangler, args, { cwd: root.pathname, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", chunk => { output += chunk; });
  const code = await new Promise(resolve => child.on("exit", resolve));
  assert.equal(code, 0, output);
}

async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function post(base, path, body) {
  const response = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function rpc(base, id, method, params) {
  const result = await post(base, "/mcp", { jsonrpc: "2.0", id, method, params });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  return result.body.result;
}

test("flera parningar får endast sina egna numrerade signaler", async t => {
  const state = await mkdtemp(join(tmpdir(), "blinka-worker-"));
  t.after(() => rm(state, { recursive: true, force: true }));
  await run(["d1", "migrations", "apply", "blinka-signal", "--local", "--persist-to", state,
    "--config", "wrangler.example.jsonc"]);

  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(wrangler, ["dev", "--config", "wrangler.example.jsonc", "--persist-to", state,
    "--port", String(port), "--show-interactive-dev-session=false"],
  { cwd: root.pathname, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => child.kill("SIGTERM"));
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Wrangler exited: ${child.exitCode}`);
    try { if ((await fetch(base + "/unknown")).status === 404) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, "Wrangler did not start");

  const idA = randomUUID(), tokenA = randomUUID();
  const idB = randomUUID(), tokenB = randomUUID();
  assert.equal((await post(base, "/pair", { pair_id: idA, read_token: tokenA })).status, 200);
  assert.equal((await post(base, "/pair", { pair_id: idB, read_token: tokenB })).status, 200);
  assert.equal((await post(base, "/pair", { pair_id: idA, read_token: tokenA })).status, 409);
  assert.equal((await post(base, "/events", { pair_id: idA, read_token: tokenB })).status, 404);

  const init = await rpc(base, 1, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "1" } });
  assert.equal(init.serverInfo.name, "blinka-signal");
  const tools = await rpc(base, 2, "tools/list", {});
  assert.deepEqual(tools.tools.map(tool => tool.name), ["signalera"]);
  const first = await rpc(base, 3, "tools/call", { name: "signalera", arguments: { probe_id: idA, lage: "vantar_pa_svar" } });
  assert.equal(first.isError, undefined);
  const second = await rpc(base, 4, "tools/call", { name: "signalera", arguments: { probe_id: idA, lage: "klar" } });
  assert.equal(second.isError, undefined);

  const all = await post(base, "/events", { pair_id: idA, read_token: tokenA, after: 0 });
  assert.equal(all.status, 200);
  assert.deepEqual(all.body.events.map(event => [event.id, event.lage]), [[1, "vantar_pa_svar"], [2, "klar"]]);
  const later = await post(base, "/events", { pair_id: idA, read_token: tokenA, after: 1 });
  assert.deepEqual(later.body.events.map(event => event.id), [2]);
  const other = await post(base, "/events", { pair_id: idB, read_token: tokenB, after: 0 });
  assert.deepEqual(other.body.events, []);

  assert.equal((await post(base, "/unpair", { pair_id: idA, read_token: tokenA })).status, 200);
  assert.equal((await post(base, "/events", { pair_id: idA, read_token: tokenA })).status, 404);
  assert.equal((await post(base, "/events", { pair_id: idB, read_token: tokenB })).status, 200);
});
