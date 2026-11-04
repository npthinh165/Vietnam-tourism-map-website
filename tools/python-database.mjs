// Development-only PostgreSQL transport. All API/business logic runs in Python.
import { startLocalDatabase } from "./local-database.ts";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

let database;
if (process.argv.includes("--memory")) {
  const postgres = await PGlite.create();
  const socket = new PGLiteSocketServer({ db: postgres, host: "127.0.0.1", port: 0, maxConnections: 10 });
  await socket.start();
  database = {
    url: `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`,
    close: async () => { await socket.stop(); await postgres.close(); },
  };
} else {
  database = await startLocalDatabase(false);
}
console.log(JSON.stringify({ databaseUrl: database.url }));
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await database.close();
  process.exit(0);
}
process.stdin.resume();
process.stdin.on("data", () => void close());
process.stdin.on("end", () => void close());
process.on("SIGINT", () => void close());
process.on("SIGTERM", () => void close());
