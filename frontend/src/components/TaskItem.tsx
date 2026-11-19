import type { Task, TaskStatus } from "../types";

interface TaskItemProps {
  task: Task;
  onStatusChange: (id: number, status: TaskStatus) => void | Promise<void>;
  onDelete: (id: number) => void | Promise<void>;
}

function asStatus(value: string): TaskStatus | null {
  if (value === "todo" || value === "in_progress" || value === "done") {
    return value;
  }
  return null;
}

export function TaskItem({ task, onStatusChange, onDelete }: TaskItemProps) {
  return (
    <article data-testid={`task-item-${task.id}`} className="task-item">
      <h3 className={task.status === "done" ? "task-title is-done" : "task-title"}>
        {task.title}
      </h3>
      {task.description ? <p>{task.description}</p> : null}
      <p className="task-meta">{new Date(task.created_at).toLocaleString()}</p>
      <div className="task-actions">
        <select
          data-testid={`task-status-${task.id}`}
          value={task.status}
          onChange={(event) => {
            const status = asStatus(event.target.value);
            if (status) {
              return onStatusChange(task.id, status);
            }
            return undefined;
          }}
        >
          <option value="todo">待办</option>
          <option value="in_progress">进行中</option>
          <option value="done">已完成</option>
        </select>
        <button
          type="button"
          data-testid={`task-delete-${task.id}`}
          onClick={() => {
            if (window.confirm("确定删除这个任务？")) {
              return onDelete(task.id);
            }
            return undefined;
          }}
        >
          删除
        </button>
      </div>
    </article>
  );
}
