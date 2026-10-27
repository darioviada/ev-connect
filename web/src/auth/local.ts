// AUTH_MODE=local (solo demo): la API emite un JWT que se guarda en localStorage.
import { apiAuth } from '../api/endpoints';
import type { ServicioAuth } from './servicio';

const CLAVE = 'evconnect.token';

/** Lee el vencimiento (exp) del JWT sin verificarlo: la verificación la hace la API. */
function vencido(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function crearServicioLocal(almacen: Storage = localStorage): ServicioAuth {
  return {
    modo: 'local',
    async iniciarSesion(email, password) {
      const { token } = await apiAuth.loginLocal(email, password);
      almacen.setItem(CLAVE, token);
    },
    async registrarse(nombre, email, password) {
      const { token } = await apiAuth.registroLocal(nombre, email, password);
      almacen.setItem(CLAVE, token);
      return { requiereConfirmacion: false };
    },
    async confirmarRegistro() {
      // En modo local no hay confirmación por código.
    },
    async cerrarSesion() {
      almacen.removeItem(CLAVE);
    },
    async obtenerToken() {
      const token = almacen.getItem(CLAVE);
      if (!token) return null;
      if (vencido(token)) {
        almacen.removeItem(CLAVE);
        return null;
      }
      return token;
    },
  };
}
