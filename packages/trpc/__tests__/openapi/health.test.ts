// @vitest-environment node

import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getOpenApiDocument, handleOpenApiRequest } from "../../src/openapi";

process.env.NODE_ENV = "development";

const dbExecuteMock = vi.hoisted(() => vi.fn());
const dbInsertValuesMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const dbInsertMock = vi.hoisted(() => vi.fn().mockReturnValue({ values: dbInsertValuesMock }));
const getDatabaseHealthMock = vi.hoisted(() => vi.fn());
const getRedisHealthMock = vi.hoisted(() => vi.fn());

vi.mock("@norish/auth/providers", () => ({
  getAvailableProviders: vi.fn().mockResolvedValue([]),
  isPasswordAuthEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getLocaleConfig: vi.fn().mockResolvedValue({
    defaultLocale: "en",
    locales: { en: { enabled: true, name: "English" } },
  }),
  getRecurrenceConfig: vi.fn().mockResolvedValue({}),
  getTimerKeywords: vi.fn().mockResolvedValue([]),
  getUnits: vi.fn().mockResolvedValue({}),
  isRegistrationEnabled: vi.fn().mockResolvedValue(false),
  isTimersEnabled: vi.fn().mockResolvedValue(false),
}));

vi.mock("@norish/db/repositories/tags", () => ({
  listAllTagNames: vi.fn().mockResolvedValue([]),
}));

vi.mock("@norish/db/drizzle", () => ({
  db: {
    execute: dbExecuteMock,
    insert: dbInsertMock,
  },
  getDatabaseHealth: getDatabaseHealthMock,
}));

vi.mock("@norish/config/env-config-server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/config/env-config-server")>();

  return {
    ...actual,
    SERVER_CONFIG: {
      ...actual.SERVER_CONFIG,
      PARSER_API_TIMEOUT_MS: 15000,
    },
    buildInternalParserApiUrl: (pathname: string) =>
      new URL(pathname, "http://127.0.0.1:8001").toString(),
  };
});

vi.mock("@norish/shared-server/redis/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/redis/client")>()),
  getRedisHealth: getRedisHealthMock,
}));

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock("@norish/auth/auth", () => ({
  auth: {
    api: {
      getSession: getSessionMock,
    },
  },
}));

