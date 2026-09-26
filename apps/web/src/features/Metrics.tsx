import { useState, type FormEvent } from 'react';
import type { MetricsDTO } from '@navalha/contracts';
import { request } from '../lib/api';

export function Metrics() {
  const [result, setResult] = useState<MetricsDTO>();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    setLoading(true);
    setError('');
    setResult(undefined);
    try {
      const query = new URLSearchParams({ from: String(fields.get('from')), to: String(fields.get('to')) });
      const response = await request<{ data: MetricsDTO }>(`/api/v1/admin/metrics?${query}`);
      setResult(response.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao consultar métricas.'); }
    finally { setLoading(false); }
  }
  return <section className="schedule-section">
    <h2>Painel administrativo</h2>
    <form onSubmit={(event) => void submit(event)}>
      <label>De <input name="from" type="date" required /></label>
      <label>Até <input name="to" type="date" required /></label>
      <button disabled={loading}>{loading ? 'Consultando...' : 'Consultar métricas'}</button>
    </form>
    {error && <p role="alert">{error} Ajuste o período ou tente consultar novamente.</p>}
    {!result && !loading && !error && <p>Selecione um período de até 366 dias.</p>}
    {result && <>
      <p>De {result.from} até {result.to}, inclusive. Fuso: {result.timezone}.</p>
      <dl>
        <dt>Reservas confirmadas</dt><dd>{result.appointments.CONFIRMED}</dd>
        <dt>Reservas canceladas</dt><dd>{result.appointments.CANCELLED}</dd>
        <dt>Atendimentos concluídos</dt><dd>{result.appointments.COMPLETED}</dd>
        <dt>Contas ativas com último login no período</dt><dd>{result.activeUsers}</dd>
      </dl>
      <h3>Serviços concluídos</h3>
      {result.services.length === 0 ? <p>Nenhum serviço concluído no período.</p> :
        <ul>{result.services.map((service) => <li key={service.id}>{service.name}: {service.total}</li>)}</ul>}
    </>}
  </section>;
}
