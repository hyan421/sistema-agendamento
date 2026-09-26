import { useEffect, useState, type FormEvent } from 'react';
import type { AssistantInput, AssistantReply, ServiceDTO, BarberDTO } from '@navalha/contracts';
import { request } from '../lib/api';

export function Assistant() {
  const [services, setServices] = useState<ServiceDTO[]>([]);
  const [barbers, setBarbers] = useState<BarberDTO[]>([]);
  const [history, setHistory] = useState<AssistantInput['history']>([]);
  const [reply, setReply] = useState<AssistantReply>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    void Promise.all([request<{ data: ServiceDTO[] }>('/api/v1/services'), request<{ data: BarberDTO[] }>('/api/v1/barbers')])
      .then(([s, b]) => { if (active) { setServices(s.data); setBarbers(b.data); setError(''); } })
      .catch(() => { if (active) setError('Não foi possível carregar as opções.'); });
    return () => { active = false; };
  }, [revision]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const message = String(fields.get('message'));
    const input: AssistantInput = { message, history: history.slice(-6) };
    for (const key of ['serviceId', 'barberId', 'date'] as const) {
      if (fields.get(key)) input[key] = String(fields.get(key));
    }
    setLoading(true); setError('');
    try {
      const result = await request<{ data: AssistantReply }>('/api/v1/assistant/messages', { method: 'POST', body: JSON.stringify(input) });
      setReply(result.data);
      setHistory([...history, { role: 'user' as const, content: message },
        { role: 'assistant' as const, content: result.data.text.slice(0, 1000) }].slice(-6));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível responder.'); }
    finally { setLoading(false); }
  }
  return <section className="schedule-section">
    <h2>Assistente da barbearia</h2>
    <p>Tire dúvidas sobre serviços e selecione opções para sugestões de horários.</p>
    <form onSubmit={(event) => void submit(event)}>
      <label>Serviço <select name="serviceId"><option value="">Selecione</option>{services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Barbeiro <select name="barberId"><option value="">Selecione</option>{barbers.map((b) => <option key={b.id} value={b.id}>{b.displayName}</option>)}</select></label>
      <label>Data <input type="date" name="date" /></label>
      <label>Mensagem <textarea name="message" required maxLength={1000} /></label>
      <button disabled={loading}>{loading ? 'Respondendo...' : 'Enviar'}</button>
    </form>
    {error && <p role="alert">{error} <button onClick={() => setRevision(revision + 1)}>Recarregar opções</button></p>}
    {reply && <div aria-live="polite">
      <h3>{reply.mode === 'ollama' ? 'Resposta com IA local' : 'Ajuda automática, sem LLM'}</h3>
      <p style={{ whiteSpace: 'pre-line' }}>{reply.text}</p>
      <ul>{reply.serviceSuggestions.map((s) => <li key={s.id}><a href={`/agendar?serviceId=${s.id}`}>{s.name}</a></li>)}</ul>
      {reply.slotSuggestions.map((slot) => <p key={slot.startsAt}><a href={`/agendar?${new URLSearchParams(slot)}`}>
        Agendar {new Date(slot.startsAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
      </a></p>)}
    </div>}
  </section>;
}
