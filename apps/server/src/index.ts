import "dotenv/config";
import { resolve } from "path";
import { startGodhandServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3001);
const DB_PATH = resolve(process.env.DB_PATH ?? "./data/godhand.db");

async function main() {
  const handle = await startGodhandServer({ port: PORT, dbPath: DB_PATH, logger: true });
  console.log(`GodHand server running on ${handle.url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
