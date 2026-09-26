# Navalha & Hora

Plataforma web de agendamento para uma barbearia ficticia.

Equipe: Hyan Carvalhido Ferreira, Fernando De Jesus Teixeira Goncalves Filho e Joao Victor Cerbino Souza.

## O que ja existe neste momento

Este repositorio tem a configuracao inicial e os **lotes 2 a 7** implementados:

- **Lote 2 concluido:** validacao de ambiente, pool PostgreSQL e executor de migrations. O seed de demonstracao ainda esta pendente.
- **Lote 3 concluido:** cadastro e login de clientes, sessoes persistentes em PostgreSQL, logout e hash de senha com `scrypt`.
- **Lote 4 concluido:** catalogo publico de servicos e barbeiros; barbeiros autenticados podem criar, editar e desativar servicos.
- **Lote 5 concluido:** jornada semanal e bloqueios de agenda, com validacao de conflitos e acesso restrito ao barbeiro responsavel.
- **Lote 6 validado:** API calcula disponibilidade na zona da loja e cria reservas com transacao, lock do barbeiro, snapshots e notificacoes de confirmacao. Duas reservas concorrentes foram exercitadas contra PostgreSQL: uma confirmou e a outra recebeu conflito.
- **Lote 7 validado:** clientes consultam proximos agendamentos e historico; clientes e barbeiros autorizados podem cancelar, e o barbeiro consulta a agenda diaria e conclui atendimentos apos o termino. Os fluxos HTTP foram exercitados com sessoes e contas temporarias, removidas ao final.

As migrations `001` a `006` definem usuarios, loja, sessoes, catalogo, agenda, reservas e notificacoes. Typecheck, lint, build e migrations passaram; as constraints de sobreposicao e a unicidade de notificacoes tambem foram verificadas contra PostgreSQL. O seed de demonstracao ainda esta pendente.

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
