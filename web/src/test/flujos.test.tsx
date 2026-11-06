// Flujos completos de la app con la API simulada (fetch reemplazado): búsqueda como invitado,
// redirección de rutas protegidas y login local.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { ProveedorSesion } from '../auth/ProveedorSesion';
import { marcarInvitado } from '../auth/Sesion';

const E208 = {
  id: 'm-e208',
  marca: 'Peugeot',
  modelo: 'e-208',
  capacidadBateriaKwh: 50,
  consumoKwhPor100km: 15.6,
  tipoConector: 'CCS_COMBO',
  potenciaMaxAcKw: 7.4,
  potenciaMaxDcKw: 100,
};

const recomendacion = (id: string, nombre: string, mejor: boolean, score: number) => ({
  cargador: {
    id,
    nombre,
    tipo: 'publico',
    tipoConector: 'CCS_COMBO',
    potenciaKw: 50,
    precioKwh: 650,
    ubicacion: { lat: -31.42, lng: -64.19 },
  },
  metricas: {
    distanciaKm: 1.1,
    viajeMin: 3,
    esperaMin: 0,
    cargaMin: 44,
    totalMin: 47,
    energiaKwh: 33,
    costoEstimado: 21450,
    potenciaEfectivaKw: 45,
    socLlegadaPct: 14,
    objetivoPct: 80,
    horarioCarga: { fecha: '2026-10-28', horaInicio: '10:00', horaFin: '10:44' },
  },
  score,
  desglose: {
    distancia: { valor: 1.1, normalizado: 0, peso: 0.45, aporte: 45 },
    espera: { valor: 0, normalizado: 0, peso: 0.25, aporte: 25 },
    carga: { valor: 44, normalizado: 0, peso: 0.2, aporte: 20 },
    costo: { valor: 21450, normalizado: 1, peso: 0.1, aporte: 0 },
  },
  mejorOpcion: mejor,
  advertencias: [],
});

const RESULTADO = {
  urgencia: 'media',
  autonomiaActualKm: 144.2,
  pesos: { distancia: 0.3, espera: 0.2, carga: 0.25, costo: 0.25 },
  estrategia: 'WSM',
  recomendaciones: [
    recomendacion('c1', 'Playón de carga Centro', true, 82.2),
    recomendacion('c2', 'Casa Martínez', false, 77.3),
  ],
  descartados: [
    {
      cargadorId: 'c3',
      nombre: 'Electrolinera Centro',
      motivo: 'CONECTOR_INCOMPATIBLE',
      detalle: '',
    },
  ],
  sinResultados: null,
  vehiculo: { descripcion: 'Peugeot e-208', ...E208 },
  modo: 'ubicacion',
  origen: { lat: -31.4268, lng: -64.1859 },
  destino: null,
  proveedorRutas: 'offline',
  advertencias: [],
  meta: {
    candidatosEvaluados: 8,
    distanciaPreseleccionKm: 20,
    preseleccionAmpliada: false,
    elementosConsultados: 0,
    elementosDesdeCache: 0,
  },
};

