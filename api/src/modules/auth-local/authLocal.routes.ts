// POST /api/v1/auth/local/registro y /login — SOLO con AUTH_MODE=local (desarrollo y demo).
// En modo Cognito estas rutas no existen: el registro y el login los hace el frontend con Amplify.
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Knex } from 'knex';
import { z } from 'zod';
import type { LocalAuthProvider } from '../../auth/localProvider.js';
import { esquemaPassword } from '../../auth/password.js';
import type { Rol } from '../../auth/tipos.js';
import { AppError } from '../../errors.js';
import { esViolacionUnica, normalizarEmail, type UsuarioFila } from '../usuarios/usuarios.repo.js';

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(1, 'Ingresá tu nombre.').max(100),
  email: z.email('Ingresá un correo electrónico válido.').max(254),
  password: esquemaPassword,
});

const esquemaLogin = z.object({
  email: z.email('Ingresá un correo electrónico válido.').max(254),
  password: z.string().min(1, 'Ingresá tu contraseña.').max(72),
});

// Hash de una contraseña cualquiera: se compara aunque el usuario no exista, para que el tiempo de
// respuesta no revele qué correos están registrados.
const HASH_SEÑUELO = bcrypt.hashSync('señuelo-no-es-una-contraseña', 10);

const credencialesInvalidas = () =>
  new AppError(401, 'CREDENCIALES_INVALIDAS', 'El correo o la contraseña no son correctos.');

export interface OpcionesAuthLocal {
  db: Knex;
  auth: LocalAuthProvider;
  /** Intentos por IP cada 15 minutos (registro + login). */
  limiteIntentos?: number;
}

export function authLocalRouter({ db, auth, limiteIntentos = 20 }: OpcionesAuthLocal): Router {
  const router = Router();

  router.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: limiteIntentos,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, _res, next) =>
        next(
          new AppError(
            429,
            'DEMASIADOS_INTENTOS',
            'Demasiados intentos. Esperá unos minutos y volvé a probar.',
          ),
        ),
    }),
  );

  const respuesta = (usuario: UsuarioFila, rol: Rol) => ({
    token: auth.firmar({
      sub: usuario.cognito_sub,
      email: usuario.email,
      nombre: usuario.nombre,
      rol,
    }),
    usuario: {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol,
      fechaRegistro: usuario.fecha_registro,
    },
  });

  router.post('/registro', async (req, res) => {
    const datos = esquemaRegistro.parse(req.body);
    const email = normalizarEmail(datos.email);
    const passwordHash = await bcrypt.hash(datos.password, 10);

    let usuario: UsuarioFila;
    try {
      usuario = await db.transaction(async (trx) => {
        const [fila] = await trx<UsuarioFila>('usuario')
          .insert({ cognito_sub: randomUUID(), nombre: datos.nombre, email })
          .returning('*');
        await trx('dev_credencial').insert({
          usuario_id: fila!.id,
          password_hash: passwordHash,
          rol: 'user',
        });
        return fila!;
      });
    } catch (error) {
      if (esViolacionUnica(error)) {
        throw new AppError(409, 'EMAIL_EN_USO', 'Ya existe una cuenta con ese correo electrónico.');
      }
      throw error;
    }
    res.status(201).json(respuesta(usuario, 'user'));
  });

  router.post('/login', async (req, res) => {
    const datos = esquemaLogin.parse(req.body);
    const fila = await db('usuario as u')
      .join('dev_credencial as d', 'd.usuario_id', 'u.id')
      .where('u.email', normalizarEmail(datos.email))
      .first<(UsuarioFila & { password_hash: string; rol: Rol }) | undefined>(
        'u.*',
        'd.password_hash',
        'd.rol',
      );

    const valida = await bcrypt.compare(datos.password, fila?.password_hash ?? HASH_SEÑUELO);
    if (!fila || !valida) throw credencialesInvalidas();
    if (!fila.activo) throw new AppError(403, 'USUARIO_INACTIVO', 'Tu cuenta está deshabilitada.');

    res.json(respuesta(fila, fila.rol));
  });

  return router;
}
