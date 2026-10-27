// Interfaz única de autenticación del frontend. El resto de la app no sabe si el modo es local o Cognito.
import { config } from '../config';

export interface ServicioAuth {
  readonly modo: 'local' | 'cognito';
  iniciarSesion(email: string, password: string): Promise<void>;
  /** En modo Cognito el registro requiere confirmar un código enviado por correo. */
  registrarse(
    nombre: string,
    email: string,
    password: string,
  ): Promise<{ requiereConfirmacion: boolean }>;
  confirmarRegistro(email: string, codigo: string): Promise<void>;
  cerrarSesion(): Promise<void>;
  /** Token vigente (JWT local o ID token de Cognito) o null si no hay sesión. */
  obtenerToken(): Promise<string | null>;
}

export class ErrorAuth extends Error {
  readonly codigo: string;
  constructor(codigo: string, mensaje: string) {
    super(mensaje);
    this.name = 'ErrorAuth';
    this.codigo = codigo;
  }
}

let instancia: Promise<ServicioAuth> | null = null;

/** Crea el servicio una sola vez. Amplify se carga solo en modo Cognito (import dinámico). */
export function obtenerServicioAuth(): Promise<ServicioAuth> {
  instancia ??=
    config.modoAuth === 'cognito'
      ? import('./cognito').then((m) => m.crearServicioCognito(config.cognito))
      : import('./local').then((m) => m.crearServicioLocal());
  return instancia;
}
