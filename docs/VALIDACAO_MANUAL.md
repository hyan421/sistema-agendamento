# Validação dos lotes finais — 26/09/2026

## Executado neste computador

- Ubuntu, Node 24.21.0, npm 11.19.0 e PostgreSQL 17.11 via Compose.
- `npm run check`: TypeScript e ESLint passaram.
- `npm run build`: contratos, API, cópia das migrations SQL e frontend passaram.
- Migrations 001–006 aplicadas no banco local; seed executado duas vezes.
- `node scripts/validation/run.mjs` passou usando banco temporário criado e removido pelo teste.
- Seed preservou IDs e hashes; quatro contas e 24 intervalos semanais após repetição.
- Reserva concorrente: respostas 201 e 409, uma única reserva.
- Barbeiro alheio recebeu 404 ao cancelar reserva e ler notificação do cliente.
- Notificações sem sessão: 401; métricas por cliente: 403.
- Marcar como lida duas vezes: 204; contador de não lidas foi a zero.
- Job repetido criou exatamente dois lembretes (cliente/barbeiro).
- Reserva cancelada não recebeu novo lembrete após nova execução do job.
- Métricas refletiram cancelamento e quatro contas com login; período invertido retornou 400.
- Assistente fallback identificou ausência de LLM e rejeitou histórico com papel system.
- `node scripts/validation/assistant.mjs` passou: protocolo Ollama e fallback após HTTP 503, com servidor simulado.
- Build serviu HTML para início, meus-agendamentos e admin; API desconhecida retornou 404 JSON.
- Catálogo no navegador: quatro serviços, dados demo e filtro por local inexistente com estado vazio.
- Catálogo/reserva inspecionados em 360 px e desktop; reserva sem transbordamento horizontal em 360 px.

O teste integrado usa dados descartáveis. A alteração de data para simular lembretes ocorre somente
nesse banco temporário, nunca nas reservas do banco de uso. O usuário precisa de CREATEDB.

## Roteiro de revisão humana

1. Execute migrations e seed; entre com cada conta descrita no README.
2. Cadastre outro cliente, teste e-mail repetido, senha inválida, refresh e logout.
3. Combine categoria/preço/localização; teste filtro sem resultado e voltar/avançar do navegador.
4. Escolha serviço, barbeiro e horário; revise, autentique e confirme. Reinicie a API e confira persistência.
5. Reserve simultaneamente em duas sessões: uma confirmação e um conflito com atualização dos horários.
6. Confira 45 minutos antes do almoço: 11:15 permitido, 11:30 e 12:00 não permitidos.
7. Edite jornada/bloqueios conflitantes com reserva futura: espere 409 e estado anterior preservado.
8. Cancele como dono; confirme liberação do horário. Tente acesso com outra conta.
9. Edite preço/duração e desative serviço: reservas antigas preservam snapshots; novas não usam inativos.
10. Confira confirmação/cancelamento e marcação de leitura; foque a janela para atualizar o contador.
11. Como administrador, confira período vazio (zeros) e compare contagens com SQL.
12. Configure um modelo Ollama local real; confira modo ollama, sugestões e falha com fallback.
13. Use teclado e navegador em outro fuso; confira horários de São Paulo em todos os fluxos.
14. Teste telas autenticadas em 360 px, falhas de rede, retry, estados vazios e envio desabilitado.
15. Valide CI após publicação e renderização dos dois diagramas Mermaid no GitHub.

## Limites das evidências

- Revisão humana, aprovação e compreensão do código não são comprovadas pelo agente.
- Modelo Ollama real não foi instalado nem executado; não declarar a demonstração de H4 concluída.
- Protocolo Ollama pode ser testado com `node scripts/validation/assistant.mjs`; é uma simulação local.
- A inspeção visual realizada não cobre todas as telas autenticadas, leitores de tela ou navegadores.
- CI foi escrita, mas ainda não executou no GitHub; não houve push.
- `npm audit` anterior apontou quatro dependências vulneráveis; versões não foram atualizadas neste incremento.
