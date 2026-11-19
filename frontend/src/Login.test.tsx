import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "./App";

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function installFetch(
  handler: (input: string, init?: RequestInit) => Promise<Response> | Response,
) {
  const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>(
    async (input, init) => handler(input, init),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

it("shows login when the session is missing", async () => {
  const fetchMock = installFetch(async (input) => {
    if (input === "/api/me" || input === "/api/tasks") {
      return jsonResponse(401, { detail: "Invalid credentials" });
    }
    throw new Error(`unexpected ${input}`);
  });

  render(<App />);

  expect(await screen.findByRole("heading", { name: "登录" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "任务清单" })).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/me",
    expect.objectContaining({ method: "GET", credentials: "include" }),
  );
  expect(window.location.pathname).toBe("/login");
});

it("does not call fetch when login fields are empty", async () => {
  const fetchMock = installFetch(async (input) => {
    if (input === "/api/me" || input === "/api/tasks") {
      return jsonResponse(401, { detail: "Invalid credentials" });
    }
    throw new Error(`unexpected ${input}`);
  });
  const user = userEvent.setup();
  render(<App />);
  await screen.findByLabelText("用户名");
  const callsBeforeSubmit = fetchMock.mock.calls.length;

  await user.click(screen.getByRole("button", { name: "登录" }));

  expect(await screen.findByText("请输入用户名和密码")).toBeInTheDocument();
  expect(fetchMock.mock.calls.length).toBe(callsBeforeSubmit);
});

it("shows the error when login fails", async () => {
  const fetchMock = installFetch(async (input, init) => {
    if (input === "/api/me" || input === "/api/tasks") {
      return jsonResponse(401, { detail: "Invalid credentials" });
    }
    if (input === "/api/login") {
      expect(init?.credentials).toBe("include");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        username: "test-user",
        password: "test-password",
      });
      return jsonResponse(401, { detail: "Invalid credentials" });
    }
    throw new Error(`unexpected ${input}`);
  });
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByLabelText("用户名"), "test-user");
  await user.type(screen.getByLabelText("密码"), "test-password");
  await user.click(screen.getByRole("button", { name: "登录" }));

  expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "登录" })).toBeInTheDocument();
  expect(fetchMock.mock.calls.some(([url]) => url === "/api/login")).toBe(true);
});

it("disables submit while login is pending", async () => {
  let finishLogin: ((response: Response) => void) | undefined;
  installFetch(async (input) => {
    if (input === "/api/me") {
      return jsonResponse(401, { detail: "Invalid credentials" });
    }
    if (input === "/api/tasks") {
      return jsonResponse(200, []);
    }
    if (input === "/api/login") {
      return new Promise<Response>((resolve) => {
        finishLogin = resolve;
      });
    }
    throw new Error(`unexpected ${input}`);
  });
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByLabelText("用户名"), "test-user");
  await user.type(screen.getByLabelText("密码"), "test-password");
  await user.click(screen.getByRole("button", { name: "登录" }));

  expect(screen.getByRole("button", { name: "登录" })).toBeDisabled();
  finishLogin?.(new Response(null, { status: 204 }));
  expect(await screen.findByRole("heading", { name: "任务清单" })).toBeInTheDocument();
});

it("moves to the task view after login", async () => {
  installFetch(async (input) => {
    if (input === "/api/me") {
      return jsonResponse(401, { detail: "Invalid credentials" });
    }
    if (input === "/api/tasks") {
      return jsonResponse(200, []);
    }
    if (input === "/api/login") {
      return new Response(null, { status: 204 });
    }
    throw new Error(`unexpected ${input}`);
  });
  const user = userEvent.setup();
  render(<App />);
  await user.type(await screen.findByLabelText("用户名"), "test-user");
  await user.type(screen.getByLabelText("密码"), "test-password");
  await user.click(screen.getByRole("button", { name: "登录" }));

  expect(await screen.findByRole("heading", { name: "任务清单" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "退出" })).toBeInTheDocument();
  expect(await screen.findByTestId("task-empty")).toBeInTheDocument();
  expect(window.location.pathname).toBe("/");
});

it("returns to login after logout", async () => {
  const fetchMock = installFetch(async (input) => {
    if (input === "/api/me") {
      return jsonResponse(200, { username: "test-user" });
    }
    if (input === "/api/tasks") {
      return jsonResponse(200, []);
    }
    if (input === "/api/logout") {
      return new Response(null, { status: 204 });
    }
    throw new Error(`unexpected ${input}`);
  });
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole("button", { name: "退出" }));

  expect(await screen.findByRole("heading", { name: "登录" })).toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledWith(
    "/api/logout",
    expect.objectContaining({ method: "POST", credentials: "include" }),
  );
});
