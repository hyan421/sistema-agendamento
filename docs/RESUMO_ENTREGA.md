# Resumo das atualizações para revisão

Esta entrega completa as funcionalidades pendentes do sistema de agendamento:

- Seed de demonstração que preserva contas e dados existentes quando repetido.
- Notificações de confirmação e cancelamento, leitura e lembretes sem duplicação.
- Painel administrativo com métricas calculadas a partir do banco de dados.
- Assistente com ajuda automática e integração opcional com Ollama.
- Catálogo com filtros, gestão de serviços, login, cadastro e navegação por URLs.
- Execução do frontend compilado pela API e ajustes de acessibilidade.
- CI, diagramas UML, instruções de instalação e documentação dos endpoints.

TypeScript, lint, build e testes integrados passaram. A validação incluiu disputa pelo
mesmo horário, acesso restrito por usuário, repetição do seed, notificações e lembretes.
O protocolo Ollama foi testado com servidor simulado; falta validar um modelo real.

A CI no GitHub deve ser conferida após o push. Revisão funcional e aprovação do grupo
continuam pendentes. Há quatro dependências vulneráveis registradas na auditoria anterior.

Consulte o README para executar e `docs/VALIDACAO_MANUAL.md` para evidências e roteiro de revisão.
Nenhuma senha ou arquivo `.env` integra esta entrega.
