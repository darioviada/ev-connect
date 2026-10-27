// Autorización en el backend (SPEC §2 y §9): autenticar → requerirRol → esDuenoOAdmin.
// Nunca se confía en la interfaz: cada ruta protegida declara aquí lo que exige.
import type { Request, RequestHandler } from 'express';
import type { Knex } from 'knex';
import { rolDeGrupos, type AuthProvider, type Rol } from '../auth/tipos.js';
import { AppError } from '../errors.js';
import { asegurarUsuario } from '../modules/usuarios/usuarios.repo.js';

export interface UsuarioAutenticado {
  id: string;
  sub: string;
  email: string;
  nombre: string;
  rol: Rol;
  fechaRegistro: string;
}

export interface DependenciasAuth {
  auth: AuthProvider;
  db: Knex;
}

const noAutenticado = () =>
  new AppError(401, 'NO_AUTENTICADO', 'Tenés que iniciar sesión para hacer esto.');

/**
 * Lee `Authorization: Bearer <token>`. Con `obligatorio: false` deja pasar a los invitados (sin token),
 * pero un token presente e inválido siempre se rechaza. Un usuario deshabilitado recibe 403.
 */
export function autenticar(
  deps: DependenciasAuth,
  { obligatorio }: { obligatorio: boolean },
): RequestHandler {
  return async (req, _res, next) => {
    const encabezado = req.get('authorization');
    if (!encabezado) {
      if (obligatorio) throw noAutenticado();
      next();
      return;
    }

    const [esquema, token, ...resto] = encabezado.trim().split(/\s+/);
    if (esquema?.toLowerCase() !== 'bearer' || !token || resto.length > 0) {
      throw new AppError(
        401,
        'TOKEN_INVALIDO',
        'El encabezado Authorization debe ser "Bearer <token>".',
      );
    }

    let identidad;
    try {
      identidad = await deps.auth.verificar(token);
    } catch {
      throw new AppError(
        401,
        'TOKEN_INVALIDO',
        'La sesión no es válida o venció. Iniciá sesión de nuevo.',
      );
    }

    const usuario = await asegurarUsuario(deps.db, identidad);
    if (!usuario.activo) {
      throw new AppError(403, 'USUARIO_INACTIVO', 'Tu cuenta está deshabilitada.');
    }

    req.usuario = {
      id: usuario.id,
      sub: usuario.cognito_sub,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: rolDeGrupos(identidad.grupos),
      fechaRegistro: usuario.fecha_registro,
    };
    next();
  };
}

/** Exige un rol. Va después de `autenticar({ obligatorio: true })`. */
export function requerirRol(rol: Rol): RequestHandler {
  return (req, _res, next) => {
    if (!req.usuario) throw noAutenticado();
    if (req.usuario.rol !== rol) {
      throw new AppError(403, 'PERMISO_DENEGADO', 'No tenés permiso para hacer esto.');
    }
    next();
  };
}

/**
 * Permite el acceso al dueño del recurso o a un admin.
 * `obtenerDuenoId` devuelve el id del dueño, `null` si el recurso no tiene dueño (p. ej. un cargador público)
 * o `undefined` si el recurso no existe (→ 404).
 */
export function esDuenoOAdmin(
  obtenerDuenoId: (req: Request) => Promise<string | null | undefined>,
): RequestHandler {
  return async (req, _res, next) => {
    if (!req.usuario) throw noAutenticado();
    const dueno = await obtenerDuenoId(req);
    if (dueno === undefined) {
      throw new AppError(404, 'NO_ENCONTRADO', 'El recurso solicitado no existe.');
    }
    if (req.usuario.rol !== 'admin' && dueno !== req.usuario.id) {
      throw new AppError(
        403,
        'PERMISO_DENEGADO',
        'Solo el dueño o un administrador pueden hacer esto.',
      );
    }
    next();
  };
}
