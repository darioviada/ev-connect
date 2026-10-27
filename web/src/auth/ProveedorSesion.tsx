// Contexto de sesión: perfil del usuario (GET /yo) y acciones de login/registro/logout.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, type ReactNode } from 'react';
import { ApiError, registrarProveedorToken } from '../api/cliente';
import { apiAuth } from '../api/endpoints';
import { config } from '../config';
import { obtenerServicioAuth } from './servicio';
import { ContextoSesion, type ValorSesion } from './Sesion';

registrarProveedorToken(async () => (await obtenerServicioAuth()).obtenerToken());

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const consulta = useQuery({
    queryKey: ['yo'],
    queryFn: async () => {
      const servicio = await obtenerServicioAuth();
      if (!(await servicio.obtenerToken())) return null;
      try {
        return await apiAuth.yo();
      } catch (error) {
        // Token rechazado o usuario deshabilitado: se cierra la sesión local.
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await servicio.cerrarSesion();
          return null;
        }
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const refrescar = useCallback(async () => {
    // Al cambiar de usuario, ningún dato del anterior debe quedar en caché (el catálogo es público).
    queryClient.removeQueries({
      predicate: (q) => !['yo', 'catalogo'].includes(String(q.queryKey[0])),
    });
    await queryClient.refetchQueries({ queryKey: ['yo'] });
  }, [queryClient]);

  const valor = useMemo<ValorSesion>(
    () => ({
      perfil: consulta.data ?? null,
      cargando: consulta.isPending,
      modo: config.modoAuth,
      async iniciarSesion(email, password) {
        await (await obtenerServicioAuth()).iniciarSesion(email, password);
        await refrescar();
      },
      async registrarse(nombre, email, password) {
        const r = await (await obtenerServicioAuth()).registrarse(nombre, email, password);
        if (!r.requiereConfirmacion) await refrescar();
        return r;
      },
      async confirmarRegistro(email, codigo) {
        await (await obtenerServicioAuth()).confirmarRegistro(email, codigo);
      },
      async cerrarSesion() {
        await (await obtenerServicioAuth()).cerrarSesion();
        await refrescar();
      },
    }),
    [consulta.data, consulta.isPending, refrescar],
  );

  return <ContextoSesion.Provider value={valor}>{children}</ContextoSesion.Provider>;
}