type Manejador = (init: RequestInit | undefined) => { status?: number; body?: unknown };
let rutas: Record<string, Manejador>;
let pedidos: { metodo: string; url: string; body: unknown; auth: string | null }[];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  pedidos = [];
  rutas = {
    'GET /api/v1/vehiculos-modelo': () => ({
      body: { items: [E208], paginacion: { limit: 100, offset: 0, total: 1 } },
    }),
    'GET /api/v1/geocodificar': () => ({
      body: {
        proveedor: 'static',
        resultados: [
          {
            nombre: 'Nueva Córdoba',
            descripcion: 'Nueva Córdoba, Córdoba',
            lat: -31.4268,
            lng: -64.1859,
          },
        ],
      },
    }),
    'POST /api/v1/recomendaciones': () => ({ body: RESULTADO }),
    'GET /api/v1/configuracion': () => ({
      body: { geocodificacion: 'static', proveedorRutas: 'offline', modoAuth: 'local' },
    }),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const ruta = url.split('?')[0]!;
      const metodo = init?.method ?? 'GET';
      const headers = (init?.headers ?? {}) as Record<string, string>;
      pedidos.push({
        metodo,
        url,
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        auth: headers.Authorization ?? null,
      });
      const manejador = rutas[`${metodo} ${ruta}`];
      if (!manejador) {
        return new Response(
          JSON.stringify({ error: { code: 'NO_ENCONTRADO', message: 'no simulado', details: {} } }),
          { status: 404 },
        );
      }
      const r = manejador(init);
      return new Response(JSON.stringify(r.body ?? {}), { status: r.status ?? 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderizar(ruta: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[ruta]}>
        <ProveedorSesion>
          <App />
        </ProveedorSesion>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('primera visita', () => {
  it('sin sesión muestra la bienvenida y permite continuar como invitado', async () => {
    const usuario = userEvent.setup();
    renderizar('/');
    await usuario.click(await screen.findByRole('button', { name: 'Continuar como invitado' }));
    expect(
      await screen.findByRole('heading', { name: '¿Dónde cargamos tu vehículo?' }),
    ).toBeInTheDocument();
  });
});

describe('búsqueda como invitado (HU-006 a HU-009)', () => {
  it('elige vehículo, ubicación por texto y batería, y muestra los recomendados', async () => {
    marcarInvitado();
    const usuario = userEvent.setup();
    renderizar('/');

    // Vehículo del catálogo y sus datos
    const selector = await screen.findByLabelText('Tu vehículo');
    await waitFor(() => expect(selector).toHaveValue('m:m-e208'));
    expect(screen.getByText('~321 km')).toBeInTheDocument();

    // Sin ubicación no busca
    await usuario.click(screen.getByRole('button', { name: 'Buscar cargadores' }));
    expect(await screen.findByText('Indicá tu ubicación.')).toBeInTheDocument();

    // Ubicación por texto: busca solo al confirmar (Enter), sin autocompletar
    await usuario.type(screen.getByLabelText('Ubicación'), 'nueva cordoba{Enter}');
    await usuario.click(await screen.findByRole('button', { name: /Nueva Córdoba/ }));
    expect(pedidos.filter((p) => p.url.startsWith('/api/v1/geocodificar'))).toHaveLength(1);

    await usuario.click(screen.getByRole('button', { name: 'Buscar cargadores' }));

    expect(
      await screen.findByRole('heading', { name: 'Cargadores recomendados' }),
    ).toBeInTheDocument();
    const lista = await screen.findByRole('list', { name: 'Cargadores recomendados' });
    expect(within(lista).getByText('Playón de carga Centro')).toBeInTheDocument();
    expect(within(lista).getByText('Mejor opción')).toBeInTheDocument();
    expect(screen.getByText(/1 cargador descartado/)).toBeInTheDocument();

    const busqueda = pedidos.find((p) => p.url === '/api/v1/recomendaciones')!;
    expect(busqueda.body).toEqual({
      vehiculo: { modeloId: 'm-e208' },
      bateriaPct: 45,
      modo: 'ubicacion',
      origen: { lat: -31.4268, lng: -64.1859 },
    });
    expect(busqueda.auth).toBeNull();
  });

  it('muestra el motivo cuando no hay resultados', async () => {
    rutas['POST /api/v1/recomendaciones'] = () => ({
      body: {
        ...RESULTADO,
        recomendaciones: [],
        sinResultados: {
          codigo: 'SIN_COMPATIBLES',
          mensaje: 'Ninguno es compatible con tu conector.',
        },
      },
    });
    const b = btoa(
      JSON.stringify({
        vehiculo: { modeloId: 'm-e208' },
        bateriaPct: 50,
        modo: 'ubicacion',
        origen: { lat: -31.4, lng: -64.1 },
      }),
    );
    renderizar(`/resultados?b=${b}`);
    expect(await screen.findByText('Ninguno es compatible con tu conector.')).toBeInTheDocument();
  });
});

describe('búsqueda de direcciones', () => {
  it('con la lista fija pide barrio o ciudad y explica cómo marcar una dirección exacta', async () => {
    marcarInvitado();
    const usuario = userEvent.setup();
    rutas['GET /api/v1/geocodificar'] = () => ({
      body: { proveedor: 'static', resultados: [], aviso: null },
    });
    renderizar('/');
    const campo = await screen.findByLabelText('Ubicación');
    await waitFor(() => expect(campo).toHaveAttribute('placeholder', 'Barrio o ciudad'));
    await usuario.type(campo, 'Colón 1234{Enter}');
    expect(
      await screen.findByText(/Para una dirección exacta, marcá el punto en el mapa/),
    ).toBeInTheDocument();
  });

  it('con Nominatim busca direcciones y prioriza el destino cerca del origen', async () => {
    marcarInvitado();
    const usuario = userEvent.setup();
    rutas['GET /api/v1/configuracion'] = () => ({
      body: { geocodificacion: 'nominatim', proveedorRutas: 'offline', modoAuth: 'local' },
    });
    rutas['GET /api/v1/geocodificar'] = () => ({
      body: {
        proveedor: 'nominatim',
        aviso: null,
        resultados: [
          {
            nombre: 'Avenida Colón 1234',
            descripcion: '1234, Avenida Colón, Alberdi, Córdoba',
            lat: -31.41,
            lng: -64.2,
          },
        ],
      },
    });
    renderizar('/');
    const campo = await screen.findByLabelText('Ubicación');
    await waitFor(() =>
      expect(campo).toHaveAttribute('placeholder', 'Calle y número, barrio o ciudad'),
    );

    await usuario.type(campo, 'Colón 1234{Enter}');
    const resultado = await screen.findByRole('button', { name: /Avenida Colón 1234/ });
    expect(screen.getByText(/© colaboradores de OpenStreetMap/)).toBeInTheDocument();
    await usuario.click(resultado);

    // En modo ruta, el destino se busca cerca del origen elegido
    await usuario.click(screen.getByRole('button', { name: 'Ruta' }));
    await usuario.type(screen.getByLabelText('Destino'), 'Carlos Paz{Enter}');
    await waitFor(() => {
      const ultimo = pedidos.filter((x) => x.url.startsWith('/api/v1/geocodificar')).at(-1)!;
      expect(ultimo.url).toContain('cerca=-31.41000,-64.20000');
    });
  });
});

describe('rutas protegidas y login local (HU-001)', () => {
  it('un invitado que entra a /reservas va al login y vuelve después de ingresar', async () => {
    const usuario = userEvent.setup();
    const token = ['e30', btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 })), 'firma'].join(
      '.',
    );
    rutas['POST /api/v1/auth/local/login'] = () => ({ body: { token, usuario: {} } });
    rutas['GET /api/v1/yo'] = () => ({
      body: {
        id: 'u1',
        nombre: 'Usuario Demo',
        email: 'usuario@demo.local',
        rol: 'user',
        fechaRegistro: '2026-10-27',
        modoAuth: 'local',
      },
    });
    rutas['GET /api/v1/mis-reservas'] = () => ({
      body: {
        items: [
          {
            id: 'r1',
            cargador: { id: 'c1', nombre: 'Garage López', direccion: null, tipo: 'privado' },
            fecha: '2026-10-28',
            horaInicio: '09:00',
            horaFin: '10:00',
            estado: 'pendiente',
            puedeCancelar: true,
          },
        ],
        paginacion: { limit: 100, offset: 0, total: 1 },
      },
    });

    renderizar('/reservas');
    expect(await screen.findByRole('tab', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByText(/Modo demo local/)).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Correo electrónico'), 'usuario@demo.local');
    await usuario.type(screen.getByLabelText('Contraseña'), 'Usuario123!');
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));

    expect(await screen.findByRole('heading', { name: 'Mis reservas' })).toBeInTheDocument();
    expect(await screen.findByText('Garage López')).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
    // Los pedidos autenticados llevan el token
    expect(pedidos.find((p) => p.url.startsWith('/api/v1/mis-reservas'))?.auth).toBe(
      `Bearer ${token}`,
    );
  });

  it('credenciales inválidas muestran el error de la API', async () => {
    const usuario = userEvent.setup();
    rutas['POST /api/v1/auth/local/login'] = () => ({
      status: 401,
      body: {
        error: {
          code: 'CREDENCIALES_INVALIDAS',
          message: 'El correo o la contraseña no son correctos.',
          details: {},
        },
      },
    });
    renderizar('/login');
    await usuario.type(await screen.findByLabelText('Correo electrónico'), 'x@y.com');
    await usuario.type(screen.getByLabelText('Contraseña'), 'mala');
    await usuario.click(screen.getByRole('button', { name: 'Continuar' }));
    expect(
      await screen.findByText('El correo o la contraseña no son correctos.'),
    ).toBeInTheDocument();
  });

  it('el registro valida la política de contraseñas antes de enviar', async () => {
    const usuario = userEvent.setup();
    renderizar('/login');
    await usuario.click(await screen.findByRole('tab', { name: 'Registrarme' }));
    await usuario.type(screen.getByLabelText('Contraseña'), 'abc');
    expect(screen.getByText(/Falta: 8 caracteres/)).toBeInTheDocument();
  });
});
