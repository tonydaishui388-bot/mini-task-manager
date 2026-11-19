import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { App } from "./App";
import { ApiError } from "./api/client";
import { createTask, deleteTask, listTasks, updateTaskStatus } from "./api/tasks";
import type { Task } from "./types";

vi.mock("./api/tasks", () => ({
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTaskStatus: vi.fn(),
  deleteTask: vi.fn(),
}));

const listTasksMock = vi.mocked(listTasks);
const createTaskMock = vi.mocked(createTask);
const updateTaskStatusMock = vi.mocked(updateTaskStatus);
const deleteTaskMock = vi.mocked(deleteTask);

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: "买牛奶",
    description: "",
    status: "todo",
    created_at: "2026-11-19T04:08:00Z",
    updated_at: "2026-11-19T04:08:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
});

it("shows the empty state", async () => {
  listTasksMock.mockResolvedValue([]);
  render(<App />);
  expect(await screen.findByTestId("task-empty")).toHaveTextContent("还没有任务");
  expect(screen.queryByTestId("task-loading")).not.toBeInTheDocument();
});

it("shows loading before the first response", () => {
  listTasksMock.mockReturnValue(new Promise(() => {}));
  render(<App />);
  expect(screen.getByTestId("task-loading")).toHaveTextContent("正在加载任务…");
});

it("shows a connection error and retries", async () => {
  listTasksMock
    .mockRejectedValueOnce(new ApiError(0, "无法连接后端"))
    .mockResolvedValueOnce([]);
  const user = userEvent.setup();
  render(<App />);
  expect(await screen.findByTestId("task-error")).toHaveTextContent("无法连接后端");
  expect(screen.queryByTestId("task-empty")).not.toBeInTheDocument();
  await user.click(screen.getByTestId("task-retry"));
  expect(await screen.findByTestId("task-empty")).toBeInTheDocument();
  expect(listTasksMock).toHaveBeenCalledTimes(2);
});

it("hides an empty description and shows a filled one", async () => {
  listTasksMock.mockResolvedValueOnce([task()]);
  const first = render(<App />);
  expect(await screen.findByText("买牛奶")).toBeInTheDocument();
  expect(screen.queryByText("一瓶")).not.toBeInTheDocument();
  first.unmount();

  listTasksMock.mockResolvedValueOnce([task({ description: "一瓶" })]);
  render(<App />);
  expect(await screen.findByText("一瓶")).toBeInTheDocument();
});

it("does not submit a blank title", async () => {
  listTasksMock.mockResolvedValue([]);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByTestId("task-empty");
  await user.click(screen.getByTestId("task-submit"));
  expect(await screen.findByText("请输入标题")).toBeInTheDocument();
  expect(createTaskMock).not.toHaveBeenCalled();
});

it("creates a task and clears the form", async () => {
  const created = task({ description: "一瓶" });
  listTasksMock.mockResolvedValueOnce([]).mockResolvedValueOnce([created]);
  createTaskMock.mockResolvedValue(created);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByTestId("task-empty");
  await user.type(screen.getByLabelText("标题"), "买牛奶");
  await user.type(screen.getByLabelText("描述"), "一瓶");
  await user.click(screen.getByTestId("task-submit"));
  expect(createTaskMock).toHaveBeenCalledWith({ title: "买牛奶", description: "一瓶" });
  expect(await screen.findByTestId("task-item-1")).toHaveTextContent("买牛奶");
  expect(screen.getByLabelText("标题")).toHaveValue("");
  expect(screen.getByLabelText("描述")).toHaveValue("");
});

it("updates status through the select", async () => {
  listTasksMock.mockResolvedValue([task()]);
  updateTaskStatusMock.mockResolvedValue(task({ status: "done" }));
  const user = userEvent.setup();
  render(<App />);
  await screen.findByTestId("task-item-1");
  await user.selectOptions(screen.getByTestId("task-status-1"), "done");
  expect(updateTaskStatusMock).toHaveBeenCalledWith(1, "done");
});

it("deletes only after confirm", async () => {
  listTasksMock.mockResolvedValueOnce([task()]).mockResolvedValueOnce([]);
  deleteTaskMock.mockResolvedValue(undefined);
  const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
  const user = userEvent.setup();
  render(<App />);
  await screen.findByTestId("task-item-1");
  await user.click(screen.getByTestId("task-delete-1"));
  expect(confirmSpy).toHaveBeenCalledWith("确定删除这个任务？");
  expect(deleteTaskMock).not.toHaveBeenCalled();

  confirmSpy.mockReturnValue(true);
  await user.click(screen.getByTestId("task-delete-1"));
  expect(deleteTaskMock).toHaveBeenCalledWith(1);
  expect(await screen.findByTestId("task-empty")).toBeInTheDocument();
});
