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

## Executar localmente

Na raiz do projeto (Linux):

```bash
cp -n .env.example .env
# Edite .env: substitua os placeholders antes de continuar.
npm ci
docker compose up -d --wait db
npm run db:migrate
npm run db:seed
npm run dev
```

No PowerShell, copie o arquivo somente se ele não existir: `Copy-Item .env.example .env`.
Use a mesma senha em `POSTGRES_PASSWORD` e `DATABASE_URL` (codifique caracteres especiais na URL).
Configure `SESSION_SECRET` com segredo longo e aleatório e `DEMO_PASSWORD` com 10–128 caracteres.
O `.env` é pessoal e ignorado pelo Git. Nunca publique seus valores.

Abra [localhost:5173](http://localhost:5173). Pare a aplicação com Ctrl+C.
Pare o banco com `docker compose stop`; evite `down -v`, que apaga o volume.

### Contas de demonstração

- Cliente: `cliente@demo.test`
- Barbeiros: `barbeiro1@demo.test` e `barbeiro2@demo.test`
- Administrador: `admin@demo.test`

Todas usam o valor local de `DEMO_PASSWORD` na primeira criação.
Reaplicar seed não troca senhas, papéis, serviços existentes nem jornadas editadas.
O seed exige `ALLOW_DEMO_SEED=true` e recusa produção.

### Versão compilada e verificações

```bash
npm run check
npm run build
# Configure APP_ORIGIN=http://localhost:3001 em .env antes de iniciar.
npm start
```

Abra [localhost:3001](http://localhost:3001). A API serve também o frontend.
Com o banco ativo, `node scripts/validation/run.mjs` testa em banco temporário isolado;
o usuário PostgreSQL precisa de permissão de criar banco (o usuário do Compose já tem).
Veja [validação](docs/VALIDACAO_MANUAL.md), [API](docs/API.md), [demo](docs/DEMO.md) e [uso de IA](docs/USO_IA.md).

Para Ollama, configure `AI_PROVIDER=ollama`, `OLLAMA_BASE_URL` e `OLLAMA_MODEL` com um modelo
já instalado localmente. Falha ou timeout usa ajuda automática identificada. Nenhum modelo é baixado pelo projeto.
Limites de requisições ficam em memória e pressupõem uma única instância da API.
