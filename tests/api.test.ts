import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";
import { pythonCommand } from "../tools/python.mjs";
import type { SessionUser, TravelPlan } from "../shared/travel.ts";
import type { ManagedPlace } from "../shared/places.ts";
import { migrateLocalDatabase } from "../tools/local-database.ts";

test(
  "real HTTP routes against an isolated PostgreSQL-compatible database",
  { timeout: 120000 },
  async (t) => {
    const postgres = await PGlite.create();
    await migrateLocalDatabase(postgres);
    const socket = new PGLiteSocketServer({
      db: postgres,
      host: "127.0.0.1",
      port: 0,
      maxConnections: 10,
    });
    await socket.start();
    process.env.NODE_ENV = "test";
    process.env.APP_URL = "http://localhost:3000";
    process.env.DATABASE_URL = `postgresql://postgres:postgres@${socket.getServerConn()}/postgres?connection_limit=1`;
    const { db } = await import("../server/db.ts");
    // Exercise the Python migration runner against the old local history too.
    const migrate = spawn(pythonCommand(), ["-X", "utf8", "-m", "backend", "migrate"], {
      stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    });
    let migrationError = "";
    migrate.stderr.on("data", (chunk) => { migrationError += chunk.toString(); });
    const [migrationCode] = await once(migrate, "exit");
    assert.equal(migrationCode, 0, migrationError);
    const server = spawn(pythonCommand(), ["-X", "utf8", "tools/python-test-server.py"], {
      stdio: ["pipe", "pipe", "pipe"], windowsHide: true,
    });
    let diagnostics = "";
    server.stderr.on("data", (chunk) => { diagnostics += chunk.toString(); });
    t.after(async () => {
      if (server.exitCode === null) {
        const exited = once(server, "exit");
        server.stdin.end("close\n");
        const timeout = setTimeout(() => server.kill(), 10000);
        await exited;
        clearTimeout(timeout);
      }
      await db.$disconnect();
      await socket.stop();
      await postgres.close();
    });
    const port = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Python startup timeout: ${diagnostics}`)), 30000);
      const lines = createInterface({ input: server.stdout });
      lines.on("line", (line) => {
        if (line.startsWith("PYTHON_API_PORT=")) {
          clearTimeout(timer);
          resolve(line.split("=")[1]);
        }
      });
      server.once("error", reject);
      server.once("exit", () => { clearTimeout(timer); reject(new Error(diagnostics)); });
    });
    const base = `http://127.0.0.1:${port}`;
    type Client = { cookie: string; csrf: string; user?: SessionUser };
    const alice: Client = { cookie: "", csrf: "" },
      bob: Client = { cookie: "", csrf: "" },
      guest: Client = { cookie: "", csrf: "" };
    async function api(
      client: Client,
      path: string,
      method = "GET",
      body?: unknown,
      extra: Record<string, string> = {},
    ) {
      const response = await fetch(base + path, {
        method,
        headers: {
          Origin: "http://localhost:3000",
          "Content-Type": "application/json",
          Cookie: client.cookie,
          "X-CSRF-Token": client.csrf,
          ...extra,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const data = response.status === 204 ? null : await response.json();
      if (response.status >= 500) console.error(diagnostics.slice(-2500));
      return { status: response.status, data, response };
    }
    async function signup(client: Client, email: string) {
      const result = await api(client, "/api/auth/signup", "POST", {
        name: email.split("@")[0],
        email,
        password: "a secure password 2026",
      });
      assert.equal(result.status, 201, JSON.stringify(result.data));
      client.cookie = result.response.headers.get("set-cookie")!.split(";")[0];
      client.csrf = result.data.csrfToken;
      client.user = result.data.user;
      assert.match(result.response.headers.get("set-cookie")!, /HttpOnly/i);
      assert.equal(client.user!.points, 50);
      assert.equal(result.data.user.passwordHash, undefined);
    }
    await t.test(
      "bcrypt signup, normalized unique emails, credential failure and session expiry",
      async () => {
        await signup(alice, "Alice@example.com");
        await signup(bob, "bob@example.com");
        const stored = await db.user.findUniqueOrThrow({
          where: { id: alice.user!.id },
        });
        assert.match(stored.passwordHash, /^\$2[ab]\$12\$/);
        assert.equal(stored.email, "alice@example.com");
        assert.equal(
          (
            await api(guest, "/api/auth/signup", "POST", {
              name: "Duplicate",
              email: "ALICE@EXAMPLE.COM",
              password: "a secure password 2026",
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await api(guest, "/api/auth/signin", "POST", {
              email: "alice@example.com",
              password: "wrong",
            })
          ).status,
          401,
        );
        assert.equal(
          (await api(alice, "/api/auth/session")).data.user.id,
          alice.user!.id,
        );
        const raw = alice.cookie.split("=")[1];
        assert.equal(
          await db.session.findUnique({ where: { tokenHash: raw } }),
          null,
        );
      },
    );
    let postId = "";
    await t.test(
      "member login, admin login and server-side role protection",
      async () => {
        assert.equal(alice.user!.role, "USER");
        assert.equal((await api(guest, "/api/admin/overview")).status, 401);
        assert.equal((await api(alice, "/api/admin/overview")).status, 403);
        assert.equal((await api(alice, "/api/admin/users")).status, 403);
        const credentials = {
          email: "alice@example.com",
          password: "a secure password 2026",
        };
        const denied = await api(
          guest,
          "/api/auth/admin/signin",
          "POST",
          credentials,
        );
        assert.equal(denied.status, 403);
        assert.equal(denied.response.headers.get("set-cookie"), null);
        const forged = await api(guest, "/api/auth/signup", "POST", {
          ...credentials,
          email: "forged@example.com",
          name: "Forged",
          role: "ADMIN",
        });
        assert.equal(forged.status, 422);
        assert.equal(
          await db.user.count({ where: { email: "forged@example.com" } }),
          0,
        );
        const signedIn = await api(
          guest,
          "/api/auth/signin",
          "POST",
          credentials,
          { Origin: "http://127.0.0.1:3000" },
        );
        assert.equal(signedIn.status, 200);
        const member: Client = {
          cookie: signedIn.response.headers.get("set-cookie")!.split(";")[0],
          csrf: signedIn.data.csrfToken,
        };
        assert.equal(
          (await api(member, "/api/auth/session")).data.user.id,
          alice.user!.id,
        );
        assert.equal(
          (await api(member, "/api/auth/signout", "POST", {})).status,
          204,
        );
        assert.equal((await api(member, "/api/auth/session")).data.user, null);

        // Granting a role is a trusted database operation, never a signup field.
        await db.user.update({
          where: { id: bob.user!.id },
          data: { role: "ADMIN" },
        });
        const adminCredentials = {
          email: "bob@example.com",
          password: "a secure password 2026",
        };
        const failed = await api(guest, "/api/auth/admin/signin", "POST", {
          ...adminCredentials,
          password: "wrong",
        });
        assert.equal(failed.status, 401);
        const result = await api(
          guest,
          "/api/auth/admin/signin",
          "POST",
          adminCredentials,
        );
        assert.equal(result.status, 200);
        assert.equal(result.data.user.role, "ADMIN");
        assert.equal(result.data.user.passwordHash, undefined);
        const admin: Client = {
          cookie: result.response.headers.get("set-cookie")!.split(";")[0],
          csrf: result.data.csrfToken,
        };
        assert.equal((await api(admin, "/api/admin/overview")).data.users, 2);
        const directory = await api(admin, "/api/admin/users");
        assert.equal(directory.status, 200);
        assert.equal(directory.data.items.length, 2);
        assert.equal(directory.data.items[0].passwordHash, undefined);
        assert.equal(
          (await api(admin, "/api/admin/users?cursor=invalid")).status,
          400,
        );
        const placeInput = {
          name: "Điểm tham quan thử nghiệm",
          provinceId: 16,
          category: "History",
          season: "AllYear",
          address: "Khu trung tâm Hà Nội",
          lat: 21.0285,
          lng: 105.8542,
          description: "Giới thiệu điểm đến với không gian văn hóa và lịch sử.",
          article:
            "Bài mô tả chi tiết.\n\nĐoạn thứ hai về trải nghiệm tham quan.",
          imageUrl: "",
        };
        assert.equal(
          (await api(guest, "/api/admin/places", "POST", placeInput)).status,
          401,
        );
        assert.equal(
          (await api(alice, "/api/admin/places", "POST", placeInput)).status,
          403,
        );
        assert.equal(
          (
            await api(admin, "/api/admin/places", "POST", placeInput, {
              "X-CSRF-Token": "",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await api(admin, "/api/admin/places", "POST", {
              ...placeInput,
              provinceId: 999,
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await api(admin, "/api/admin/places", "POST", {
              ...placeInput,
              lat: 91,
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await api(admin, "/api/admin/places", "POST", {
              ...placeInput,
              imageUrl: "javascript:alert(1)",
            })
          ).status,
          422,
        );
        const createdPlace = await api(
          admin,
          "/api/admin/places",
          "POST",
          placeInput,
        );
        assert.equal(
          createdPlace.status,
          201,
          JSON.stringify(createdPlace.data),
        );
        assert.ok(createdPlace.data.id > 100000);
        assert.equal(createdPlace.data.version, 1);
        const publicPlaces = await api(guest, "/api/v1/places");
        assert.equal(publicPlaces.status, 200);
        assert.equal(
          publicPlaces.data.find(
            (p: ManagedPlace) => p.id === createdPlace.data.id,
          ).article,
          placeInput.article,
        );
        assert.equal(
          (await api(admin, "/api/admin/places")).data.some(
            (p: ManagedPlace) => p.id === createdPlace.data.id,
          ),
          true,
        );
        const placePath = `/api/admin/places/${createdPlace.data.id}`;
        assert.equal(
          (await api(alice, placePath, "PUT", { ...placeInput, version: 1 }))
            .status,
          403,
        );
        const updatedPlace = await api(admin, placePath, "PUT", {
          ...placeInput,
          article: "Nội dung đã biên tập.",
          version: 1,
        });
        assert.equal(updatedPlace.status, 200);
        assert.equal(updatedPlace.data.version, 2);
        assert.equal(
          (await api(admin, placePath, "PUT", { ...placeInput, version: 1 }))
            .status,
          409,
        );
        assert.equal(
          (await api(guest, "/api/v1/places")).data.find(
            (p: ManagedPlace) => p.id === createdPlace.data.id,
          ).article,
          "Nội dung đã biên tập.",
        );
        await db.place.create({
          data: {
            id: 1601,
            provinceId: 16,
            name: "Hồ Hoàn Kiếm",
            lat: 21.0307,
            lng: 105.8524,
          },
        });
        const legacyPlace: ManagedPlace = (
          await api(admin, "/api/admin/places")
        ).data.find((p: ManagedPlace) => p.id === 1601);
        assert.match(legacyPlace.article, /Hồ Hoàn Kiếm/);
        assert.ok(legacyPlace.description.length > 20);
        const { id: legacyId, ...legacyInput } = legacyPlace;
        assert.equal(
          (
            await api(admin, `/api/admin/places/${legacyId}`, "PUT", {
              ...legacyInput,
              article: "",
            })
          ).status,
          200,
        );
        assert.equal(
          (await api(guest, "/api/v1/places")).data.find(
            (p: ManagedPlace) => p.id === legacyId,
          ).article,
          "",
        );
        await db.user.update({
          where: { id: bob.user!.id },
          data: { role: "USER" },
        });
        assert.equal((await api(admin, "/api/admin/overview")).status, 403);
        assert.equal(
          (await api(admin, "/api/auth/signout", "POST", {})).status,
          204,
        );
        assert.equal((await api(admin, "/api/admin/users")).status, 401);
      },
    );
    await t.test(
      "CSRF, origin, author authorization, idempotent likes, comment ownership",
      async () => {
        const input = {
          content: "Một chuyến đi tuyệt vời ở Hà Nội.",
          province: "Hà Nội",
          imageUrl: "",
        };
        assert.equal(
          (await api(guest, "/api/v1/posts", "POST", input)).status,
          401,
        );
        assert.equal(
          (
            await api(alice, "/api/v1/posts", "POST", input, {
              "X-CSRF-Token": "",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await api(alice, "/api/v1/posts", "POST", input, {
              Origin: "https://evil.example",
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await api(alice, "/api/v1/posts", "POST", {
              ...input,
              authorId: bob.user!.id,
            })
          ).status,
          422,
        );
        const created = await api(alice, "/api/v1/posts", "POST", input);
        assert.equal(created.status, 201);
        postId = created.data.id;
        assert.equal(
          (await api(bob, `/api/v1/posts/${postId}`, "DELETE")).status,
          404,
        );
        for (let i = 0; i < 2; i++)
          assert.equal(
            (
              await api(bob, `/api/v1/posts/${postId}/like`, "PUT", {
                liked: true,
              })
            ).data.likeCount,
            1,
          );
        const feed = (await api(bob, "/api/v1/posts")).data.items[0];
        assert.equal(feed.liked, true);
        assert.equal(feed.author.email, undefined);
        const comment = await api(
          bob,
          `/api/v1/posts/${postId}/comments`,
          "POST",
          { content: "Rất hữu ích!" },
        );
        assert.equal(comment.status, 201);
        assert.equal(
          (await api(alice, `/api/v1/comments/${comment.data.id}`, "DELETE"))
            .status,
          404,
        );
        assert.equal(
          (
            await api(bob, `/api/v1/comments/${comment.data.id}`, "PATCH", {
              content: "Cảm ơn bạn đã chia sẻ!",
            })
          ).status,
          204,
        );
        assert.equal(
          (await api(bob, `/api/v1/comments/${comment.data.id}`, "DELETE"))
            .status,
          204,
        );
      },
    );
    const input = {
      title: "Hành trình Hà Nội",
      description: "Một ngày khám phá thủ đô",
      province: "Hà Nội",
      visibility: "PRIVATE",
      days: [
        {
          title: "Ngày đầu tiên",
          activities: [
            {
              time: "08:00",
              endTime: "09:00",
              title: "Thăm Văn Miếu",
              place: "Văn Miếu",
              notes: "",
              cost: 50000,
            },
          ],
        },
      ],
    };
    let plan: TravelPlan;
    await t.test(
      "private/public itinerary CRUD, idempotent creation, stale version conflicts",
      async () => {
        const id = randomUUID();
        const created = await api(alice, "/api/v1/itineraries", "POST", {
          id,
          ...input,
        });
        assert.equal(created.status, 201, JSON.stringify(created.data));
        plan = created.data;
        assert.equal(
          (await api(alice, "/api/v1/itineraries", "POST", { id, ...input }))
            .data.id,
          id,
        );
        assert.equal(
          await db.pointEntry.count({
            where: { userId: alice.user!.id, event: "ITINERARY" },
          }),
          1,
        );
        assert.equal(
          (await api(guest, `/api/v1/itineraries/${id}`)).status,
          404,
        );
        assert.equal(
          (
            await api(bob, `/api/v1/itineraries/${id}`, "PUT", {
              ...input,
              version: 1,
            })
          ).status,
          404,
        );
        const published = await api(alice, `/api/v1/itineraries/${id}`, "PUT", {
          ...input,
          visibility: "PUBLIC",
          version: 1,
        });
        assert.equal(published.status, 200);
        plan = published.data;
        assert.equal(plan.version, 2);
        assert.equal(
          (
            await api(alice, `/api/v1/itineraries/${id}`, "PUT", {
              ...input,
              version: 1,
            })
          ).status,
          409,
        );
        assert.equal(
          (await api(guest, `/api/v1/itineraries/${id}`)).status,
          200,
        );
        assert.equal(
          (await api(alice, `/api/v1/itineraries/${id}?version=1`, "DELETE"))
            .status,
          409,
        );
        assert.equal(
          (await api(alice, `/api/v1/itineraries/${id}?version=2`, "DELETE"))
            .status,
          204,
        );
        assert.equal(await db.activity.count(), 0);
        assert.equal(
          await db.pointEntry.count({
            where: { userId: alice.user!.id, event: "ITINERARY" },
          }),
          1,
        );
      },
    );
    await t.test(
      "reviews, verified distance, duplicate rewards, daily cap and atomic tiers",
      async () => {
        await db.place.create({
          data: {
            id: 101,
            provinceId: 1,
            name: "Lũng Cú",
            lat: 23.36,
            lng: 105.3197,
          },
        });
        const review = {
          rating: 5,
          content: "Một điểm đến rất đẹp và đáng trải nghiệm.",
        };
        assert.equal(
          (await api(alice, "/api/v1/places/101/review", "PUT", review)).data
            .awarded,
          20,
        );
        assert.equal(
          (
            await api(alice, "/api/v1/places/101/review", "PUT", {
              ...review,
              rating: 4,
            })
          ).data.awarded,
          0,
        );
        const position = {
          latitude: 23.36,
          longitude: 105.3197,
          accuracy: 10,
          timestamp: Date.now(),
        };
        assert.equal(
          (
            await api(alice, "/api/v1/places/101/checkin", "POST", {
              ...position,
              latitude: 10,
            })
          ).status,
          422,
        );
        assert.equal(
          (
            await api(alice, "/api/v1/places/101/checkin", "POST", {
              ...position,
              timestamp: 1,
            })
          ).status,
          422,
        );
        assert.equal(
          (await api(alice, "/api/v1/places/101/checkin", "POST", position))
            .data.awarded,
          10,
        );
        assert.equal(
          (await api(alice, "/api/v1/places/101/checkin", "POST", position))
            .data.awarded,
          0,
        );
        for (let i = 0; i < 4; i++)
          assert.equal(
            (
              await api(alice, "/api/v1/itineraries", "POST", {
                id: randomUUID(),
                ...input,
              })
            ).status,
            201,
          );
        const entries = await db.pointEntry.findMany({
          where: { userId: alice.user!.id, event: "ITINERARY" },
        });
        assert.equal(
          entries.reduce((sum, entry) => sum + entry.amount, 0),
          90,
        );
        await db.place.create({ data: {
          id: 103, provinceId: 1, name: "Điểm kiểm tra đồng thời", lat: 23.36, lng: 105.3197,
        } });
        const concurrent = await Promise.all(
          Array.from({ length: 4 }, () =>
            api(alice, "/api/v1/places/103/review", "PUT", review),
          ),
        );
        assert.ok(concurrent.every((result) => result.status === 200));
        assert.equal(concurrent.reduce((sum, result) => sum + result.data.awarded, 0), 20);
        assert.equal(
          await db.pointEntry.count({
            where: { userId: alice.user!.id, event: "REVIEW", source: "103" },
          }),
          1,
        );
        const member = await db.user.findUniqueOrThrow({
          where: { id: alice.user!.id },
        });
        const total = await db.pointEntry.aggregate({
          where: { userId: alice.user!.id },
          _sum: { amount: true },
        });
        assert.equal(member.points, total._sum.amount);
        await db.place.create({
          data: {
            id: 102,
            provinceId: 1,
            name: "Điểm đến thứ hai",
            lat: 23.36,
            lng: 105.3197,
          },
        });
        assert.equal(
          (await api(alice, "/api/v1/places/102/review", "PUT", review)).data
            .awarded,
          20,
        );
        assert.equal(
          (await api(alice, "/api/auth/session")).data.user.tier,
          "SILVER",
        );
        const before = (await api(alice, "/api/auth/session")).data.user.points;
        assert.equal(
          (await api(alice, "/api/v1/places/99999/review", "PUT", review))
            .status,
          404,
        );
        assert.equal(
          (await api(alice, "/api/auth/session")).data.user.points,
          before,
        );
        assert.equal(
          (await api(alice, "/api/v1/checkins")).data.provinces[0],
          4, // Former Hà Giang is now part of Tuyên Quang.
        );
      },
    );
    await t.test(
      "stable pagination and logout revoke the server session",
      async () => {
        await db.post.createMany({
          data: Array.from({ length: 25 }, (_, i) => ({
            authorId: alice.user!.id,
            content: `Bài viết ${i}`,
            province: "",
          })),
        });
        const first = (await api(guest, "/api/v1/posts")).data,
          second = (
            await api(guest, `/api/v1/posts?cursor=${first.nextCursor}`)
          ).data;
        assert.equal(first.items.length, 20);
        assert.ok(second.items.length > 0);
        assert.equal(
          new Set([...first.items, ...second.items].map((p) => p.id)).size,
          26,
        );
        assert.equal(
          (await api(guest, "/api/v1/posts?cursor=bad")).status,
          400,
        );
        const login = await api(guest, "/api/auth/signin", "POST", {
          email: "alice@example.com",
          password: "a secure password 2026",
        });
        assert.equal(login.status, 200);
        assert.equal(
          (await api(alice, "/api/auth/signout", "POST", {})).status,
          204,
        );
        assert.equal((await api(alice, "/api/auth/session")).data.user, null);
        await db.session.updateMany({
          where: { userId: bob.user!.id },
          data: { expiresAt: new Date(0) },
        });
        assert.equal((await api(bob, "/api/auth/session")).data.user, null);
      },
    );
  },
);
