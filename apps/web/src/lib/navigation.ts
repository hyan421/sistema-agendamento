import { useLocation, useNavigate } from 'react-router';

const paths = {
  login: '/entrar', register: '/cadastro', book: '/agendar', mine: '/meus-agendamentos', barber: '/profissional/agenda',
  schedule: '/profissional/agenda?configurar=1', notifications: '/notificacoes',
  metrics: '/admin', assistant: '/assistente', catalog: '/', services: '/profissional/servicos',
};
export type View = keyof typeof paths | 'notfound';
export function useView(): [View, (view: View) => void] {
  const location = useLocation();
  const navigate = useNavigate();
  let view: View = 'notfound';
  for (const [key, path] of Object.entries(paths)) {
    if (path === location.pathname) view = key as View;
  }
  if (location.pathname === '/profissional/agenda' && new URLSearchParams(location.search).has('configurar')) view = 'schedule';
  return [view, (next) => { if (next !== 'notfound') void navigate(paths[next]); }];
}
