import { PLATFORM_BRIDGE_VERSION, type PlatformAppProps } from '@platform/microfrontend-bridge';
import { Button, Card, EmptyState } from '@platform/ui';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { BusinessRecord, BusinessRecordList } from './types.js';
import './styles.css';

export const bridgeVersion = PLATFORM_BRIDGE_VERSION;

export default function BusinessApp({ client, principal }: PlatformAppProps) {
  const [records, setRecords] = useState<BusinessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const canWrite = principal.permissions.includes('__APP_ID__:write');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setRecords((await client.request<BusinessRecordList>({ path: '/records' })).items);
      setError(undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '记录加载失败');
    } finally {
      setLoading(false);
    }
  }, [client]);
  useEffect(() => void refresh(), [refresh]);

  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get('name') ?? '').trim();
    if (!name) return;
    setSaving(true);
    try {
      await client.request({
        path: '/records',
        method: 'POST',
        body: { name },
        idempotencyKey: crypto.randomUUID(),
      });
      form.reset();
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '创建失败');
    } finally {
      setSaving(false);
    }
  }

  async function updateRecord(record: BusinessRecord) {
    setSaving(true);
    try {
      await client.request({
        path: `/records/${record.id}`,
        method: 'PATCH',
        body: { completed: !record.completed },
      });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '更新失败');
    } finally {
      setSaving(false);
    }
  }

  async function removeRecord(record: BusinessRecord) {
    setSaving(true);
    try {
      await client.request({ path: `/records/${record.id}`, method: 'DELETE' });
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '删除失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="business-app page-stack">
      <header className="page-heading">
        <div>
          <span className="eyebrow">独立远程业务应用</span>
          <h1>__APP_TITLE__</h1>
          <p>当前用户：{principal.name} · 主题由门户 CSS 令牌注入</p>
        </div>
        <Button tone="secondary" disabled={loading || saving} onClick={() => void refresh()}>
          刷新
        </Button>
      </header>
      {canWrite && (
        <Card title="新建记录">
          <form className="record-form" onSubmit={(event) => void createRecord(event)}>
            <label>
              <span>名称</span>
              <input name="name" maxLength={120} required />
            </label>
            <Button disabled={saving}>{saving ? '保存中…' : '添加'}</Button>
          </form>
        </Card>
      )}
      <Card title={`全部记录 · ${records.length}`}>
        {error && (
          <div className="record-error" role="alert">
            {error}
          </div>
        )}
        {loading ? (
          <div className="record-loading">正在读取服务…</div>
        ) : records.length === 0 ? (
          <EmptyState title="暂无记录" description="添加第一条记录以验证完整调用链。" />
        ) : (
          <div className="record-list">
            {records.map((record) => (
              <article key={record.id} className={record.completed ? 'completed' : ''}>
                <button disabled={!canWrite || saving} onClick={() => void updateRecord(record)}>
                  {record.completed ? '✓' : '○'}
                </button>
                <span>
                  <strong>{record.name}</strong>
                  <small>{new Date(record.updatedAt).toLocaleString('zh-CN')}</small>
                </span>
                {canWrite && (
                  <Button tone="ghost" disabled={saving} onClick={() => void removeRecord(record)}>
                    删除
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
