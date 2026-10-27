import type { UsuarioAutenticado } from '../middleware/auth.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Presente si la solicitud trae un token válido (lo completa el middleware `autenticar`). */
    usuario?: UsuarioAutenticado;
  }
}
