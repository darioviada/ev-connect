// Cliente HTTP de la API: agrega el token de sesión y traduce los errores al formato
// { error: { code, message, details } } de la API.
import { config } from '../config';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Lo registra el módulo de sesión: devuelve el token vigente o null. */
let proveedorToken: () => Promise<string | null> = async () => null;
export function registrarProveedorToken(fn: () => Promise<string | null>) {
  proveedorToken = fn;
}

export async function api<T>(
  ruta: string,
  opciones: {
    method?: string;
    body?: unknown;
    /** Archivo enviado tal cual (p. ej. una imagen), con su tipo como Content-Type. */
    archivo?: Blob;
    token?: string | null;
  } = {},
): Promise<T> {
  const token = opciones.token !== undefined ? opciones.token : await proveedorToken();
  const cuerpo: { body?: BodyInit; tipo?: string } = opciones.archivo
    ? { body: opciones.archivo, tipo: opciones.archivo.type }
    : opciones.body !== undefined
      ? { body: JSON.stringify(opciones.body), tipo: 'application/json' }
      : {};
  let respuesta: Response;
  try {
    respuesta = await fetch(`${config.apiUrl}${ruta}`, {
      method: opciones.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(cuerpo.tipo ? { 'Content-Type': cuerpo.tipo } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(cuerpo.body !== undefined ? { body: cuerpo.body } : {}),
    });
  } catch {
    throw new ApiError(
      0,
      'SIN_CONEXION',
      'No se pudo conectar con el servidor. Revisá tu conexión.',
    );
  }

  if (respuesta.status === 204) return undefined as T;
  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const e = datos?.error;
    throw new ApiError(
      respuesta.status,
      e?.code ?? 'ERROR',
      e?.message ?? 'Ocurrió un error inesperado.',
      e?.details ?? {},
    );
  }
  return datos as T;
}

/** Mensaje legible de un error de la API (incluye el primer problema de validación). */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) {
    const problemas = error.details.problemas as { mensaje: string }[] | undefined;
    return problemas?.[0] ? `${error.message} ${problemas[0].mensaje}` : error.message;
  }
  return 'Ocurrió un error inesperado.';
}
