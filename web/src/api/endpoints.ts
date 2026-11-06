// Una función por endpoint de la API (docs/SPEC.md §8 y docs/DECISIONES.md D-028).
import { api } from './cliente';
import type {
  Cargador,
  CargadorDetalle,
  DatosVehiculo,
  Franja,
  LatLng,
  Lugar,
  MiCargador,
  ModeloVehiculo,
  Paginado,
  PedidoRecomendacion,
  Perfil,
  Reserva,
  ResultadoRecomendacion,
  Rol,
  RutaGuardada,
  UsuarioAdmin,
  VehiculoUsuario,
} from './tipos';

type SesionLocal = { token: string; usuario: Omit<Perfil, 'modoAuth'> };

export const apiAuth = {
  loginLocal: (email: string, password: string) =>
    api<SesionLocal>('/auth/local/login', {
      method: 'POST',
      body: { email, password },
      token: null,
    }),
  registroLocal: (nombre: string, email: string, password: string) =>
    api<SesionLocal>('/auth/local/registro', {
      method: 'POST',
      body: { nombre, email, password },
      token: null,
    }),
  yo: () => api<Perfil>('/yo'),
};

export const apiVehiculos = {
  catalogo: () => api<Paginado<ModeloVehiculo>>('/vehiculos-modelo?limit=100'),
  mios: () => api<{ items: VehiculoUsuario[] }>('/mis-vehiculos'),
  crear: (cuerpo: { modeloId: string } | { personalizado: DatosVehiculo }) =>
    api<VehiculoUsuario>('/mis-vehiculos', { method: 'POST', body: cuerpo }),
  editar: (id: string, cuerpo: { modeloId: string } | { personalizado: DatosVehiculo }) =>
    api<VehiculoUsuario>(`/mis-vehiculos/${id}`, { method: 'PUT', body: cuerpo }),
  eliminar: (id: string) => api<void>(`/mis-vehiculos/${id}`, { method: 'DELETE' }),
};

export interface DatosCargador {
  nombre: string;
  direccion?: string | null;
  ubicacion: LatLng;
  tipoConector: string;
  potenciaKw: number;
  precioKwh: number;
}

export const apiCargadores = {
  detalle: (id: string) => api<CargadorDetalle>(`/cargadores/${id}`),
  red: () => api<{ items: Cargador[]; truncado: boolean }>('/cargadores'),
  mios: () => api<{ items: MiCargador[] }>('/mis-cargadores'),
  publicar: (datos: DatosCargador & { disponibilidad: Franja[]; tipo?: 'publico' | 'privado' }) =>
    api<Cargador>('/cargadores', { method: 'POST', body: datos }),
  editar: (id: string, datos: Partial<DatosCargador> & { estado?: 'activo' | 'inactivo' }) =>
    api<Cargador>(`/cargadores/${id}`, { method: 'PUT', body: datos }),
  disponibilidad: (id: string, franjas: Franja[]) =>
    api<Cargador>(`/cargadores/${id}/disponibilidad`, { method: 'PUT', body: { franjas } }),
  eliminar: (id: string) => api<void>(`/cargadores/${id}`, { method: 'DELETE' }),
  moderar: (id: string, estado: 'activo' | 'inactivo') =>
    api<Cargador>(`/admin/cargadores/${id}`, { method: 'PATCH', body: { estado } }),
};

export const apiRecomendaciones = {
  buscar: (pedido: PedidoRecomendacion) =>
    api<ResultadoRecomendacion>('/recomendaciones', { method: 'POST', body: pedido }),
};

export const apiReservas = {
  crear: (datos: { cargadorId: string; fecha: string; horaInicio: string; horaFin: string }) =>
    api<Reserva>('/reservas', { method: 'POST', body: datos }),
  mias: () => api<Paginado<Reserva>>('/mis-reservas?limit=100'),
  recibidas: () => api<Paginado<Reserva>>('/mis-cargadores/reservas?limit=100'),
  cancelar: (id: string) => api<Reserva>(`/reservas/${id}/cancelar`, { method: 'PATCH' }),
  aceptar: (id: string) => api<Reserva>(`/reservas/${id}/aceptar`, { method: 'PATCH' }),
  rechazar: (id: string) => api<Reserva>(`/reservas/${id}/rechazar`, { method: 'PATCH' }),
};

export const apiFavoritos = {
  listar: () => api<{ items: Cargador[] }>('/favoritos'),
  agregar: (cargadorId: string) =>
    api<{ favorito: true }>('/favoritos', { method: 'POST', body: { cargadorId } }),
  quitar: (cargadorId: string) => api<void>(`/favoritos/${cargadorId}`, { method: 'DELETE' }),
  rutas: () => api<{ items: RutaGuardada[] }>('/rutas-guardadas'),
  guardarRuta: (datos: Omit<RutaGuardada, 'id'>) =>
    api<RutaGuardada>('/rutas-guardadas', { method: 'POST', body: datos }),
  borrarRuta: (id: string) => api<void>(`/rutas-guardadas/${id}`, { method: 'DELETE' }),
};

export const apiGeocodificar = (q: string, cerca?: LatLng | null) =>
  api<{ proveedor: string; resultados: Lugar[]; aviso: string | null }>(
    `/geocodificar?q=${encodeURIComponent(q)}${cerca ? `&cerca=${cerca.lat.toFixed(5)},${cerca.lng.toFixed(5)}` : ''}`,
  );

/** Datos públicos para adaptar la interfaz (proveedores activos). */
export const apiConfiguracion = () =>
  api<{ geocodificacion: 'static' | 'nominatim'; proveedorRutas: string; modoAuth: string }>(
    '/configuracion',
    { token: null },
  );

export const apiAdmin = {
  usuarios: (q = '') =>
    api<Paginado<UsuarioAdmin>>(
      `/admin/usuarios?limit=100${q ? `&q=${encodeURIComponent(q)}` : ''}`,
    ),
  editarUsuario: (id: string, cambios: { activo?: boolean; rol?: Rol }) =>
    api<UsuarioAdmin>(`/admin/usuarios/${id}`, { method: 'PATCH', body: cambios }),
  crearModelo: (datos: DatosVehiculo) =>
    api<ModeloVehiculo>('/admin/vehiculos-modelo', { method: 'POST', body: datos }),
  eliminarModelo: (id: string) => api<void>(`/admin/vehiculos-modelo/${id}`, { method: 'DELETE' }),
  /** Foto del modelo (D-047): JPEG, PNG o WebP de hasta 2 MB; crédito y fuente opcionales. */
  subirFotoModelo: (id: string, archivo: File, credito?: string, fuenteUrl?: string) => {
    const q = new URLSearchParams();
    if (credito) q.set('credito', credito);
    if (fuenteUrl) q.set('fuenteUrl', fuenteUrl);
    const sufijo = q.size > 0 ? `?${q.toString()}` : '';
    return api<ModeloVehiculo>(`/admin/vehiculos-modelo/${id}/foto${sufijo}`, {
      method: 'PUT',
      archivo,
    });
  },
  eliminarFotoModelo: (id: string) =>
    api<void>(`/admin/vehiculos-modelo/${id}/foto`, { method: 'DELETE' }),
};
