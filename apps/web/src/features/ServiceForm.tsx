import { useState, type FormEvent } from 'react';
import { createServiceSchema, type ServiceDTO } from '@navalha/contracts';
import { ApiError, request } from '../lib/api';

export function ServiceForm({ service, onSaved }: { service?: ServiceDTO; onSaved: () => void }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const input = createServiceSchema.safeParse({
      name: data.get('name'), description: data.get('description'), category: data.get('category'),
      durationMinutes: Number(data.get('durationMinutes')), priceCents: Math.round(Number(data.get('price')) * 100),
    });
    setFields({}); setError('');
    if (!input.success) {
      setFields(Object.fromEntries(input.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    setSaving(true);
    try {
      await request(`/api/v1/barber/services${service ? `/${service.id}` : ''}`, {
        method: service ? 'PATCH' : 'POST', body: JSON.stringify(input.data),
      });
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao salvar serviço.');
      if (cause instanceof ApiError) setFields(cause.fields);
    } finally { setSaving(false); }
  }
  const fieldError = (name: string) => <span id={`error-${name}`} role="status">{fields[name]}</span>;
  return <form className="service-form" onSubmit={(event) => void submit(event)}>
    <h3>{service ? `Editar ${service.name}` : 'Novo serviço'}</h3>
    <label>Nome <input name="name" defaultValue={service?.name} required minLength={3} maxLength={80} aria-describedby="error-name" />{fieldError('name')}</label>
    <label>Descrição <textarea name="description" defaultValue={service?.description ?? ''} maxLength={500} aria-describedby="error-description" />{fieldError('description')}</label>
    <label>Categoria <select name="category" defaultValue={service?.category ?? 'CUT'} aria-describedby="error-category"><option value="CUT">Corte</option><option value="BEARD">Barba</option><option value="COMBO">Combo</option></select>{fieldError('category')}</label>
    <label>Duração (minutos) <input name="durationMinutes" type="number" min={15} max={180} step={15} defaultValue={service?.durationMinutes ?? 30} required aria-describedby="error-durationMinutes" />{fieldError('durationMinutes')}</label>
    <label>Preço (R$) <input name="price" type="number" min="0.01" max="1000" step="0.01" defaultValue={service ? service.priceCents / 100 : ''} required aria-describedby="error-priceCents" />{fieldError('priceCents')}</label>
    {error && <p role="alert">{error}</p>}
    <button disabled={saving}>{saving ? 'Salvando...' : 'Salvar serviço'}</button>
  </form>;
}
