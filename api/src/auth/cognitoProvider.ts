// AUTH_MODE=cognito: verifica el ID token de Amazon Cognito con aws-jwt-verify (firma con las claves
// públicas del User Pool, emisor, audiencia = app client, vencimiento y token_use = "id").
// Se usa el ID token porque trae el email del usuario. El backend no guarda contraseñas.
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { z } from 'zod';
import { TokenInvalidoError, type AuthProvider, type Identidad } from './tipos.js';

/** Lo mínimo que se necesita del verificador (permite reemplazarlo por uno simulado en los tests). */
export interface VerificadorCognito {
  verify(token: string): Promise<Record<string, unknown>>;
}

const esquemaClaims = z.object({
  sub: z.string().min(1),
  email: z.email(),
  name: z.string().optional(),
  'cognito:groups': z.array(z.string()).default([]),
});

export class CognitoAuthProvider implements AuthProvider {
  readonly modo = 'cognito' as const;
  readonly #verificador: VerificadorCognito;

  constructor(verificador: VerificadorCognito) {
    this.#verificador = verificador;
  }

  static desdeConfig(config: { userPoolId: string; clientId: string }): CognitoAuthProvider {
    const verificador = CognitoJwtVerifier.create({
      userPoolId: config.userPoolId,
      tokenUse: 'id',
      clientId: config.clientId,
    });
    return new CognitoAuthProvider({
      verify: async (token) => (await verificador.verify(token)) as Record<string, unknown>,
    });
  }

  async verificar(token: string): Promise<Identidad> {
    let payload: Record<string, unknown>;
    try {
      payload = await this.#verificador.verify(token);
    } catch (error) {
      throw new TokenInvalidoError('ID token de Cognito inválido o vencido', { cause: error });
    }
    const claims = esquemaClaims.safeParse(payload);
    if (!claims.success) {
      throw new TokenInvalidoError('El ID token no trae sub y email válidos');
    }
    return {
      sub: claims.data.sub,
      email: claims.data.email,
      ...(claims.data.name ? { nombre: claims.data.name } : {}),
      grupos: claims.data['cognito:groups'],
    };
  }
}
