import { useState, type FormEvent } from 'react';
import { registerSchema, type UserDTO } from '@navalha/contracts';
import { ApiError, request } from '../lib/api';

export function AdminBarbers() {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const parsed = registerSchema.safeParse(Object.fromEntries(new FormData(form)));
    setFields({});
    setError('');
    setNotice('');
    if (!parsed.success) {
      setFields(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }

    setSaving(true);
    try {
      const result = await request<{ data: UserDTO }>('/api/v1/admin/barbers', {
        method: 'POST',
        body: JSON.stringify(parsed.data),
      });
      form.reset();
      setNotice(`${result.data.name} foi cadastrado como barbeiro. Ele já pode entrar e configurar a jornada.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível cadastrar o barbeiro.');
      if (cause instanceof ApiError) setFields(cause.fields);
    } finally {
      setSaving(false);
    }
  }

  return <section className="schedule-section">
    <h2>Cadastrar barbeiro</h2>
    <form onSubmit={(event) => void submit(event)}>
      <label>Nome <input name="name" autoComplete="name" required minLength={2} maxLength={80} aria-describedby="barber-name-error" /><span id="barber-name-error">{fields.name}</span></label>
      <label>E-mail <input name="email" type="email" autoComplete="email" required aria-describedby="barber-email-error" /><span id="barber-email-error">{fields.email}</span></label>
      <label>Senha inicial <input name="password" type="password" autoComplete="new-password" required minLength={10} maxLength={128} aria-describedby="barber-password-error" /><span id="barber-password-error">{fields.password}</span></label>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button className="primary-button" disabled={saving}>{saving ? 'Cadastrando...' : 'Cadastrar barbeiro'}</button>
    </form>
  </section>;
}