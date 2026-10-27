// Contrato común de autenticación. El resto del código no sabe si el proveedor activo es local o Cognito:
// ambos entregan la misma identidad (claims `sub`, `email`, `cognito:groups`).

export type Rol = 'user' | 'admin';

/** Datos verificados que trae el token. */
export interface Identidad {
  sub: string;
  email: string;
  nombre?: string;
  grupos: string[];
}

export interface AuthProvider {
  readonly modo: 'local' | 'cognito';
  /** Verifica el token y devuelve la identidad, o lanza TokenInvalidoError. */
  verificar(token: string): Promise<Identidad>;
}

export class TokenInvalidoError extends Error {
  constructor(motivo: string, opciones?: { cause?: unknown }) {
    super(motivo, opciones);
    this.name = 'TokenInvalidoError';
  }
}

/** El rol sale de los grupos del token; quien no tiene grupo es `user`. */
export function rolDeGrupos(grupos: readonly string[]): Rol {
  return grupos.includes('admin') ? 'admin' : 'user';
}
