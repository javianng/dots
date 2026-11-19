/**
 * Remote MCP endpoint for dots: https://<your-domain>/api/mcp/<MCP_SECRET>
 *
 * Add that URL in Claude → Settings → Connectors → Add custom connector, and
 * the agent can read and edit your habits (see lib/server/mcp-server.ts).
 * The secret in the path is the password: anyone with the full URL can edit
 * your habits, so keep it private and rotate MCP_SECRET if it leaks.
 * Other MCP clients can send it as `Authorization: Bearer <MCP_SECRET>`
 * to /api/mcp/bearer instead.
 *
 * Stateless Streamable HTTP: each request gets a fresh server, so it runs on
 * serverless hosting (Vercel) with nothing to keep between requests.
 */
import { createHash, timingSafeEqual } from "node:crypto";

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { storeContext } from "@/lib/server/habit-store";
import { createDotsMcpServer } from "@/lib/server/mcp-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MIN_SECRET_LENGTH = 32;

function sameSecret(given: string, expected: string) {
  // Hash first so the comparison takes the same time whatever the lengths.
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function authorized(request: Request, pathSecret: string) {
  const expected = process.env.MCP_SECRET ?? "";
  if (expected.length < MIN_SECRET_LENGTH) return "unconfigured" as const;
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1] ?? "";
  const given = pathSecret === "bearer" ? bearer : pathSecret;
  return sameSecret(given, expected);
}

async function handle(request: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  const auth = authorized(request, secret);
  if (auth === "unconfigured") {
    return new Response(`MCP_SECRET must be set (at least ${MIN_SECRET_LENGTH} characters).`, {
      status: 503,
    });
  }
  if (!auth) return new Response("Not found", { status: 404 });

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createDotsMcpServer({ store: storeContext });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    // JSON responses are complete once returned, so the server can go.
    void server.close();
  }
}

export { handle as DELETE, handle as GET, handle as POST };
