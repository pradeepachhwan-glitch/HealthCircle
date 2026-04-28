import { createServer } from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { ensureHealthCommunities, ensureYuktiBot } from "./lib/startupSeed";
import { attachTeleconsultSignaling } from "./lib/teleconsultSignaling";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = createServer(app);

// Attach WebSocket signaling for tele-consult video/audio/chat. Listens on
// /api/tc/ws/session/:id only; non-matching upgrade requests are ignored.
attachTeleconsultSignaling(server);

server.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Idempotent post-listen self-heal seeds. Runs after the port is bound so
  // a slow database can never block readiness. Failures are logged but never
  // crash the server.
  void ensureHealthCommunities();
  void ensureYuktiBot().catch(err => logger.warn({ err }, "ensureYuktiBot failed (non-fatal)"));
});
