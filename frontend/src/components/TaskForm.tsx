import { useState } from "react";
import type { FormEvent } from "react";
import type { TaskCreateInput } from "../types";

interface TaskFormProps {
  onCreate: (input: TaskCreateInput) => Promise<void>;
}

export function TaskForm({ onCreate }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (trimmedTitle.length === 0) {
      setFormError("请输入标题");
      return;
    }
    if (trimmedTitle.length > 200) {
      setFormError("标题最多 200 字");
      return;
    }
    if (trimmedDescription.length > 2000) {
      setFormError("描述最多 2000 字");
      return;
    }

    setFormError(null);
    try {
      await onCreate({
        title: trimmedTitle,
        description: trimmedDescription,
      });
    } catch {
      return;
    }
    setTitle("");
    setDescription("");
  }

  return (
    <form data-testid="task-form" onSubmit={handleSubmit} noValidate>
      <h2>新建任务</h2>
      <label htmlFor="task-title">标题</label>
      <input
        id="task-title"
        data-testid="task-title-input"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <label htmlFor="task-description">描述</label>
      <textarea
        id="task-description"
        data-testid="task-description-input"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />
      {formError ? <p className="form-error">{formError}</p> : null}
      <button type="submit" data-testid="task-submit">
        添加任务
      </button>
    </form>
  );
}
