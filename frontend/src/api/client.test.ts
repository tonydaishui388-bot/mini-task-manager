import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("request", () => {
  it("parses 200 json", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, { status: "ok" })));
    await expect(request("/api/health")).resolves.toEqual({ status: "ok" });
  });

  it("returns undefined on 204", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(request("/api/tasks/1", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("maps task not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(404, { detail: "Task not found" })),
    );
    const error = await request("/api/tasks/1").then(
      () => null,
      (caught: unknown) => caught,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: "任务不存在" });
  });

  it("joins validation messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(422, { detail: [{ msg: "标题无效" }] })),
    );
    await expect(request("/api/tasks", { method: "POST" })).rejects.toMatchObject({
      status: 422,
      message: "标题无效",
    });
  });

  it("sends cookies and surfaces invalid credentials", async () => {
    const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
      async () => jsonResponse(401, { detail: "Invalid credentials" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(request("/api/login", { method: "POST", body: "{}" })).rejects.toMatchObject({
      status: 401,
      message: "Invalid credentials",
    });
    expect(fetchMock.mock.calls[0][1]?.credentials).toBe("include");
  });

  it("maps network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network");
      }),
    );
    await expect(request("/api/health")).rejects.toMatchObject({
      status: 0,
      message: "无法连接后端",
    });
  });
});
