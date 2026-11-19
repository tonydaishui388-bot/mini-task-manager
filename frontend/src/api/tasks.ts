import { request } from "./client";
import type { Task, TaskCreateInput, TaskStatus } from "../types";

export function listTasks(): Promise<Task[]> {
  return request<Task[]>("/api/tasks", { method: "GET" });
}

export function createTask(input: TaskCreateInput): Promise<Task> {
  return request<Task>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateTaskStatus(id: number, status: TaskStatus): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteTask(id: number): Promise<void> {
  return request<void>(`/api/tasks/${id}`, { method: "DELETE" });
}
