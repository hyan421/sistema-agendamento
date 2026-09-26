import { useEffect, useState } from 'react';
import type { ServiceDTO } from '@navalha/contracts';
import { request } from '../lib/api';
import { ServiceForm } from './ServiceForm';

export function Services() {
  const [items, setItems] = useState<ServiceDTO[]>();
  const [selected, setSelected] = useState<ServiceDTO>();
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setError(''); setItems(undefined);
    void request<{ data: ServiceDTO[] }>('/api/v1/barber/services')
      .then((result) => { if (active) setItems(result.data); })
      .catch(() => { if (active) setError('Não foi possível carregar os serviços.'); });
    return () => { active = false; };
  }, [revision]);
  function saved() {
    setSelected(undefined); setRevision(revision + 1); setNotice('Serviço salvo.');
  }
  async function toggle(service: ServiceDTO) {
    if (!window.confirm(`${service.active ? 'Desativar' : 'Ativar'} ${service.name}? Reservas existentes serão preservadas.`)) return;
    setSaving(true); setError('');
    try {
      await request(`/api/v1/barber/services/${service.id}`, { method: 'PATCH', body: JSON.stringify({ active: !service.active }) });
      saved();
    } catch { setError('Não foi possível alterar o serviço. Tente novamente.'); }
    finally { setSaving(false); }
  }
  return <section className="schedule-section">
    <h2>Gerenciar serviços</h2>
    {error && <p role="alert">{error} <button onClick={() => setRevision(revision + 1)}>Tentar novamente</button></p>}
    {notice && <p role="status">{notice}</p>}
    {!items && !error && <p>Carregando...</p>}
    {items?.length === 0 && <p>Nenhum serviço cadastrado.</p>}
    {items?.map((service) => <article key={service.id} className="schedule-section">
      <h3>{service.name} — {service.active ? 'Ativo' : 'Inativo'}</h3>
      <p>{service.durationMinutes} minutos · {(service.priceCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
      <button onClick={() => setSelected(service)}>Editar</button>
      <button disabled={saving} onClick={() => void toggle(service)}>{service.active ? 'Desativar' : 'Ativar'}</button>
    </article>)}
    <button onClick={() => setSelected(undefined)}>Novo serviço</button>
    <ServiceForm key={`${selected?.id ?? 'new'}-${revision}`} service={selected} onSaved={saved} />
  </section>;
}
