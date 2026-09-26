# Registro de uso de IA

## 26/09/2026 — implementação assistida

Ferramenta: Codex. Identificação exata do modelo não foi confirmada neste registro.
Autor Git autorizado: Hyan Carvalhido Ferreira, hyancf2002@gmail.com.

Tarefas: seed; notificações e lembretes; métricas; assistente fallback/Ollama;
telas de catálogo, gestão de serviços e autenticação; navegação; build; CI; documentação.

Decisões implementadas pelo agente:
- Senha demo por ambiente, sem redefinição silenciosa de contas existentes.
- Locks e unicidade de notificações para impedir lembretes duplicados/cancelados.
- Sugestões estruturadas calculadas pelo backend, sem permitir comandos ou reservas pela LLM.
- Banco descartável para validar concorrência e isolamento sem afetar dados de uso.
- Commits limitados a 100 linhas adicionadas + removidas, incluindo documentos.

Problemas encontrados durante a leitura/implementação:
- README declarava lotes completos apesar de seed e telas faltantes.
- Build não copiava SQL nem servia a SPA; navegação era apenas estado de componente.
- Executor agrupava todas as migrations numa única transação; ajustado para uma por arquivo.
- Contagem de merge e seleção de intervalo de autoria ajustadas nos scripts Git.

Não foi aplicado `npm audit fix --force`: atualizar versões fixadas exige um incremento próprio,
com análise de compatibilidade e respeito ao limite por commit.

Aceite/rejeição humana das sugestões: pendente.
Defeitos encontrados e correções feitas por pessoa do grupo: preencher após revisão.
Revisor que entendeu/aprovou: pendente; agente não se autoaprova.
Não há percentual de código gerado estimado; não foi definido método confiável de medição.
