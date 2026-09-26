import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';

import './styles.css';
import { Assistant } from './features/Assistant';
import { Metrics } from './features/Metrics';
import { Notifications } from './features/Notifications';
import { BrowserRouter, useLocation } from 'react-router';
import { useView } from './lib/navigation';
import { request } from './lib/api';

type WeeklyInterval = { weekday: number; startTime: string; endTime: string };
type TimeBlock = { id: string; startsAt: string; endsAt: string; reason: string; createdAt: string };
type Envelope<T> = { data: T };
type Service = { id: string; name: string; description: string; category: string; durationMinutes: number; priceCents: number; active: boolean };
type Barber = { id: string; displayName: string };
type User = { id: string; name: string; email: string; role: 'CLIENT' | 'BARBER' | 'ADMIN' };
type Appointment = { id: string; serviceId: string; barberId: string; startsAt: string; endsAt: string; status: 'CONFIRMED' | 'CANCELLED' | 'COMPLETED'; serviceName: string; priceCents: number; durationMinutes: number; createdAt: string; clientName?: string };
type PageEnvelope<T> = { data: T[]; meta: { page: number; pageSize: number; total: number } };

const weekdays = [
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
  { value: 7, label: 'Domingo' },
];

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
  const [view, setView] = useView();
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
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
    void request<Envelope<User>>('/api/v1/auth/me')
      .then((result) => { if (current) setCurrentUser(result.data); })
      .catch(() => { if (current) setCurrentUser(null); })
      .finally(() => { if (current) setSessionLoading(false); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    let current = true;
    if (view !== 'schedule') {
      setLoading(false);
      return () => { current = false; };
    }
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
  }, [from, to, view]);

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

  async function logout(): Promise<void> {
    setError('');
    try {
      await request<void>('/api/v1/auth/logout', { method: 'POST' });
      setCurrentUser(null);
      setView('book');
      setNotice('Sessão encerrada.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível encerrar a sessão.');
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Navalha & Hora, início">
          <span className="brand-mark" aria-hidden="true">N<span>&</span>H</span>
          <span>Navalha <span className="brand-amp">&amp;</span> Hora</span>
        </a>
        <div className="topbar-account">
          <span className="topbar-label">{sessionLoading ? '...' : currentUser ? `${currentUser.name} / ${currentUser.role}` : 'AGENDAMENTO'}</span>
          {currentUser && <button className="text-button" type="button" onClick={() => void logout()}>Sair</button>}
        </div>
      </header>

      <nav className="view-nav" aria-label="Navegação principal">
        <button onClick={() => setView('catalog')}>Catálogo</button>
        {!currentUser && <><a href="/entrar">Entrar</a><a href="/cadastro">Cadastrar</a></>}
        {currentUser?.role === 'CLIENT' && <button onClick={() => setView('assistant')}>Assistente</button>}
        {currentUser?.role === 'ADMIN' && <button onClick={() => setView('metrics')}>Métricas</button>}
        {currentUser && <button onClick={() => setView('notifications')}>Notificações<Notifications key={currentUser.id} badge /></button>}
        <button className={view === 'book' ? 'nav-active' : ''} type="button" onClick={() => setView('book')}>Agendar</button>
        {currentUser?.role === 'CLIENT' && <button className={view === 'mine' ? 'nav-active' : ''} type="button" onClick={() => setView('mine')}>Meus agendamentos</button>}
        {currentUser?.role === 'BARBER' && <>
          <button className={view === 'barber' ? 'nav-active' : ''} type="button" onClick={() => setView('barber')}>Agenda do dia</button>
          <button className={view === 'schedule' ? 'nav-active' : ''} type="button" onClick={() => setView('schedule')}>Jornada e bloqueios</button>
        </>}
      </nav>

      <section className="page-heading">
        <div>
          <p className="eyebrow">{view === 'book' ? 'RESERVAS / NOVO AGENDAMENTO' : view === 'mine' ? 'RESERVAS / CLIENTE' : view === 'barber' ? 'AGENDA / PROFISSIONAL' : 'AGENDA / CONFIGURAÇÃO'}</p>
          <h1>{view === 'book' ? 'Reserve seu horário' : view === 'mine' ? 'Meus agendamentos' : view === 'barber' ? 'Agenda do barbeiro' : 'Horários de atendimento'}</h1>
        </div>
        <p className="heading-note">{view === 'book' ? 'Serviço, profissional e horário em um só fluxo' : view === 'mine' ? 'Próximos horários e histórico' : view === 'barber' ? 'Atendimentos e estados de hoje' : 'Jornada semanal e exceções da agenda'}</p>
      </section>

      {(error || notice) && (
        <div className={`feedback ${error ? 'feedback-error' : 'feedback-success'}`} role="status" aria-live="polite">
          {error || notice}
        </div>
      )}

      {view === 'notfound' && <section><h2>Página não encontrada</h2><a href="/">Voltar ao início</a></section>}
      {!sessionLoading && !currentUser && ['mine', 'barber', 'schedule', 'notifications', 'metrics', 'assistant', 'services'].includes(view) &&
        <p>Entre na sua conta para acessar esta página. <a href="/entrar">Entrar</a></p>}
      {currentUser && ((['barber', 'schedule', 'services'].includes(view) && currentUser.role !== 'BARBER') ||
        (view === 'metrics' && currentUser.role !== 'ADMIN') || (['mine', 'assistant'].includes(view) && currentUser.role !== 'CLIENT')) &&
        <p role="alert">Sua conta não tem acesso a esta página.</p>}
      {view === 'assistant' && currentUser?.role === 'CLIENT' && <Assistant />}
      {view === 'metrics' && currentUser?.role === 'ADMIN' && <Metrics />}
      {view === 'notifications' && currentUser && <Notifications key={currentUser.id} />}
      {view === 'book' && (
        <BookingPanel key={location.pathname + location.search}
          user={currentUser}
          onUser={setCurrentUser}
          setError={setError}
          setNotice={setNotice}
        />
      )}
      {view === 'mine' && currentUser?.role === 'CLIENT' && (
        <ClientAppointmentsPanel setError={setError} setNotice={setNotice} />
      )}
      {view === 'barber' && currentUser?.role === 'BARBER' && (
        <BarberAppointmentsPanel setError={setError} setNotice={setNotice} />
      )}
      {view === 'schedule' && currentUser?.role === 'BARBER' && (loading ? (
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
      ))}
      <footer className="page-footer"><span>Navalha &amp; Hora</span><span>AMERICA / SAO PAULO</span></footer>
    </main>
  );
}

