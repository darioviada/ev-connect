// Política de contraseñas del informe (igual a la configurada en el User Pool de Cognito):
// mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo. Máximo 72 (límite de bcrypt).
import { z } from 'zod';

export const esquemaPassword = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar los 72 caracteres.')
  .regex(/[A-Z]/, 'La contraseña debe incluir una mayúscula.')
  .regex(/[a-z]/, 'La contraseña debe incluir una minúscula.')
  .regex(/[0-9]/, 'La contraseña debe incluir un número.')
  .regex(/[^A-Za-z0-9]/, 'La contraseña debe incluir un símbolo.');
