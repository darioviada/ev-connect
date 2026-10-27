import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { AppError } from '../errors.js';

function responderError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details: Record<string, unknown> = {},
) {
  res.status(status).json({ error: { code, message, details } });
}

export const noEncontrado: RequestHandler = (_req, res) => {
  responderError(res, 404, 'NO_ENCONTRADO', 'El recurso solicitado no existe.');
};

export function manejadorErrores(logger: Logger): ErrorRequestHandler {
  return (err: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    if (err instanceof AppError) {
      responderError(res, err.status, err.code, err.message, err.details);
      return;
    }

    if (err instanceof ZodError) {
      responderError(res, 400, 'VALIDACION', 'Los datos enviados no son válidos.', {
        problemas: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }

    // Errores del parser de JSON de Express (body-parser).
    const tipo = (err as { type?: unknown } | null)?.type;
    if (tipo === 'entity.parse.failed') {
      responderError(res, 400, 'JSON_INVALIDO', 'El cuerpo de la solicitud no es JSON válido.');
      return;
    }
    if (tipo === 'entity.too.large') {
      responderError(
        res,
        413,
        'CUERPO_DEMASIADO_GRANDE',
        'El cuerpo de la solicitud es demasiado grande.',
      );
      return;
    }

    logger.error({ err }, 'Error no controlado');
    responderError(res, 500, 'ERROR_INTERNO', 'Ocurrió un error inesperado.');
  };
}