function BookingPanel({
  user,
  onUser,
  setError,
  setNotice,
}: {
  user: User | null;
  onUser: (user: User | null) => void;
  setError: (message: string) => void;
  setNotice: (message: string) => void;
}): React.JSX.Element {
  const [services, setServices] = useState<Service[]>([]);
  const [barbers, setBarbers] = useState<Barber[]>([]);
  const [slots, setSlots] = useState<Array<{ startsAt: string; endsAt: string; durationMinutes: number }>>([]);
  const params = new URLSearchParams(window.location.search);
  const [serviceId, setServiceId] = useState(params.get('serviceId') ?? '');
  const [barberId, setBarberId] = useState(params.get('barberId') ?? '');
  const [date, setDate] = useState(() => params.get('date') ?? (params.get('startsAt') ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(params.get('startsAt')!)) : today()));
  const [selectedSlot, setSelectedSlot] = useState('');
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [saving, setSaving] = useState(false);
  const [authRequired, setAuthRequired] = useState(['/entrar', '/cadastro'].includes(window.location.pathname));
  const [authMode, setAuthMode] = useState<'login' | 'register'>(window.location.pathname === '/cadastro' ? 'register' : 'login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [savingAuth, setSavingAuth] = useState(false);

  useEffect(() => {
    let current = true;
    setLoadingOptions(true);
    void Promise.all([
      request<Envelope<Service[]>>('/api/v1/services'),
      request<Envelope<Barber[]>>('/api/v1/barbers'),
    ]).then(([serviceResult, barberResult]) => {
      if (!current) return;
      setServices(serviceResult.data);
      setBarbers(barberResult.data);
      setServiceId((selected) => selected || serviceResult.data[0]?.id || '');
      setBarberId((selected) => selected || barberResult.data[0]?.id || '');
    }).catch((cause: unknown) => {
      if (current) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o catálogo.');
    }).finally(() => { if (current) setLoadingOptions(false); });
    return () => { current = false; };
  }, [setError]);

  useEffect(() => {
    if (!serviceId || !barberId || !date) {
      setSlots([]);
      setSelectedSlot('');
      return;
    }
    let current = true;
    setLoadingSlots(true);
    setSelectedSlot('');
    const query = new URLSearchParams({ serviceId, barberId, date });
    void request<Envelope<typeof slots>>(`/api/v1/availability?${query.toString()}`)
      .then((result) => { if (current) setSlots(result.data); })
      .catch((cause: unknown) => {
        if (current) {
          setSlots([]);
          setError(cause instanceof Error ? cause.message : 'Não foi possível consultar horários.');
        }
      }).finally(() => { if (current) setLoadingSlots(false); });
    return () => { current = false; };
  }, [serviceId, barberId, date, availabilityRevision, setError]);

  const selectedService = services.find((service) => service.id === serviceId);
  const selectedBarber = barbers.find((barber) => barber.id === barberId);
  const chosenSlot = slots.find((slot) => slot.startsAt === selectedSlot);

  async function confirmBooking(): Promise<void> {
    setError('');
    setNotice('');
    if (!user) {
      setAuthRequired(true);
      return;
    }
    if (user.role !== 'CLIENT') {
      setError('Entre com uma conta de cliente para confirmar o agendamento.');
      return;
    }
    if (!selectedSlot) return;
    setSaving(true);
    try {
      const result = await request<Envelope<Appointment>>('/api/v1/appointments', {
        method: 'POST',
        body: JSON.stringify({ serviceId, barberId, startsAt: selectedSlot }),
      });
      setNotice(`Agendamento confirmado para ${formatDateTime(result.data.startsAt)}.`);
      setSlots((current) => current.filter((slot) => slot.startsAt !== selectedSlot));
      setSelectedSlot('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível confirmar o horário.');
      if (cause instanceof Error && cause.message.includes('Authentication')) {
        onUser(null);
        setAuthRequired(true);
      }
      setAvailabilityRevision((revision) => revision + 1);
    } finally {
      setSaving(false);
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSavingAuth(true);
    setError('');
    try {
      if (authMode === 'register') {
        await request<Envelope<User>>('/api/v1/auth/register', {
          method: 'POST',
          body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }),
        });
      }
      const result = await request<Envelope<User>>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      onUser(result.data);
      setAuthRequired(false);
      setAuthPassword('');
      setNotice('Sessão iniciada. Seu horário continua selecionado.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível autenticar.');
    } finally {
      setSavingAuth(false);
    }
  }

  if (loadingOptions) return <p className="loading-state" aria-live="polite">Carregando serviços e profissionais...</p>;

  return (
    <section className="booking-layout" aria-label="Fluxo de agendamento">
      <div className="booking-main">
        <section className="schedule-section booking-section">
          <div className="section-heading">
            <div><p className="eyebrow">01 / ESCOLHA</p><h2>Serviço e profissional</h2></div>
            <span className="section-index">CATÁLOGO</span>
          </div>
          {services.length === 0 ? <p className="empty-state">Não há serviços disponíveis.</p> : (
            <div className="booking-selectors">
              <label>Serviço
                <select value={serviceId} onChange={(event) => setServiceId(event.target.value)}>
                  {services.map((service) => <option value={service.id} key={service.id}>{service.name} · {formatMoney(service.priceCents)} · {service.durationMinutes} min</option>)}
                </select>
              </label>
              <label>Barbeiro
                <select value={barberId} onChange={(event) => setBarberId(event.target.value)}>
                  {barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.displayName}</option>)}
                </select>
              </label>
              <label>Data
                <input type="date" min={today()} max={addDays(today(), 30)} value={date} onChange={(event) => setDate(event.target.value)} />
              </label>
            </div>
          )}
        </section>

        <section className="schedule-section slots-section">
          <div className="section-heading">
            <div><p className="eyebrow">02 / DISPONIBILIDADE</p><h2>Horários livres</h2></div>
            <span className="section-index">GRADE 15 MIN</span>
          </div>
          {loadingSlots ? <p className="empty-state">Consultando disponibilidade...</p> : slots.length === 0 ? (
            <p className="empty-state">Nenhum horário livre nesta data. Escolha outro dia.</p>
          ) : (
            <div className="slot-grid" role="group" aria-label="Escolha um horário">
              {slots.map((slot) => (
                <button
                  className={`slot-button ${selectedSlot === slot.startsAt ? 'slot-selected' : ''}`}
                  type="button"
                  key={slot.startsAt}
                  aria-pressed={selectedSlot === slot.startsAt}
                  onClick={() => setSelectedSlot(slot.startsAt)}
                >
                  {formatTime(slot.startsAt)}
                </button>
              ))}
            </div>
          )}
        </section>

        {authRequired && !user && (
          <section className="schedule-section auth-section">
            <div className="section-heading">
              <div><p className="eyebrow">03 / IDENTIFICAÇÃO</p><h2>{authMode === 'login' ? 'Entre para confirmar' : 'Criar conta de cliente'}</h2></div>
              <span className="section-index">SESSÃO SEGURA</span>
            </div>
            <form className="auth-form" onSubmit={(event) => void submitAuth(event)}>
              {authMode === 'register' && <label>Nome<input autoComplete="name" value={authName} onChange={(event) => setAuthName(event.target.value)} minLength={2} maxLength={80} required /></label>}
              <label>E-mail<input type="email" autoComplete="email" value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} required /></label>
              <label>Senha<input type="password" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} minLength={10} maxLength={128} required /></label>
              <div className="auth-actions">
                <button className="primary-button" disabled={savingAuth}>{savingAuth ? 'Aguarde...' : authMode === 'login' ? 'Entrar' : 'Cadastrar e entrar'}</button>
                <button className="text-button" type="button" onClick={() => setAuthMode((mode) => mode === 'login' ? 'register' : 'login')}>
                  {authMode === 'login' ? 'Criar conta' : 'Já tenho conta'}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      <aside className="booking-summary schedule-section">
        <p className="eyebrow">REVISÃO</p>
        <h2>Seu horário</h2>
        <dl>
          <div><dt>Serviço</dt><dd>{selectedService?.name ?? 'Selecione um serviço'}</dd></div>
          <div><dt>Profissional</dt><dd>{selectedBarber?.displayName ?? 'Selecione um barbeiro'}</dd></div>
          <div><dt>Data e hora</dt><dd>{chosenSlot ? formatDateTime(chosenSlot.startsAt) : 'Selecione um horário'}</dd></div>
          <div><dt>Duração</dt><dd>{selectedService ? `${selectedService.durationMinutes} minutos` : '—'}</dd></div>
          <div className="summary-price"><dt>Valor</dt><dd>{selectedService ? formatMoney(selectedService.priceCents) : '—'}</dd></div>
        </dl>
        <button className="primary-button summary-confirm" type="button" disabled={!chosenSlot || saving} onClick={() => void confirmBooking()}>
          {saving ? 'Confirmando...' : 'Confirmar agendamento'}
        </button>
        <p className="summary-note">O horário só fica reservado após a confirmação da API.</p>
      </aside>
    </section>
  );
}

