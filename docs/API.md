# API local

Prefixo `/api/v1`. JSON com `{data: ...}`; erros com `{error:{code,message,fields?}}`.
Autenticação usa cookie de sessão; requisições mutáveis exigem `Origin` igual a `APP_ORIGIN`.
Envie `Content-Type: application/json` quando houver corpo. Datas exibidas no fuso da loja.

| Endpoint | Acesso e comportamento |
| --- | --- |
| GET /health | Público; 200 se banco responde, 503 caso contrário |
| GET /shop | Público; dados da unidade ou null antes do seed |
| POST /auth/register | Público; name, email, password; cria CLIENT |
| POST /auth/login | Público; email, password; inicia sessão |
| GET /auth/me | Conta ativa da sessão |
| POST /auth/logout | Autenticado; encerra sessão |
| GET /services | Público; category, minPriceCents, maxPriceCents, location |
| GET /barbers | Público; profissionais ativos |
| GET /availability | Público; serviceId, barberId e date |
| POST /appointments | CLIENT; serviceId, barberId, startsAt; 201 ou conflito 409 |
| GET /appointments/mine | CLIENT; scope=upcoming ou history; paginação |
| POST /appointments/:id/cancel | Cliente dono ou barbeiro responsável; antes do início |
| GET /barber/appointments | BARBER; date e paginação; apenas agenda própria |
| POST /barber/appointments/:id/complete | BARBER responsável; após fim |
| GET/POST /barber/services | BARBER; lista completa ou criação |
| PATCH /barber/services/:id | BARBER; campos do serviço e active |
| GET/PUT /barber/weekly-hours | BARBER; substitui intervals da própria jornada |
| GET/POST /barber/blocks | BARBER; filtro from/to ou criação startsAt, endsAt, reason |
| DELETE /barber/blocks/:id | BARBER dono; remove bloqueio |
| GET /notifications | Autenticado; lista própria, meta.total e meta.unread |
| PATCH /notifications/:id/read | Dono; 204, idempotente; 404 para notificação alheia |
| GET /admin/metrics | ADMIN; from/to inclusivos, entre 1 e 366 dias |
| POST /assistant/messages | CLIENT; message, history opcional, serviceId/barberId/date opcionais |

Listas paginadas aceitam page >= 1 e pageSize de 1 a 100 (padrão 20).
Notificações incluem id, kind, message, readAt e createdAt.
Métricas retornam período, timezone, activeUsers, appointments por status e services concluídos.
O período considera starts_at; usuários ativos têm último login no período.

Corpo de mensagem do assistente:

```json
{"message":"Como cancelar?","history":[]}
```

Resposta contém mode (fallback ou ollama), text, serviceSuggestions e slotSuggestions.
Histórico admite até seis mensagens user/assistant, com até 1000 caracteres cada.
Sugestões de horário exigem serviço, barbeiro e data; retornam até três slots calculados pela API.
Limites: login 10/15 min por IP; cadastro 10/h; assistente 10/min por usuário.
O assistente não grava reservas, não executa comandos e não persiste conversas.
