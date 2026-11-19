import { afterEach, expect, it, vi } from "vitest";
import { createTask, deleteTask, listTasks, updateTaskStatus } from "./tasks";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

it("lists tasks with GET", async () => {
  const fetchMock = vi.fn(async () => jsonResponse(200, []));
  vi.stubGlobal("fetch", fetchMock);
  await expect(listTasks()).resolves.toEqual([]);
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/tasks");
  expect(init.method).toBe("GET");
});

it("creates a task without status", async () => {
  const created = {
    id: 1,
    title: "买牛奶",
    description: "一瓶",
    status: "todo",
    created_at: "2026-11-19T04:08:00Z",
    updated_at: "2026-11-19T04:08:00Z",
  };
  const fetchMock = vi.fn(async () => jsonResponse(201, created));
  vi.stubGlobal("fetch", fetchMock);
  await createTask({ title: "买牛奶", description: "一瓶" });
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/tasks");
  expect(init.method).toBe("POST");
  expect(JSON.parse(init.body)).toEqual({ title: "买牛奶", description: "一瓶" });
});

it("patches status", async () => {
  const fetchMock = vi.fn(async () =>
    jsonResponse(200, {
      id: 3,
      title: "买牛奶",
      description: "",
      status: "done",
      created_at: "2026-11-19T04:08:00Z",
      updated_at: "2026-11-19T04:08:01Z",
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await updateTaskStatus(3, "done");
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/tasks/3");
  expect(init.method).toBe("PATCH");
  expect(JSON.parse(init.body)).toEqual({ status: "done" });
});

it("deletes a task", async () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(deleteTask(3)).resolves.toBeUndefined();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe("/api/tasks/3");
  expect(init.method).toBe("DELETE");
});
