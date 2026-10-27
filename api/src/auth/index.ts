import type { Config } from '../config/index.js';
import { CognitoAuthProvider } from './cognitoProvider.js';
import { LocalAuthProvider } from './localProvider.js';
import type { AuthProvider } from './tipos.js';

export { CognitoAuthProvider, type VerificadorCognito } from './cognitoProvider.js';
export { LocalAuthProvider } from './localProvider.js';
export { esquemaPassword } from './password.js';
export * from './tipos.js';

/** Elige el proveedor según AUTH_MODE. */
export function crearAuthProvider(config: Pick<Config, 'auth'>): AuthProvider {
  return config.auth.mode === 'local'
    ? new LocalAuthProvider(config.auth.jwtSecret)
    : CognitoAuthProvider.desdeConfig(config.auth);
}
