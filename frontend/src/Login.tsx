import { useState } from "react";
import type { FormEvent } from "react";
import { ApiError } from "./api/client";
import { login } from "./api/auth";

interface LoginProps {
  onSuccess: () => void;
}

export function Login({ onSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (username.trim() === "" || password === "") {
      setError("请输入用户名和密码");
      return;
    }

    setError(null);
    setPending(true);
    try {
      await login(username.trim(), password);
      onSuccess();
    } catch (caught) {
      if (caught instanceof ApiError) {
        setError(caught.message);
      } else if (caught instanceof Error && caught.message) {
        setError(caught.message);
      } else {
        setError("请求失败");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form data-testid="login-form" onSubmit={handleSubmit} noValidate>
      <h1>登录</h1>
      <label htmlFor="login-username">用户名</label>
      <input
        id="login-username"
        name="username"
        autoComplete="username"
        data-testid="login-username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <label htmlFor="login-password">密码</label>
      <input
        id="login-password"
        name="password"
        type="password"
        autoComplete="current-password"
        data-testid="login-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" data-testid="login-submit" disabled={pending}>
        登录
      </button>
    </form>
  );
}
