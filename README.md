# Navalha & Hora

Plataforma web de agendamento para uma barbearia ficticia.

Equipe: Hyan Carvalhido Ferreira, Fernando De Jesus Teixeira Goncalves Filho e Joao Victor Cerbino Souza.

## O que ja existe neste momento

Este repositorio tem a **configuracao inicial** (lote 1 do guia): workspaces npm, TypeScript, ESLint, Vite, Docker Compose e `.env.example`.

Ainda **nao** ha banco migrado, login, catalogo nem reservas. `npm run db:migrate`, `npm run db:seed` e `npm run start` so passam a funcionar nos lotes seguintes.

## O que voce precisa instalar (uma vez no computador)

Hoje esta maquina ainda **nao** tem Git, Node nem Docker no PATH. Instale nesta ordem:

1. **Git** — [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. **Node.js 24.21.0 LTS** — [https://nodejs.org/dist/v24.21.0/node-v24.21.0-x64.msi](https://nodejs.org/dist/v24.21.0/node-v24.21.0-x64.msi)  
   Na instalacao, deixe marcada a opcao de adicionar ao PATH. Nao instale a linha Current 26.
3. **Docker Desktop** — [https://docs.docker.com/desktop/setup/install/windows-install/](https://docs.docker.com/desktop/setup/install/windows-install/)  
   Depois de instalar, abra o Docker Desktop e espere ficar "Engine running". No Windows use WSL 2 se o instalador pedir.

Feche e abra o Cursor/PowerShell depois de instalar. Confira:

```powershell
node --version
npm --version
git --version
docker compose version
```

`node --version` deve mostrar `v24.21.0`.

Ollama e opcional (so para o assistente com IA no lote 10). Sem ele o resto do projeto continua valido.

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

`npm ci` so funciona depois de existir `package-lock.json` (gerado pelo primeiro `npm install`).

Para ver a pagina placeholder do frontend:

```powershell
npm run dev -w @navalha/web
```

Abra [http://localhost:5173](http://localhost:5173). A API ainda nao sobe neste lote.

Para parar o banco sem apagar dados:

```powershell
docker compose stop
```

Nao use `docker compose down -v` no dia a dia: isso apaga o volume do PostgreSQL.

## Proximo passo de implementacao

Seguir os lotes 2+ em `docs/GUIA_IMPLEMENTACAO.md` (pool, migrations, autenticacao, telas).