describe("openapi health endpoint", () => {
  beforeEach(() => {
    process.env.NORISH_VERSION_REPORT_JSON = JSON.stringify({
      root: "1.2.3",
      apps: {
        mobile: "7.8.9",
        "parser-api": "8.9.10",
        web: "4.5.6",
      },
      packages: {
        api: "1.0.0",
        auth: "1.0.0",
        config: "1.0.0",
        db: "1.0.0",
        i18n: "1.0.0",
        queue: "1.0.0",
        shared: "1.0.0",
        "shared-react": "1.0.0",
        "shared-server": "1.0.0",
        trpc: "1.0.0",
        ui: "1.0.0",
      },
    });
    getSessionMock.mockReset();
    dbExecuteMock.mockReset();
    dbExecuteMock.mockResolvedValue([]);
    getDatabaseHealthMock.mockReset();
    getDatabaseHealthMock.mockImplementation(async () => {
      try {
        await dbExecuteMock();

        return {
          status: "ok",
        } as const;
      } catch {
        return {
          status: "error",
        } as const;
      }
    });
    dbInsertMock.mockClear();
    dbInsertValuesMock.mockClear();
    getRedisHealthMock.mockReset();
    getRedisHealthMock.mockResolvedValue({ status: "ok" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.NORISH_VERSION_REPORT_JSON;
    vi.restoreAllMocks();
  });

  it("returns ok for anonymous callers when the parser is healthy", async () => {
    getSessionMock.mockResolvedValue(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", recipeScrapersVersion: "15.10.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const response = await handleOpenApiRequest(new Request("http://localhost/api/v1/health"));
    const responseJson = await response.json();

    expect(response.status).toBe(200);
    expect(responseJson).toEqual({
      status: "ok",
      db: {
        status: "ok",
      },
      redis: {
        status: "ok",
      },
      versions: {
        root: "1.2.3",
        apps: {
          mobile: "7.8.9",
          "parser-api": "8.9.10",
          web: "4.5.6",
        },
        packages: {
          api: "1.0.0",
          auth: "1.0.0",
          config: "1.0.0",
          db: "1.0.0",
          i18n: "1.0.0",
          queue: "1.0.0",
          shared: "1.0.0",
          "shared-react": "1.0.0",
          "shared-server": "1.0.0",
          trpc: "1.0.0",
          ui: "1.0.0",
        },
        scraper: "15.10.0",
      },
      parser: {
        status: "ok",
        recipeScrapersVersion: "15.10.0",
      },
    });
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8001/health",
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("returns 503 for anonymous callers when the parser is unhealthy", async () => {
    getSessionMock.mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    const response = await handleOpenApiRequest(new Request("http://localhost/api/v1/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: "SERVICE_UNAVAILABLE",
        message: "Parser service is error",
      })
    );
  });

  it("returns 503 for anonymous callers when the database is unhealthy", async () => {
    getSessionMock.mockResolvedValue(null);
    dbExecuteMock.mockRejectedValueOnce(new Error("db down"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", recipeScrapersVersion: "15.10.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const response = await handleOpenApiRequest(new Request("http://localhost/api/v1/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: "SERVICE_UNAVAILABLE",
        message: "Database is error",
      })
    );
  });

  it("returns 503 for anonymous callers when Redis does not answer its ping", async () => {
    getSessionMock.mockResolvedValue(null);
    getRedisHealthMock.mockResolvedValueOnce({ status: "error" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: "ok", recipeScrapersVersion: "15.10.0" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const response = await handleOpenApiRequest(new Request("http://localhost/api/v1/health"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        code: "SERVICE_UNAVAILABLE",
        message: "Redis is error",
      })
    );
  });

  it("rejects anonymous requests to protected openapi endpoints", async () => {
    getSessionMock.mockResolvedValue(null);

    const response = await handleOpenApiRequest(
      new Request("http://localhost/api/v1/recipes/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        message: "You must be logged in to access this resource",
        code: "UNAUTHORIZED",
      })
    );
  });

  it("documents health as public while protected endpoints require security", async () => {
    const document = getOpenApiDocument();

    expect(document.paths["/health"]?.get).toEqual(
      expect.objectContaining({
        tags: ["Health"],
      })
    );
    expect(document.paths["/health"]?.get?.security).toBeUndefined();
    expect(document.paths["/health"]?.get?.description).toContain("Redis");
    expect(document.paths["/health"]?.get?.responses["503"]?.description).toContain("Redis");
    expect(document.paths["/recipes/search"]?.post?.security).toEqual([
      { ApiKeyAuth: [] },
      { BearerAuth: [] },
    ]);
    expect(document.paths["/recipes"]?.post?.security).toEqual([
      { ApiKeyAuth: [] },
      { BearerAuth: [] },
    ]);
  });

  it("marks /health deprecated and names the two endpoints that replace it", () => {
    const operation = getOpenApiDocument().paths["/health"]?.get;

    expect(operation?.deprecated).toBe(true);
    expect(operation?.description).toContain("/health/live");
    expect(operation?.description).toContain("/health/ready");
  });
});

function parserAnswers(status: number) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      status === 200
        ? new Response(JSON.stringify({ status: "ok", recipeScrapersVersion: "15.10.0" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        : new Response(null, { status })
    )
  );
}

describe("openapi liveness and readiness endpoints", () => {
  beforeEach(() => {
    getSessionMock.mockResolvedValue(null);
    getDatabaseHealthMock.mockReset();
    getDatabaseHealthMock.mockResolvedValue({ status: "ok" });
    getRedisHealthMock.mockReset();
    getRedisHealthMock.mockResolvedValue({ status: "ok" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const get = (path: string) => handleOpenApiRequest(new Request(`http://localhost/api/v1${path}`));

  describe("/health/live", () => {
    it("answers 200 while the parser answers, Postgres and Redis down or not", async () => {
      parserAnswers(200);
      getDatabaseHealthMock.mockResolvedValue({ status: "error" });
      getRedisHealthMock.mockResolvedValue({ status: "error" });

      const response = await get("/health/live");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "ok",
        parser: { status: "ok", recipeScrapersVersion: "15.10.0" },
      });
      expect(getDatabaseHealthMock).not.toHaveBeenCalled();
      expect(getRedisHealthMock).not.toHaveBeenCalled();
    });

    it("answers 503 when the parser does not answer", async () => {
      vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));

      const response = await get("/health/live");

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ message: "Parser service is unreachable" })
      );
    });
  });

  describe("/health/ready", () => {
    it("answers 200 with the parser down, reporting it", async () => {
      parserAnswers(503);

      const response = await get("/health/ready");

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        status: "ok",
        db: { status: "ok" },
        redis: { status: "ok" },
        parser: { status: "error", statusCode: 503 },
      });
    });

    it("answers 503 when Postgres is down", async () => {
      parserAnswers(200);
      getDatabaseHealthMock.mockResolvedValue({ status: "error" });

      const response = await get("/health/ready");

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ message: "Database is error" })
      );
    });

    it("answers 503 when Redis does not answer its ping", async () => {
      parserAnswers(200);
      getRedisHealthMock.mockResolvedValue({ status: "error" });

      const response = await get("/health/ready");

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({ message: "Redis is error" })
      );
    });
  });

  it("are both documented as public", () => {
    const { paths } = getOpenApiDocument();

    for (const path of ["/health/live", "/health/ready"]) {
      expect(paths[path]?.get?.tags, path).toEqual(["Health"]);
      expect(paths[path]?.get?.security, path).toBeUndefined();
    }
  });
});
