export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function messageFromPayload(status: number, payload: unknown): string {
  const fallback = `请求失败（${status}）`;
  if (typeof payload !== "object" || payload === null || !("detail" in payload)) {
    return fallback;
  }

  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") {
    return detail === "Task not found" ? "任务不存在" : detail;
  }

  if (Array.isArray(detail)) {
    const parts: string[] = [];
    for (const item of detail) {
      if (typeof item === "object" && item !== null && "msg" in item) {
        const msg = (item as { msg?: unknown }).msg;
        if (typeof msg === "string") {
          parts.push(msg);
        }
      }
    }
    if (parts.length > 0) {
      return parts.join("；");
    }
  }

  return fallback;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    const headers = new Headers(init?.headers);
    if (init?.body != null && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(path, {
      ...init,
      headers,
      credentials: "include",
    });

    if (response.status === 204) {
      return undefined as T;
    }

    if (response.ok) {
      return (await response.json()) as T;
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = undefined;
    }
    throw new ApiError(response.status, messageFromPayload(response.status, payload));
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, "无法连接后端");
  }
}
