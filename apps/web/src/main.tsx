import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';

type WeeklyInterval = { weekday: number; startTime: string; endTime: string };
type TimeBlock = { id: string; startsAt: string; endsAt: string; reason: string; createdAt: string };
type Envelope<T> = { data: T };
type ApiError = { error?: { message?: string; fields?: Record<string, string> } };

const weekdays = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (response.status === 204) return undefined as T;
  const payload = (await response.json().catch(() => null)) as ApiError | Envelope<T> | null;
  if (!response.ok) {
    const fields = payload && 'error' in payload ? payload.error?.fields : undefined;
    const fieldMessage = fields ? Object.values(fields)[0] : undefined;
    const message = payload && 'error' in payload ? payload.error?.message : undefined;
    throw new Error(fieldMessage ?? message ?? 'Não foi possível concluir a solicitação.');
  }
  return payload as T;
}

function today(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

function App(): React.JSX.Element {
  const [intervals, setIntervals] = useState<WeeklyInterval[]>([]);
  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingHours, setSavingHours] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let current = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [hoursResponse, blocksResponse] = await Promise.all([
          request<Envelope<{ intervals: WeeklyInterval[] }>>('/api/v1/barber/weekly-hours'),
          request<Envelope<TimeBlock[]>>(
            `/api/v1/barber/blocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
          ),
        ]);
        if (!current) return;
        setIntervals(hoursResponse.data.intervals);
        setBlocks(blocksResponse.data);
      } catch (cause) {
        if (current) setError(cause instanceof Error ? cause.message : 'Falha ao carregar a agenda.');
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [from, to]);

  function updateInterval(index: number, field: 'startTime' | 'endTime', value: string): void {
    setIntervals((current) =>
      current.map((interval, currentIndex) =>
        currentIndex === index ? { ...interval, [field]: value } : interval,
      ),
    );
  }

  async function saveWeeklyHours(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSavingHours(true);
    setError('');
    setNotice('');
    try {
      const result = await request<Envelope<{ intervals: WeeklyInterval[] }>>(
        '/api/v1/barber/weekly-hours',
        { method: 'PUT', body: JSON.stringify({ intervals }) },
      );
      setIntervals(result.data.intervals);
      setNotice('Jornada atualizada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a jornada.');
    } finally {
      setSavingHours(false);
    }
  }

  async function createBlock(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSavingBlock(true);
    setError('');
    setNotice('');
    try {
      const result = await request<Envelope<TimeBlock>>('/api/v1/barber/blocks', {
        method: 'POST',
        body: JSON.stringify({ startsAt, endsAt, reason }),
      });
      setBlocks((current) => [...current, result.data].sort((left, right) => left.startsAt.localeCompare(right.startsAt)));
      setStartsAt('');
      setEndsAt('');
      setReason('');
      setNotice('Bloqueio criado.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar o bloqueio.');
    } finally {
      setSavingBlock(false);
    }
  }

  async function removeBlock(block: TimeBlock): Promise<void> {
    if (!window.confirm('Remover este bloqueio da agenda?')) return;
    setError('');
    setNotice('');
    try {
      await request<void>(`/api/v1/barber/blocks/${block.id}`, { method: 'DELETE' });
      setBlocks((current) => current.filter((item) => item.id !== block.id));
      setNotice('Bloqueio removido.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível remover o bloqueio.');
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Navalha & Hora, início">
          <span className="brand-mark" aria-hidden="true">N<span>&</span>H</span>
          <span>Navalha <span className="brand-amp">&amp;</span> Hora</span>
        </a>
        <span className="topbar-label">PAINEL PROFISSIONAL</span>
      </header>

      <section className="page-heading">
        <div>
          <p className="eyebrow">AGENDA / CONFIGURAÇÃO</p>
          <h1>Horários de atendimento</h1>
        </div>
        <p className="heading-note">Jornada semanal e exceções da agenda</p>
      </section>

      {(error || notice) && (
        <div className={`feedback ${error ? 'feedback-error' : 'feedback-success'}`} role="status" aria-live="polite">
          {error || notice}
        </div>
      )}

      {loading ? (
        <p className="loading-state" aria-live="polite">Carregando agenda...</p>
      ) : (
        <div className="schedule-layout">
          <section className="schedule-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">01 / RECORRÊNCIA</p>
                <h2>Jornada semanal</h2>
              </div>
              <span className="section-index">SEG — DOM</span>
            </div>

            <form onSubmit={saveWeeklyHours}>
              <div className="weekday-list">
                {weekdays.map((day) => {
                  const dayIntervals = intervals
                    .map((interval, index) => ({ ...interval, index }))
                    .filter((interval) => interval.weekday === day.value);
                  return (
                    <div className="weekday-row" key={day.value}>
                      <div className="weekday-name">{day.label}</div>
                      <div className="weekday-intervals">
                        {dayIntervals.length === 0 && <span className="closed-label">Fechado</span>}
                        {dayIntervals.map((interval) => (
                          <div className="time-range" key={`${day.value}-${interval.index}`}>
                            <label className="visually-hidden" htmlFor={`start-${interval.index}`}>
                              Início, {day.label.toLowerCase()}
                            </label>
                            <input
                              id={`start-${interval.index}`}
                              type="time"
                              value={interval.startTime}
                              onChange={(event) => updateInterval(interval.index, 'startTime', event.target.value)}
                              required
                            />
                            <span className="range-divider" aria-hidden="true">até</span>
                            <label className="visually-hidden" htmlFor={`end-${interval.index}`}>
                              Fim, {day.label.toLowerCase()}
                            </label>
                            <input
                              id={`end-${interval.index}`}
                              type="time"
                              value={interval.endTime}
                              onChange={(event) => updateInterval(interval.index, 'endTime', event.target.value)}
                              required
                            />
                            <button
                              className="icon-button remove-interval"
                              type="button"
                              aria-label={`Remover intervalo de ${day.label.toLowerCase()}`}
                              title="Remover intervalo"
                              onClick={() => setIntervals((current) => current.filter((_, index) => index !== interval.index))}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          className="text-button add-interval"
                          type="button"
                          onClick={() => setIntervals((current) => [
                            ...current,
                            { weekday: day.value, startTime: '09:00', endTime: '12:00' },
                          ])}
                        >
                          + Intervalo
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="form-actions">
                <span className="form-hint">Alterações incompatíveis com reservas futuras serão recusadas.</span>
                <button className="primary-button" type="submit" disabled={savingHours}>
                  {savingHours ? 'Salvando...' : 'Salvar jornada'}
                </button>
              </div>
            </form>
          </section>

          <aside className="blocks-column">
            <section className="schedule-section block-form-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">02 / EXCEÇÕES</p>
                  <h2>Novo bloqueio</h2>
                </div>
                <span className="section-index">PONTUAL</span>
              </div>
              <form className="block-form" onSubmit={createBlock}>
                <label>
                  Início
                  <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
                </label>
                <label>
                  Fim
                  <input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} required />
                </label>
                <label>
                  Motivo
                  <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={200} required />
                </label>
                <button className="primary-button" type="submit" disabled={savingBlock}>
                  {savingBlock ? 'Criando...' : 'Criar bloqueio'}
                </button>
              </form>
            </section>

            <section className="schedule-section block-list-section">
              <div className="section-heading block-list-heading">
                <div>
                  <p className="eyebrow">03 / AGENDA</p>
                  <h2>Bloqueios</h2>
                </div>
                <span className="count-badge" aria-label={`${blocks.length} bloqueios`}>{blocks.length}</span>
              </div>
              <div className="date-filter">
                <label>
                  De
                  <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                </label>
                <label>
                  Até
                  <input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                </label>
              </div>
              {blocks.length === 0 ? (
                <p className="empty-state">Nenhum bloqueio neste período.</p>
              ) : (
                <ul className="block-list">
                  {blocks.map((block) => (
                    <li className="block-item" key={block.id}>
                      <div className="block-date">
                        <strong>{formatBlockDate(block.startsAt)}</strong>
                        <span>{formatBlockTime(block.startsAt)} – {formatBlockTime(block.endsAt)}</span>
                      </div>
                      <p>{block.reason}</p>
                      <button
                        className="text-button delete-block"
                        type="button"
                        onClick={() => void removeBlock(block)}
                        aria-label={`Remover bloqueio: ${block.reason}`}
                      >
                        Remover
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      )}
      <footer className="page-footer"><span>Navalha &amp; Hora</span><span>AMERICA / SAO PAULO</span></footer>
    </main>
  );
}

function formatBlockDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function formatBlockTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root ausente em index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);