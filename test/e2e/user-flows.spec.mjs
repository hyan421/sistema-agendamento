import { test, expect } from './fixtures.mjs';

async function login(page, origin, email, password, role = 'CLIENT') {
  await page.goto(`${origin}/entrar`);
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('.topbar-label')).toContainText(role);
}

function bookableDate(offsetDays = 2) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  while (date.getDay() === 0) date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

test('catalog filters services by minimum price and clears filters', async ({ page, app }) => {
  await page.goto(`${app.origin}/`);
  await expect(page.getByRole('heading', { name: 'Catálogo de serviços' })).toBeVisible();
  await page.getByLabel('Preço mínimo (R$)').fill('45');
  await page.getByRole('button', { name: 'Filtrar' }).click();
  await expect(page.locator('.catalog-grid article')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Corte + barba' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Degradê' })).toBeVisible();
  await page.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(page.locator('.catalog-grid article')).toHaveCount(4);
});

test('client can log in, keep an authenticated session and log out', async ({ page, app }) => {
  await login(page, app.origin, 'cliente@demo.test', app.demoPassword);
  await expect(page.getByText('Cliente Demo / CLIENT')).toBeVisible();
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('link', { name: 'Entrar' })).toBeVisible();
});

test('client books a slot and sees barber in appointments and notifications', async ({ page, app }) => {
  await login(page, app.origin, 'cliente@demo.test', app.demoPassword);
  await page.getByLabel('Barbeiro').selectOption({ label: 'Barbeiro Um' });
  await page.getByLabel('Data').fill(bookableDate());
  const slots = page.getByRole('group', { name: 'Escolha um horário' }).getByRole('button');
  await expect(slots.first()).toBeVisible();
  await slots.first().click();
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
  await expect(page.getByText(/Agendamento confirmado para/)).toBeVisible();
  await page.getByRole('button', { name: 'Meus agendamentos' }).click();
  await expect(page.getByText('Barbeiro: Barbeiro Um')).toBeVisible();
  await page.getByRole('button', { name: /Notificações/ }).click();
  await expect(page.getByText('Barbeiro: Barbeiro Um')).toBeVisible();
});

test('admin can create barber accounts while client cannot access admin tools', async ({ page, app }) => {
  await login(page, app.origin, 'cliente@demo.test', app.demoPassword);
  await page.goto(`${app.origin}/admin`);
  await expect(page.getByRole('alert')).toContainText('Sua conta não tem acesso');
  await page.getByRole('button', { name: 'Sair' }).click();

  await login(page, app.origin, 'admin@demo.test', app.demoPassword, 'ADMIN');
  await page.getByRole('button', { name: 'Administração' }).click();
  await page.getByLabel('Nome').fill('Barbeiro E2E');
  await page.getByLabel('E-mail').fill(`barbeiro-e2e-${Date.now()}@demo.test`);
  await page.getByLabel('Senha inicial').fill('Barbeiro-E2E-Senha-2026!');
  await page.getByRole('button', { name: 'Cadastrar barbeiro' }).click();
  await expect(page.getByRole('status')).toContainText('foi cadastrado como barbeiro');
});
