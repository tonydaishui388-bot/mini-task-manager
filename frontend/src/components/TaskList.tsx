import { TaskItem } from "./TaskItem";
import type { Task, TaskStatus } from "../types";

interface TaskListProps {
  phase: "loading" | "error" | "ready";
  tasks: Task[] | null;
  message: string | null;
  onRetry: () => void | Promise<void>;
  onStatusChange: (id: number, status: TaskStatus) => void | Promise<void>;
  onDelete: (id: number) => void | Promise<void>;
}

export function TaskList({
  phase,
  tasks,
  message,
  onRetry,
  onStatusChange,
  onDelete,
}: TaskListProps) {
  return (
    <section>
      {message ? (
        <div data-testid="task-error" className="task-error">
          <p>{message}</p>
          <button type="button" data-testid="task-retry" onClick={() => onRetry()}>
            重试
          </button>
        </div>
      ) : null}
      {phase === "loading" && tasks === null ? (
        <p data-testid="task-loading">正在加载任务…</p>
      ) : null}
      {phase === "ready" && tasks !== null && tasks.length === 0 ? (
        <p data-testid="task-empty">还没有任务</p>
      ) : null}
      {tasks?.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onStatusChange={onStatusChange}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
}
