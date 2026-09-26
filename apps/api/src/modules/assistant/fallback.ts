import type { AssistantProvider } from './provider.js';

export const fallback: AssistantProvider = {
  async reply(input, publicContext) {
    const question = input.message.toLocaleLowerCase('pt-BR');
    const help = question.includes('cancel')
      ? 'Você pode cancelar em Meus agendamentos antes do início. Para reagendar, cancele e reserve novamente.'
      : 'Escolha um serviço, um barbeiro e uma data para consultar horários. Os preços e durações estão no catálogo.';
    return `Ajuda automática, sem LLM. ${help}\n${publicContext}`;
  },
};
