# Navalha & Hora

Plataforma web de agendamento para uma barbearia ficticia.

Equipe: Hyan Carvalhido Ferreira, Fernando De Jesus Teixeira Goncalves Filho e Joao Victor Cerbino Souza.

## Estado da implementação

Lotes 1 a 10 implementados; CI e documentação do lote 11 preparados.
A aprovação humana e a demonstração com modelo Ollama real continuam pendentes.

| História | Implementação |
| --- | --- |
| H1 — Conta de cliente | Cadastro, login, sessão PostgreSQL e logout |
| H2 — Catálogo | Filtros por categoria, preço e cidade/bairro em URL |
| H3 — Reserva | Disponibilidade, confirmação transacional, histórico e cancelamento |
| H4 — Assistente | Fallback e adaptador Ollama; modelo real ainda não validado |
| H5 — Serviços | Barbeiro cria, edita, ativa e desativa pelo frontend |
| H6 — Agenda | Jornada semanal, bloqueios e proteção de reservas existentes |
| H7 — Notificações | Confirmação, cancelamento, leitura e lembrete idempotente |
| H8 — Métricas | Painel ADMIN com período, fuso, status e serviços concluídos |

Stack: TypeScript, React/Vite, Express 5, PostgreSQL 17 e npm workspaces.
Responsabilidades propostas pelo guia: Hyan — integração, contratos e IA;
Fernando — banco, autenticação e API; Joao Victor — telas e experiência.
Revisão e aprovação de cada incremento devem ser registradas por uma pessoa do grupo.

## Dependências do computador

- Git e Node.js **24.21.0**, conforme `.nvmrc` (npm incluído).
- Linux: Docker Engine e plugin Compose v2. Windows/macOS: Docker Desktop.
- PostgreSQL **17.11** é baixado pelo Compose; não requer instalação separada.
- Ollama é opcional. O modo padrão é `AI_PROVIDER=fallback`.

Confira `node --version`, `npm --version` e `docker compose version`.
No Linux, use `sudo docker ...` quando seu usuário não tiver acesso ao Docker.
As bibliotecas do projeto são instaladas localmente com `npm ci`.

## Como preparar o ambiente do projeto

Na pasta `C:\Users\Fernando\sistema-agendamento`:

```powershell
Copy-Item .env.example .env
```

Abra o arquivo `.env` e troque **somente** estes tres valores (nao deixe o texto `SUBSTITUIR`):

- `POSTGRES_PASSWORD` — senha do banco local. Use a **mesma** senha em `DATABASE_URL` (no lugar de `SUBSTITUIR_LOCALMENTE` depois de `navalha:`).
- `SESSION_SECRET` — um texto longo aleatorio (pode ser uma frase sua + numeros).
- `DEMO_PASSWORD` — senha forte das contas de demonstracao (minimo 10 caracteres). Sera usada no seed, quando existir.

Nao envie o `.env` para o Git. O `.env.example` e so o modelo.

Depois, com o Docker Desktop aberto:

```powershell
npm install
docker compose up -d --wait db
```

Aplique as migrations depois que o banco estiver saudavel:

```powershell
npm run db:migrate
```

O comando e seguro para repetir: migrations ja aplicadas nao sao executadas novamente.

`npm ci` so funciona depois de existir `package-lock.json` (gerado pelo primeiro `npm install`).

Para iniciar a API e o frontend depois de aplicar as migrations:

```powershell
npm run dev
```

Abra [http://localhost:5173](http://localhost:5173). O Vite encaminha as chamadas `/api` para a API local.

Para parar o banco sem apagar dados:

```powershell
docker compose stop
```

Nao use `docker compose down -v` no dia a dia: isso apaga o volume do PostgreSQL.

## Proximo passo de implementacao

Completar o seed de demonstracao e implementar consulta/leitura de notificacoes e o job de lembretes do lote 8, seguindo `docs/GUIA_IMPLEMENTACAO.md`.
