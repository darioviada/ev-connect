// Contexto de sesión (sin componentes: el proveedor está en ProveedorSesion.tsx).
import { createContext, useContext } from 'react';
import type { Perfil } from '../api/tipos';

export interface ValorSesion {
  perfil: Perfil | null;
  cargando: boolean;
  modo: 'local' | 'cognito';
  iniciarSesion(email: string, password: string): Promise<void>;
  registrarse(
    nombre: string,
    email: string,
    password: string,
  ): Promise<{ requiereConfirmacion: boolean }>;
  confirmarRegistro(email: string, codigo: string): Promise<void>;
  cerrarSesion(): Promise<void>;
}

export const ContextoSesion = createContext<ValorSesion | null>(null);

export function useSesion(): ValorSesion {
  const valor = useContext(ContextoSesion);
  if (!valor) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  return valor;
}

/** "Continuar como invitado": no se vuelve a mostrar la bienvenida en esta pestaña. */
const CLAVE_INVITADO = 'evconnect.invitado';
export function eligioInvitado(): boolean {
  try {
    return sessionStorage.getItem(CLAVE_INVITADO) === '1';
  } catch {
    return false;
  }
}
export function marcarInvitado() {
  try {
    sessionStorage.setItem(CLAVE_INVITADO, '1');
  } catch {
    // sin almacenamiento: se vuelve a mostrar la bienvenida, no es grave
  }
}
