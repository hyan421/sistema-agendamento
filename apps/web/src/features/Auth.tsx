import { useState, type FormEvent } from 'react';
import { loginSchema, registerSchema, type UserDTO } from '@navalha/contracts';
import { ApiError, request } from '../lib/api';

export function Auth({ register = false, onUser }: { register?: boolean; onUser: (user: UserDTO) => void }) {
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const parsed = (register ? registerSchema : loginSchema).safeParse(data);
    setError(''); setFields({});
    if (!parsed.success) {
      setFields(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    setSaving(true);
    try {
      if (register) await request('/api/v1/auth/register', { method: 'POST', body: JSON.stringify(parsed.data) });
      const { email, password } = parsed.data;
      const result = await request<{ data: UserDTO }>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      onUser(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.');
      if (cause instanceof ApiError) setFields(cause.fields);
    } finally { setSaving(false); }
  }
  return <section className="schedule-section auth-section">
    <h2>{register ? 'Criar conta de cliente' : 'Entrar na sua conta'}</h2>
    <form onSubmit={(event) => void submit(event)}>
      {register && <label>Nome <input name="name" autoComplete="name" required minLength={2} maxLength={80} aria-describedby="auth-name" /><span id="auth-name">{fields.name}</span></label>}
      <label>E-mail <input name="email" type="email" autoComplete="email" required aria-describedby="auth-email" /><span id="auth-email">{fields.email}</span></label>
      <label>Senha <input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={10} maxLength={128} aria-describedby="auth-password" /><span id="auth-password">{fields.password}</span></label>
      {error && <p role="alert">{error}</p>}
      <button disabled={saving}>{saving ? 'Aguarde...' : register ? 'Cadastrar e entrar' : 'Entrar'}</button>
    </form>
    <a href={register ? '/entrar' : '/cadastro'}>{register ? 'Já tenho uma conta' : 'Criar uma conta'}</a>
  </section>;
}
