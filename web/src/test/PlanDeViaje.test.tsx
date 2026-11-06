// Plan de viaje (D-045) y aviso de viaje no posible.
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { ParadaPlan, Recomendacion, ResultadoRecomendacion } from '../api/tipos';
import { SinResultados } from '../components/Resultados/InfoBusqueda';
import { PlanDeViaje } from '../components/Resultados/PlanDeViaje';
import type { Busqueda } from '../dominio/busqueda';

const parada = (id: string, nombre: string, km: number, extra: Partial<ParadaPlan> = {}) =>
  ({
    cargador: {
      id,
      nombre,
      tipo: 'publico',
      tipoConector: 'CCS_COMBO',
      potenciaKw: 100,
      precioKwh: 700,
      ubicacion: { lat: -32, lng: -63 },
    },
    kmEnRuta: km,
    tramoKm: 180,
    tramoEstimado: km > 0,
    socLlegadaPct: 15,
    objetivoPct: 85,
    energiaKwh: 40,
    cargaMin: 27,
    esperaMin: 0,
    esperaPorHorario: false,
    esperaPorReserva: false,
    costoEstimado: 28000,
    potenciaEfectivaKw: 90,
    horarioCarga: { fecha: '2026-11-06', horaInicio: '10:00', horaFin: '10:27' },
    ...extra,
  }) as ParadaPlan;

const busqueda = {
  vehiculo: { modeloId: 'x' },
  bateriaPct: 80,
  modo: 'ruta',
  origen: { lat: -31.42, lng: -64.19 },
  origenNombre: 'Córdoba',
  destino: { lat: -34.6, lng: -58.38 },
  destinoNombre: 'Buenos Aires',
} as Busqueda;

describe('PlanDeViaje', () => {
  it('muestra las paradas en orden, cuánto cargar en cada una y la llegada', () => {
    const rec = {
      cargador: parada('a', 'Electrolinera Villa María', 181).cargador,
      mejorOpcion: true,
      plan: {
        factible: true,
        paradas: [
          parada('a', 'Electrolinera Villa María', 181),
          parada('b', 'Playón San Nicolás', 470, { socLlegadaPct: 18, objetivoPct: 97 }),
        ],
        llegada: { tramoKm: 230, socPct: 19, fecha: '2026-11-06', hora: '18:40' },
        totales: {
          distanciaKm: 700,
          viajeMin: 540,
          esperaMin: 0,
          cargaMin: 54,
          totalMin: 594,
          energiaKwh: 80,
          costoEstimado: 56000,
        },
        problema: null,
      },
    } as unknown as Recomendacion;

    render(
      <MemoryRouter>
        <PlanDeViaje rec={rec} busqueda={busqueda} enlace={(id) => `/cargadores/${id}`} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Plan de viaje con la mejor opción' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/2 paradas · 9 h 54 min en total/)).toBeInTheDocument();
    const enlaces = screen.getAllByRole('link');
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual(['/cargadores/a', '/cargadores/b']);
    expect(screen.getByRole('link', { name: /Parada 2: Playón San Nicolás/ })).toBeInTheDocument();
    expect(screen.getByText(/Llegás con 18 % y cargás hasta 97 %/)).toBeInTheDocument();
    expect(screen.getByText('Llegada: Buenos Aires')).toBeInTheDocument();
    expect(screen.getByText(/Llegás con 19 %/)).toBeInTheDocument();
  });

  it('no muestra nada si la recomendación no tiene plan', () => {
    const { container } = render(
      <MemoryRouter>
        <PlanDeViaje
          rec={{ mejorOpcion: true } as Recomendacion}
          busqueda={busqueda}
          enlace={(id) => id}
        />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('SinResultados', () => {
  it('con VIAJE_NO_POSIBLE avisa que el viaje no es posible y explica dónde se corta', () => {
    const r = {
      sinResultados: {
        codigo: 'VIAJE_NO_POSIBLE',
        mensaje:
          'No es posible completar este viaje con el vehículo elegido. Desde X (km 40 de 630)…',
      },
    } as ResultadoRecomendacion;
    render(
      <MemoryRouter>
        <SinResultados r={r} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Este viaje no es posible con tu vehículo' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/km 40 de 630/)).toBeInTheDocument();
  });
});