function ClientAppointmentsPanel({
  setError,
  setNotice,
}: { setError: (message: string) => void; setNotice: (message: string) => void }): React.JSX.Element {
  const [scope, setScope] = useState<'upcoming' | 'history'>('upcoming');
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageEnvelope<Appointment>>({ data: [], meta: { page: 1, pageSize: 20, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ scope, page: String(page), pageSize: '20' });
    void request<PageEnvelope<Appointment>>(`/api/v1/appointments/mine?${query.toString()}`)
      .then((response) => { if (current) setResult(response); })
      .catch((cause: unknown) => { if (current) setError(cause instanceof Error ? cause.message : 'Falha ao carregar agendamentos.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [scope, page, revision, setError]);

  async function cancel(appointment: Appointment): Promise<void> {
    if (!window.confirm(`Cancelar ${appointment.serviceName} em ${formatDateTime(appointment.startsAt)}?`)) return;
    setError('');
    setNotice('');
    try {
      await request<Envelope<Appointment>>(`/api/v1/appointments/${appointment.id}/cancel`, { method: 'POST' });
      setNotice('Agendamento cancelado.');
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cancelar o agendamento.');
      setRevision((value) => value + 1);
    }
  }

  return (
    <section className="schedule-section appointment-list-section">
      <div className="section-heading">
        <div><p className="eyebrow">RESERVAS / CLIENTE</p><h2>{scope === 'upcoming' ? 'Próximos horários' : 'Histórico'}</h2></div>
        <div className="segmented-control" role="group" aria-label="Tipo de agendamento">
          <button className={scope === 'upcoming' ? 'segment-active' : ''} onClick={() => { setScope('upcoming'); setPage(1); }} type="button">Próximos</button>
          <button className={scope === 'history' ? 'segment-active' : ''} onClick={() => { setScope('history'); setPage(1); }} type="button">Histórico</button>
        </div>
      </div>
      {loading ? <p className="empty-state">Carregando agendamentos...</p> : result.data.length === 0 ? (
        <p className="empty-state">{scope === 'upcoming' ? 'Você não tem agendamentos futuros.' : 'Seu histórico está vazio.'}</p>
      ) : (
        <ul className="appointment-list">
          {result.data.map((appointment) => (
            <li className="appointment-row" key={appointment.id}>
              <div className="appointment-when"><strong>{formatDateTime(appointment.startsAt)}</strong><span>{appointment.durationMinutes} min</span></div>
              <div className="appointment-info"><strong>{appointment.serviceName}</strong><span>{formatMoney(appointment.priceCents)}</span></div>
              <span className={`status-label status-${appointment.status.toLowerCase()}`}>{statusText(appointment.status)}</span>
              {scope === 'upcoming' && appointment.status === 'CONFIRMED' && (
                <button className="text-button appointment-action" type="button" onClick={() => void cancel(appointment)}>Cancelar</button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={result.meta.page} pageSize={result.meta.pageSize} total={result.meta.total} loading={loading} onPage={setPage} />
    </section>
  );
}

function BarberAppointmentsPanel({
  setError,
  setNotice,
}: { setError: (message: string) => void; setNotice: (message: string) => void }): React.JSX.Element {
  const [date, setDate] = useState(today);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PageEnvelope<Appointment>>({ data: [], meta: { page: 1, pageSize: 20, total: 0 } });
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ date, page: String(page), pageSize: '20' });
    void request<PageEnvelope<Appointment>>(`/api/v1/barber/appointments?${query.toString()}`)
      .then((response) => { if (current) setResult(response); })
      .catch((cause: unknown) => { if (current) setError(cause instanceof Error ? cause.message : 'Falha ao carregar agenda.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [date, page, revision, setError]);

  async function mutate(appointment: Appointment, action: 'cancel' | 'complete'): Promise<void> {
    const actionLabel = action === 'cancel' ? 'Cancelar' : 'Concluir';
    if (!window.confirm(`${actionLabel} o agendamento de ${appointment.clientName ?? 'cliente'}?`)) return;
    setError('');
    setNotice('');
    try {
      await request<Envelope<Appointment>>(
        action === 'cancel'
          ? `/api/v1/appointments/${appointment.id}/cancel`
          : `/api/v1/barber/appointments/${appointment.id}/complete`,
        { method: 'POST' },
      );
      setNotice(action === 'cancel' ? 'Agendamento cancelado.' : 'Agendamento concluído.');
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Não foi possível ${actionLabel.toLowerCase()} o agendamento.`);
      setRevision((value) => value + 1);
    }
  }

  return (
    <section className="schedule-section appointment-list-section">
      <div className="section-heading">
        <div><p className="eyebrow">AGENDA / ATENDIMENTOS</p><h2>Reservas do dia</h2></div>
        <label className="day-picker">Data<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setPage(1); }} /></label>
      </div>
      {loading ? <p className="empty-state">Carregando agenda...</p> : result.data.length === 0 ? (
        <p className="empty-state">Não há atendimentos nesta data.</p>
      ) : (
        <ul className="appointment-list barber-appointment-list">
          {result.data.map((appointment) => (
            <li className="appointment-row" key={appointment.id}>
              <div className="appointment-when"><strong>{formatTime(appointment.startsAt)}–{formatTime(appointment.endsAt)}</strong><span>{appointment.durationMinutes} min</span></div>
              <div className="appointment-info"><strong>{appointment.clientName}</strong><span>{appointment.serviceName} · {formatMoney(appointment.priceCents)}</span></div>
              <span className={`status-label status-${appointment.status.toLowerCase()}`}>{statusText(appointment.status)}</span>
              {appointment.status === 'CONFIRMED' && (
                <div className="appointment-actions">
                  <button className="text-button" type="button" disabled={new Date(appointment.startsAt).getTime() <= Date.now()} title="Disponível antes do horário de início" onClick={() => void mutate(appointment, 'cancel')}>Cancelar</button>
                  <button className="text-button" type="button" disabled={new Date(appointment.endsAt).getTime() > Date.now()} title="Disponível após o horário final" onClick={() => void mutate(appointment, 'complete')}>Concluir</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pagination page={result.meta.page} pageSize={result.meta.pageSize} total={result.meta.total} loading={loading} onPage={setPage} />
    </section>
  );
}

function Pagination({
  page,
  pageSize,
  total,
  loading,
  onPage,
}: { page: number; pageSize: number; total: number; loading: boolean; onPage: (page: number) => void }): React.JSX.Element {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination">
      <span>{total === 0 ? '0 resultados' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`}</span>
      <div>
        <button type="button" aria-label="Página anterior" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>‹</button>
        <span>{page} / {pageCount}</span>
        <button type="button" aria-label="Próxima página" disabled={loading || page >= pageCount} onClick={() => onPage(page + 1)}>›</button>
      </div>
    </div>
  );
}

function formatMoney(priceCents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(priceCents / 100);
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function formatBlockDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function statusText(status: Appointment['status']): string {
  return status === 'CONFIRMED' ? 'Confirmado' : status === 'CANCELLED' ? 'Cancelado' : 'Concluído';
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatBlockTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root ausente em index.html');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter><App /></BrowserRouter>
  </StrictMode>,
);