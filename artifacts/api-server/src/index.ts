import app from "./app";
import { logger } from "./lib/logger";
import { ensureHealthCommunities, ensureYuktiBot } from "./lib/startupSeed";

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

app.listen(port, (err) => {
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
