import type { AssistantInput } from '@navalha/contracts';

export interface AssistantProvider {
  reply(input: AssistantInput, publicContext: string): Promise<string>;
}
