import { request } from "./client";

export interface CurrentUser {
  username: string;
}

export function login(username: string, password: string): Promise<void> {
  return request<void>("/api/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout(): Promise<void> {
  return request<void>("/api/logout", {
    method: "POST",
  });
}

export function me(): Promise<CurrentUser> {
  return request<CurrentUser>("/api/me", {
    method: "GET",
  });
}
