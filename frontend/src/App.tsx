import { useEffect, useState } from "react";
import { ApiError } from "./api/client";
import { createTask, deleteTask, listTasks, updateTaskStatus } from "./api/tasks";
import { TaskForm } from "./components/TaskForm";
import { TaskList } from "./components/TaskList";
import type { Task, TaskCreateInput, TaskStatus } from "./types";

type ViewState =
  | { phase: "loading"; tasks: Task[] | null }
  | { phase: "error"; message: string; tasks: Task[] | null }
  | { phase: "ready"; tasks: Task[] };

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "请求失败";
}

export function App() {
  const [view, setView] = useState<ViewState>({ phase: "loading", tasks: null });

  useEffect(() => {
    let cancelled = false;
    listTasks().then(
      (tasks) => {
        if (!cancelled) {
          setView({ phase: "ready", tasks });
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setView({ phase: "error", message: errorMessage(error), tasks: null });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  async function reload() {
    try {
      const tasks = await listTasks();
      setView({ phase: "ready", tasks });
    } catch (error) {
      setView((current) => ({
        phase: "error",
        message: errorMessage(error),
        tasks: current.tasks,
      }));
    }
  }

  async function handleCreate(input: TaskCreateInput) {
    try {
      await createTask(input);
    } catch (error) {
      setView((current) => ({
        phase: "error",
        message: errorMessage(error),
        tasks: current.tasks,
      }));
      throw error;
    }

    try {
      const tasks = await listTasks();
      setView({ phase: "ready", tasks });
    } catch (error) {
      setView((current) => ({
        phase: "error",
        message: errorMessage(error),
        tasks: current.tasks,
      }));
    }
  }

  async function handleStatus(id: number, status: TaskStatus) {
    try {
      await updateTaskStatus(id, status);
      const tasks = await listTasks();
      setView({ phase: "ready", tasks });
    } catch (error) {
      setView((current) => ({
        phase: "error",
        message: errorMessage(error),
        tasks: current.tasks,
      }));
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteTask(id);
      const tasks = await listTasks();
      setView({ phase: "ready", tasks });
    } catch (error) {
      setView((current) => ({
        phase: "error",
        message: errorMessage(error),
        tasks: current.tasks,
      }));
    }
  }

  return (
    <main className="app">
      <h1>任务清单</h1>
      <TaskForm onCreate={handleCreate} />
      <TaskList
        phase={view.phase}
        tasks={view.tasks}
        message={view.phase === "error" ? view.message : null}
        onRetry={reload}
        onStatusChange={handleStatus}
        onDelete={handleDelete}
      />
    </main>
  );
}
