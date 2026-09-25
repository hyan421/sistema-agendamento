import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const passwordSchema = z.string().min(10).max(128);

export const registerSchema = z.strictObject({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
});

export const userRoleSchema = z.enum(['CLIENT', 'BARBER', 'ADMIN']);

export const userDTOSchema = z.strictObject({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  role: userRoleSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type UserDTO = z.infer<typeof userDTOSchema>;