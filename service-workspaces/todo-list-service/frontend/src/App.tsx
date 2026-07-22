import {
  PLATFORM_BRIDGE_VERSION,
  type PlatformAppProps,
} from '@platform/microfrontend-bridge';
import { Button, Card, EmptyState } from '@platform/ui';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Todo, TodoList } from './types.js';
import './styles.css';

export const bridgeVersion = PLATFORM_BRIDGE_VERSION;

export default function TodoApp({ client, principal }: PlatformAppProps) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const canWrite = principal.permissions.includes('todos:write');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setTodos((await client.request<TodoList>({ path: '/todos' })).items);
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Todo 加载失败');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => void refresh(), [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const title = String(new FormData(form).get('title') ?? '').trim();
    if (!title) return;
    setSaving(true);
    try {
      await client.request<Todo>({
        path: '/todos',
        method: 'POST',
        body: { title },
        idempotencyKey: crypto.randomUUID(),
      });
      form.reset();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Todo 创建失败');
    } finally {
      setSaving(false);
    }
  }

  async function update(todo: Todo, input: { completed: boolean }) {
    setSaving(true);
    try {
      await client.request<Todo>({ path: `/todos/${todo.id}`, method: 'PATCH', body: input });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Todo 更新失败');
    } finally {
      setSaving(false);
    }
  }

  async function remove(todo: Todo) {
    setSaving(true);
    try {
      await client.request({ path: `/todos/${todo.id}`, method: 'DELETE' });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Todo 删除失败');
    } finally {
      setSaving(false);
    }
  }

  const completed = todos.filter((todo) => todo.completed).length;
  return (
    <div className="todo-app page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">独立业务前端</span>
          <h1>Todo 清单</h1>
          <p>Remote React → Gateway → FastAPI → SQLite</p>
        </div>
        <Button tone="secondary" disabled={loading || saving} onClick={() => void refresh()}>
          刷新
        </Button>
      </header>
      {canWrite && (
        <Card title="新建 Todo">
          <form className="todo-create-form" onSubmit={(event) => void submit(event)}>
            <label>
              <span>待办内容</span>
              <input name="title" maxLength={120} placeholder="例如：验证业务应用脚手架" required />
            </label>
            <Button disabled={saving}>{saving ? '正在保存…' : '添加 Todo'}</Button>
          </form>
        </Card>
      )}
      <Card title={`全部 Todo · ${todos.length}`} action={<span>已完成 {completed}</span>}>
        {error && <div className="todo-error" role="alert">{error}</div>}
        {loading ? (
          <div className="todo-loading">正在读取 Todo 服务…</div>
        ) : todos.length === 0 ? (
          <EmptyState title="暂无 Todo" description="添加第一条记录，验证独立前后端调用链。" />
        ) : (
          <div className="todo-list">
            {todos.map((todo) => (
              <article className={`todo-item ${todo.completed ? 'completed' : ''}`} key={todo.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    disabled={!canWrite || saving}
                    onChange={() => void update(todo, { completed: !todo.completed })}
                  />
                  <span>
                    <strong>{todo.title}</strong>
                    <small>更新于 {new Date(todo.updatedAt).toLocaleString('zh-CN')}</small>
                  </span>
                </label>
                {canWrite && <Button tone="ghost" disabled={saving} onClick={() => void remove(todo)}>删除</Button>}
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
