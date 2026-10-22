import { createServer } from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "127.0.0.1";

function makeMcpServer() {
  const server = new McpServer(
    { name: "blinka-signal-probe", version: "0.1.0" },
    { instructions: "For an explicit Blinka transport test, call signalera with the user's probe ID. This tool only confirms that an MCP call reached the server; it does not update a tab or prove task completion." },
  );

  server.registerTool(
    "signalera",
    {
      title: "Signalera till Blinka (transportprov)",
      description: "Use only when the user explicitly asks for a Blinka transport test. Sends a short test ID to the Blinka probe server and returns a receipt. This does not change Chrome or determine work status.",
      inputSchema: {
        probe_id: z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
    },
    async ({ probe_id }) => {
      const receivedAt = new Date().toISOString();
      console.log(JSON.stringify({ event: "signalera", probe_id, receivedAt }));
      return {
        content: [{ type: "text", text: `Blinka-servern tog emot test-ID ${probe_id} kl. ${receivedAt}.` }],
      };
    },
  );

  return server;
}

createServer(async (req, res) => {
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
