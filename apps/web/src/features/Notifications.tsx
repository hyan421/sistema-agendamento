import { useEffect, useState } from 'react';
import type { NotificationDTO } from '@navalha/contracts';
import { request } from '../lib/api';

type Page = { data: NotificationDTO[]; meta: { total: number; unread: number } };
export function Notifications({ badge = false }: { badge?: boolean }) {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page>();
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [saving, setSaving] = useState('');
  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (document.hidden) return;
      void request<Page>(`/api/v1/notifications?page=${page}&pageSize=20`)
        .then((data) => { if (active) { setResult(data); setError(''); } })
        .catch(() => { if (active) setError('Não foi possível carregar as notificações.'); });
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('notifications-read', refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('notifications-read', refresh);
    };
  }, [page, revision]);
  async function markRead(id: string) {
    setSaving(id);
    try {
      await request(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
      window.dispatchEvent(new Event('notifications-read'));
    } catch { setError('Não foi possível marcar como lida. Tente novamente.'); }
    finally { setSaving(''); }
  }
  if (badge) return <span aria-label="Notificações não lidas">{result ? ` (${result.meta.unread})` : ''}</span>;
  return <section className="schedule-section">
    <h2>Notificações</h2>
    {error && <p role="alert">{error} <button onClick={() => setRevision(revision + 1)}>Tentar novamente</button></p>}
    {!result && !error && <p role="status">Carregando...</p>}
    {result?.data.length === 0 && <p>Nenhuma notificação.</p>}
    {result?.data.map((item) => <article key={item.id} className="schedule-section">
      <p>{item.message}</p>
      <time>{new Date(item.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time>
      <p>{item.readAt ? 'Lida' : <button disabled={!!saving} onClick={() => void markRead(item.id)}>Marcar como lida</button>}</p>
    </article>)}
    <button disabled={page === 1} onClick={() => { setResult(undefined); setPage(page - 1); }}>Anterior</button>
    <span> Página {page} </span>
    <button disabled={!result || page * 20 >= result.meta.total} onClick={() => { setResult(undefined); setPage(page + 1); }}>Próxima</button>
  </section>;
}
