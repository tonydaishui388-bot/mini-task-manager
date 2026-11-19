import { useEffect, useRef, useState } from "react";
import { logout, me } from "./api/auth";
import { ApiError } from "./api/client";
import { createTask, deleteTask, listTasks, updateTaskStatus } from "./api/tasks";
import { TaskForm } from "./components/TaskForm";
import { TaskList } from "./components/TaskList";
import { Login } from "./Login";
import type { Task, TaskCreateInput, TaskStatus } from "./types";

type ViewState =
  | { phase: "loading"; tasks: Task[] | null }
  | { phase: "error"; message: string; tasks: Task[] | null }
  | { phase: "ready"; tasks: Task[] };

type Gate = "checking" | "anonymous" | "in";

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "请求失败";
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

function readGate(gateRef: { readonly current: Gate }): Gate {
  return gateRef.current;
}

export function App() {
  const [view, setView] = useState<ViewState>({ phase: "loading", tasks: null });
  const [gate, setGate] = useState<Gate>("checking");
  const gateRef = useRef<Gate>("checking");
  const generation = useRef(0);

  function showLogin() {
    gateRef.current = "anonymous";
    setGate("anonymous");
  }

  function showApp() {
    if (gateRef.current === "anonymous") {
      return;
    }
    gateRef.current = "in";
    setGate("in");
  }

  useEffect(() => {
    if (gate === "anonymous" && window.location.pathname !== "/login") {
      window.history.replaceState(null, "", "/login");
    } else if (gate === "in" && window.location.pathname === "/login") {
      window.history.replaceState(null, "", "/");
    }
  }, [gate]);

  useEffect(() => {
    const gen = ++generation.current;
    let cancelled = false;

    me().then(
      () => {
        if (cancelled || generation.current !== gen) {
          return;
        }
        showApp();
      },
      (error: unknown) => {
        if (cancelled || generation.current !== gen) {
          return;
        }
        if (isUnauthorized(error)) {
          showLogin();
          return;
        }
        showApp();
      },
    );

    listTasks().then(
      (tasks) => {
        if (cancelled || generation.current !== gen || gateRef.current === "anonymous") {
          return;
        }
        setView({ phase: "ready", tasks });
      },
      (error: unknown) => {
        if (cancelled || generation.current !== gen || gateRef.current === "anonymous") {
          return;
        }
        if (isUnauthorized(error)) {
          showLogin();
          return;
        }
        setView({ phase: "error", message: errorMessage(error), tasks: null });
      },
    );

    return () => {
      cancelled = true;
    };
  }, []);

  async function enterApp() {
    const gen = ++generation.current;
    gateRef.current = "in";
    setGate("in");
    setView({ phase: "loading", tasks: null });
    try {
      const tasks = await listTasks();
      if (generation.current !== gen || readGate(gateRef) === "anonymous") {
        return;
      }
      setView({ phase: "ready", tasks });
    } catch (error) {
      if (generation.current !== gen) {
        return;
      }
      if (isUnauthorized(error)) {
        showLogin();
        return;
      }
      setView({ phase: "error", message: errorMessage(error), tasks: null });
    }
  }

  async function handleLogout() {
    const gen = ++generation.current;
    try {
      await logout();
    } catch (error) {
      if (generation.current !== gen) {
        return;
      }
      if (isUnauthorized(error)) {
        showLogin();
        return;
      }
      setView((current) => ({
        phase: "error",
        message: errorMessage(error),
        tasks: current.tasks,
      }));
      return;
    }
    if (generation.current !== gen) {
      return;
    }
    showLogin();
  }

  async function reload() {
    try {
      const tasks = await listTasks();
      if (gateRef.current === "anonymous") {
        return;
      }
      setView({ phase: "ready", tasks });
    } catch (error) {
      if (isUnauthorized(error)) {
        showLogin();
        return;
      }
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
      if (isUnauthorized(error)) {
        showLogin();
        throw error;
      }
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
      if (gateRef.current === "anonymous") {
        return;
      }
      setView({ phase: "ready", tasks });
    } catch (error) {
      if (isUnauthorized(error)) {
        showLogin();
        return;
      }
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
      if (gateRef.current === "anonymous") {
        return;
      }
      setView({ phase: "ready", tasks });
    } catch (error) {
      if (isUnauthorized(error)) {
        showLogin();
        return;
      }
      setView((current) => ({
        phase: "error",
        message: errorMessage(error),
        tasks: current.tasks,
      }));
    }
  }

  if (gate === "anonymous") {
    return (
      <main className="app">
        <Login
          onSuccess={() => {
            void enterApp();
          }}
        />
      </main>
    );
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>任务清单</h1>
        {gate === "in" ? (
          <button type="button" className="logout-button" onClick={() => void handleLogout()}>
            退出
          </button>
        ) : null}
      </header>
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
