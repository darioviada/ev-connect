// Consultas compartidas (TanStack Query). Las claves agrupan los datos para invalidarlos juntos.
import { useQuery } from '@tanstack/react-query';
import { apiFavoritos, apiRecomendaciones, apiVehiculos } from '../api/endpoints';
import { useSesion } from '../auth/Sesion';
import { aPedido, type Busqueda } from '../dominio/busqueda';

export function useCatalogo() {
  return useQuery({
    queryKey: ['catalogo'],
    queryFn: async () => (await apiVehiculos.catalogo()).items,
    staleTime: 30 * 60 * 1000,
  });
}

export function useMisVehiculos() {
  const { perfil } = useSesion();
  return useQuery({
    queryKey: ['mis-vehiculos'],
    queryFn: async () => (await apiVehiculos.mios()).items,
    enabled: Boolean(perfil),
  });
}

export function useRutasGuardadas() {
  const { perfil } = useSesion();
  return useQuery({
    queryKey: ['rutas-guardadas'],
    queryFn: async () => (await apiFavoritos.rutas()).items,
    enabled: Boolean(perfil),
  });
}

export function useFavoritos() {
  const { perfil } = useSesion();
  return useQuery({
    queryKey: ['favoritos'],
    queryFn: async () => (await apiFavoritos.listar()).items,
    enabled: Boolean(perfil),
  });
}

/** Resultado de una búsqueda: se conserva en caché al ir al detalle y volver. */
export function useRecomendaciones(busqueda: Busqueda | null) {
  return useQuery({
    queryKey: ['recomendaciones', busqueda && aPedido(busqueda)],
    queryFn: () => apiRecomendaciones.buscar(aPedido(busqueda!)),
    enabled: Boolean(busqueda),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
