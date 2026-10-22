import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { once } from "node:events";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  server.close();
  await once(server, "close");
  return port;
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test("en parning levererar flera händelser utan dubbletter", async t => {
  const port = await freePort();
  const server = spawn(process.execPath, [new URL("./server.mjs", import.meta.url).pathname], {
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => server.kill());
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      if ((await fetch(`${origin}/events`)).status === 404) { ready = true; break; }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  assert.equal(ready, true, "servern startade inte");

  const pairId = randomUUID(), readToken = randomUUID();
  assert.equal((await post(`${origin}/pair`, { pair_id: pairId, read_token: readToken })).status, 200);
  const client = new Client({ name: "blinka-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
  t.after(() => client.close());
  for (const lage of ["vantar_pa_svar", "klar"]) {
    const result = await client.callTool({ name: "signalera", arguments: { probe_id: pairId, lage } });
    assert.equal(result.isError, undefined);
  }

  const body = { pair_id: pairId, read_token: readToken };
  assert.deepEqual((await post(`${origin}/events`, { ...body, after: 0 })).body.events.map(e => [e.id, e.lage]), [
    [1, "vantar_pa_svar"], [2, "klar"],
  ]);
  assert.deepEqual((await post(`${origin}/events`, { ...body, after: 1 })).body.events.map(e => e.id), [2]);
  assert.deepEqual((await post(`${origin}/events`, { ...body, after: 2 })).body.events, []);
  assert.equal((await post(`${origin}/events`, { pair_id: pairId, read_token: randomUUID(), after: 0 })).status, 404);
  assert.equal((await post(`${origin}/unpair`, body)).status, 200);
  assert.equal((await post(`${origin}/events`, { ...body, after: 2 })).status, 404);
});

test("aktiv parning och händelse överlever serveromstart", async t => {
  const directory = mkdtempSync(join(tmpdir(), "blinka-state-test-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const stateFile = join(directory, "pairs.json");
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  async function start() {
    const child = spawn(process.execPath, [new URL("./server.mjs", import.meta.url).pathname], {
      env: { ...process.env, PORT: String(port), BLINKA_STATE_FILE: stateFile },
      stdio: ["ignore", "pipe", "pipe"],
    });
    for (let attempt = 0; attempt < 50; attempt++) {
      try { if ((await fetch(`${origin}/events`)).status === 404) return child; } catch {}
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    child.kill();
    throw new Error("servern startade inte");
  }
  let server = await start();
  t.after(() => server.kill());
  const pairId = randomUUID(), readToken = randomUUID();
  const body = { pair_id: pairId, read_token: readToken };
  assert.equal((await post(`${origin}/pair`, body)).status, 200);
  const client = new Client({ name: "blinka-restart-test", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp`)));
  assert.equal((await client.callTool({ name: "signalera", arguments: { probe_id: pairId, lage: "klar" } })).isError, undefined);
  await client.close();
  assert.equal(statSync(stateFile).mode & 0o777, 0o600);
  server.kill();
  await once(server, "exit");
  server = await start();
  assert.deepEqual((await post(`${origin}/events`, { ...body, after: 0 })).body.events.map(e => [e.id, e.lage]), [[1, "klar"]]);
  assert.equal((await post(`${origin}/unpair`, body)).status, 200);
});
