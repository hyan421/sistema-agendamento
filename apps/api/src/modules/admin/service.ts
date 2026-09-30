import {
  userDTOSchema,
  type RegisterInput,
  type UserDTO,
} from '@navalha/contracts';
import { hashPassword } from '../auth/service.js';
import { createBarberAccount } from './repository.js';

export async function registerBarber(input: RegisterInput): Promise<UserDTO> {
  const passwordHash = await hashPassword(input.password);
  const user = await createBarberAccount(input, passwordHash);
  return userDTOSchema.parse({ ...user, role: 'BARBER' });
}