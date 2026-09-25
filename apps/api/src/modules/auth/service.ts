import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

import {
  userDTOSchema,
  type LoginInput,
  type RegisterInput,
  type UserDTO,
} from '@navalha/contracts';
import {
  createClientUser,
  EmailAlreadyExistsError,
  findUserByEmail,
  findUserById,
  updateLastLoginAt,
} from './repository.js';

const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELIZATION = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;

export class InvalidCredentialsError extends Error {}

export async function register(input: RegisterInput): Promise<UserDTO> {
  const passwordHash = await hashPassword(input.password);
  const user = await createClientUser(input, passwordHash);
  return toUserDTO(user);
}

export async function login(input: LoginInput): Promise<UserDTO> {
  const user = await findUserByEmail(input.email);
  if (!user || !user.active || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new InvalidCredentialsError('Invalid email or password.');
  }

  await updateLastLoginAt(user.id);
  return toUserDTO(user);
}

export async function getActiveUser(id: string): Promise<UserDTO | null> {
  const user = await findUserById(id);
  return user?.active ? toUserDTO(user) : null;
}

function toUserDTO(user: {
  id: string;
  name: string;
  email: string;
  role: UserDTO['role'];
}): UserDTO {
  return userDTOSchema.parse({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  });
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_LENGTH);
  const derivedKey = await deriveKey(password, salt);
  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
}

async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const [algorithm, cost, blockSize, parallelization, saltText, keyText, extra] =
    encodedHash.split('$');
  if (
    algorithm !== 'scrypt' ||
    cost !== String(SCRYPT_COST) ||
    blockSize !== String(SCRYPT_BLOCK_SIZE) ||
    parallelization !== String(SCRYPT_PARALLELIZATION) ||
    !saltText ||
    !keyText ||
    extra !== undefined
  ) {
    return false;
  }

  const salt = Buffer.from(saltText, 'base64url');
  const expectedKey = Buffer.from(keyText, 'base64url');
  if (salt.length !== SCRYPT_SALT_LENGTH || expectedKey.length !== SCRYPT_KEY_LENGTH) {
    return false;
  }

  const actualKey = await deriveKey(password, salt);
  return timingSafeEqual(actualKey, expectedKey);
}

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCK_SIZE,
        p: SCRYPT_PARALLELIZATION,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
        } else {
          resolve(derivedKey);
        }
      },
    );
  });
}

export { EmailAlreadyExistsError };