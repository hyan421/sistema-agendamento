# Demonstração — até 10 minutos

Preparação: migrations, seed, banco ativo, API/frontend funcionando e senha demo disponível localmente.
Use contas separadas em perfis de navegador. Não mostre `.env` nem senhas nos slides/gravação.

| Tempo | Fluxo |
| --- | --- |
| 0–1 min | Apresentar unidade fictícia, equipe, catálogo e filtros |
| 1–3 min | Cliente entra, escolhe serviço/profissional/horário, revisa e confirma |
| 3–4 min | Mostrar reserva persistida e evidência de conflito concorrente |
| 4–6 min | Barbeiro consulta agenda, configura jornada/bloqueio e gerencia serviços |
| 6–7 min | Cliente lê notificação; cancela reserva futura e consulta histórico |
| 7–8 min | Administrador consulta métricas por período |
| 8–9 min | Assistente com modo identificado; sugestão abre fluxo normal de agendamento |
| 9–10 min | Limitações, autorização, persistência e resultados de validação |

Para concluir atendimento, use reserva já encerrada; não mude datas do banco de uso durante a demo.
Lembretes exigem API em execução. Sem modelo Ollama real, apresente ajuda automática e declare H4 parcial.

## Slides de uso de IA — até 5 minutos

1. Ferramenta/modelo efetivamente utilizados e tarefas delegadas.
2. Um exemplo de sugestão revisada e uma correção comprovada pelo grupo.
3. Evidências de typecheck, lint, build, concorrência e isolamento.
4. Limites: testes não substituem revisão; LLM não controla reservas; modelo real depende de execução local.
5. Divisão real de trabalho e participação Git; não atribuir revisão ou commits não realizados.
