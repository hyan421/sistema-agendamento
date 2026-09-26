import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router';
import type { ServiceDTO } from '@navalha/contracts';
import { request } from '../lib/api';

type Shop = { name: string; address: string; city: string; district: string; timezone: string };
export function Catalog() {
  const [params, setParams] = useSearchParams();
  const [services, setServices] = useState<ServiceDTO[]>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const query = params.toString();
  useEffect(() => {
    let active = true;
    setServices(undefined); setError('');
    void Promise.all([request<{ data: ServiceDTO[] }>(`/api/v1/services?${query}`), request<{ data: Shop | null }>('/api/v1/shop')])
      .then(([s, place]) => { if (active) { setServices(s.data); setShop(place.data); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Falha ao carregar catálogo.'); });
    return () => { active = false; };
  }, [query, revision]);
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const key of ['category', 'location']) if (data.get(key)) next.set(key, String(data.get(key)));
    for (const key of ['minPriceCents', 'maxPriceCents']) {
      if (data.get(key)) next.set(key, String(Math.round(Number(data.get(key)) * 100)));
    }
    setParams(next);
  }
  return <section className="schedule-section">
    <h2>Catálogo de serviços</h2>
    {shop && <p>{shop.name} — {shop.address}, {shop.district}, {shop.city}. Fuso: {shop.timezone}.</p>}
    <form key={query} onSubmit={filter} className="catalog-filters">
      <label>Categoria <select name="category" defaultValue={params.get('category') ?? ''}>
        <option value="">Todas</option><option value="CUT">Corte</option><option value="BEARD">Barba</option><option value="COMBO">Combo</option>
      </select></label>
      <label>Preço mínimo (R$) <input name="minPriceCents" type="number" min="0.01" max="1000" step="0.01" defaultValue={params.has('minPriceCents') ? Number(params.get('minPriceCents')) / 100 : ''} /></label>
      <label>Preço máximo (R$) <input name="maxPriceCents" type="number" min="0.01" max="1000" step="0.01" defaultValue={params.has('maxPriceCents') ? Number(params.get('maxPriceCents')) / 100 : ''} /></label>
      <label>Cidade ou bairro <input name="location" maxLength={100} defaultValue={params.get('location') ?? ''} /></label>
      <button>Filtrar</button><button type="button" onClick={() => setParams({})}>Limpar filtros</button>
    </form>
    {error && <p role="alert">{error} <button onClick={() => setRevision(revision + 1)}>Tentar novamente</button></p>}
    {!services && !error && <p role="status">Carregando...</p>}
    {services?.length === 0 && <p>Nenhum serviço encontrado para os filtros selecionados.</p>}
    <div className="catalog-grid">{services?.map((s) => <article className="schedule-section" key={s.id}>
      <h3>{s.name}</h3><p>{s.description}</p><p>{s.durationMinutes} minutos · {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(s.priceCents / 100)}</p>
      <a href={`/agendar?serviceId=${s.id}`}>Agendar</a>
    </article>)}</div>
  </section>;
}
