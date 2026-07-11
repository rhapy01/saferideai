import { config } from "dotenv";
import path from "node:path";
import { existsSync } from "node:fs";

// Must load before importing app/db (those read process.env at module init)
for (const candidate of [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../../../.env"),
]) {
  if (existsSync(candidate)) {
    config({ path: candidate, override: false });
    break;
  }
}

const { default: app } = await import("./app");
const { logger } = await import("./lib/logger");

const rawPort = process.env["PORT"] || "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, () => {
  logger.info({ port }, "Server listening");
});
