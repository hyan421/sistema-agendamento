import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Elemento #root ausente em index.html');
}

createRoot(root).render(
  <StrictMode>
    <main>
      <h1>Navalha &amp; Hora</h1>
      <p>
        Ambiente inicial pronto. A aplicacao completa sera construida nos
        proximos lotes.
      </p>
    </main>
  </StrictMode>,
);
