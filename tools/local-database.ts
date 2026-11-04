import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdir, open, readFile, readdir, unlink } from "node:fs/promises";
import path from "node:path";

export const runtimeDir = path.resolve(import.meta.dirname, "../.runtime");

async function acquireLock() {
  const file = path.join(runtimeDir, "development-database.lock");
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const handle = await open(file, "wx");
      await handle.writeFile(String(process.pid));
      await handle.close();
      return () => unlink(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const pid = Number(await readFile(file, "utf8"));
      if (!Number.isSafeInteger(pid) || pid <= 0)
        throw new Error("Database local đang khởi động. Vui lòng thử lại sau.");
      try {
        process.kill(pid, 0);
      } catch (failure) {
        if ((failure as NodeJS.ErrnoException).code === "ESRCH") {
          await unlink(file);
          continue;
        }
        throw failure;
      }
      throw new Error(
        "Database local đang được sử dụng. Hãy dừng tiến trình dev cũ trước.",
      );
    }
  }
  throw new Error("Chưa lấy được khóa database local.");
}

// Also used by isolated tests, so every added migration is exercised.
export async function migrateLocalDatabase(postgres: PGlite) {
  const directory = path.resolve(import.meta.dirname, "../prisma/migrations");
  await postgres.exec(
    'CREATE TABLE IF NOT EXISTS "_LocalMigration" ("name" TEXT PRIMARY KEY)',
  );
  const applied = await postgres.query<{ name: string }>(
    'SELECT "name" FROM "_LocalMigration"',
  );
  const known = new Set(applied.rows.map((row) => row.name));
  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of entries) {
    if (known.has(name)) continue;
    const sql = await readFile(
      path.join(directory, name, "migration.sql"),
      "utf8",
    );
    await postgres.transaction(async (tx) => {
      await tx.exec(sql);
      await tx.query('INSERT INTO "_LocalMigration" ("name") VALUES ($1)', [
        name,
      ]);
    });
  }
}

export async function startLocalDatabase(applyMigrations = true) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Database local chỉ dành cho môi trường phát triển.");
  await mkdir(runtimeDir, { recursive: true });
  const release = await acquireLock();
  let postgres: PGlite | undefined;
  let socket: PGLiteSocketServer | undefined;
  try {
    postgres = await PGlite.create(path.join(runtimeDir, "postgres"));
    if (applyMigrations) await migrateLocalDatabase(postgres);
    socket = new PGLiteSocketServer({
      db: postgres,
      host: "127.0.0.1",
      port: 0,
      maxConnections: 10,
    });
    await socket.start();
    const url = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
    return {
      url,
      close: async () => {
        await socket!.stop();
        await postgres!.close();
        await release();
      },
    };
  } catch (error) {
    await socket?.stop();
    await postgres?.close();
    await release();
    throw error;
  }
}
