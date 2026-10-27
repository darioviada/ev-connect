// AUTH_MODE=local (solo desarrollo/demo): JWT HS256 firmado por la propia API, con las mismas claims
// que un ID token de Cognito para que el resto del sistema no distinga el modo.
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { TokenInvalidoError, type AuthProvider, type Identidad, type Rol } from './tipos.js';

const EMISOR = 'ev-connect-local';
const AUDIENCIA = 'ev-connect';
const DURACION_SEGUNDOS = 8 * 60 * 60;

const esquemaClaims = z.object({
  sub: z.string().min(1),
  email: z.email(),
  name: z.string().optional(),
  'cognito:groups': z.array(z.string()).default([]),
  token_use: z.literal('id'),
});

export class LocalAuthProvider implements AuthProvider {
  readonly modo = 'local' as const;
  readonly #secreto: string;

  constructor(secreto: string) {
    this.#secreto = secreto;
  }

  async verificar(token: string): Promise<Identidad> {
    let payload: unknown;
    try {
      payload = jwt.verify(token, this.#secreto, {
        algorithms: ['HS256'],
        issuer: EMISOR,
        audience: AUDIENCIA,
      });
    } catch (error) {
      throw new TokenInvalidoError('Token local inválido o vencido', { cause: error });
    }
    const claims = esquemaClaims.safeParse(payload);
    if (!claims.success) throw new TokenInvalidoError('El token no tiene las claims esperadas');
    return {
      sub: claims.data.sub,
      email: claims.data.email,
      ...(claims.data.name ? { nombre: claims.data.name } : {}),
      grupos: claims.data['cognito:groups'],
    };
  }

  /** Emite un token para un usuario que ya validó sus credenciales. */
  firmar(
    datos: { sub: string; email: string; nombre: string; rol: Rol },
    duracionSegundos = DURACION_SEGUNDOS,
  ): string {
    return jwt.sign(
      { email: datos.email, name: datos.nombre, 'cognito:groups': [datos.rol], token_use: 'id' },
      this.#secreto,
      {
        algorithm: 'HS256',
        subject: datos.sub,
        issuer: EMISOR,
        audience: AUDIENCIA,
        expiresIn: duracionSegundos,
      },
    );
  }
}
