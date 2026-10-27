import { describe, expect, it } from 'vitest';
import { codificarBusqueda, decodificarBusqueda, aPedido } from '../dominio/busqueda';
import { agruparFranjas, fechaCorta, minutos, pesos, sumarDias } from '../dominio/formato';
import { problemasDePassword } from '../dominio/password';
import { autonomiaKm, urgenciaDe } from '../dominio/vehiculo';

describe('urgencia y autonomía (mismas reglas que el motor)', () => {
  it.each([
    [29, 'alta'],
    [30, 'media'],
    [70, 'media'],
    [71, 'baja'],
  ] as const)('%s %% → %s', (pct, urgencia) => {
    expect(urgenciaDe(pct)).toBe(urgencia);
  });

  it('autonomía = capacidad × batería / consumo × 100', () => {
    const e208 = { capacidadBateriaKwh: 50, consumoKwhPor100km: 15.6 };
    expect(Math.round(autonomiaKm(e208))).toBe(321);
    expect(Math.round(autonomiaKm(e208, 45))).toBe(144);
  });
});

describe('formato', () => {
  it('minutos legibles', () => {
    expect(minutos(35.4)).toBe('35 min');
    expect(minutos(120)).toBe('2 h');
    expect(minutos(294)).toBe('4 h 54 min');
  });

  it('fechas relativas', () => {
    expect(fechaCorta('2026-10-27', '2026-10-27')).toBe('Hoy');
    expect(fechaCorta('2026-10-28', '2026-10-27')).toBe('Mañana');
    expect(fechaCorta('2026-09-12', '2026-10-27')).toBe('12/09');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('pesos argentinos sin decimales', () => {
    expect(pesos(2400).replace(/\s/g, ' ')).toMatch(/\$ ?2\.400/);
  });
});

describe('búsqueda en la URL', () => {
  const busqueda = {
    vehiculo: { modeloId: 'abc' },
    bateriaPct: 45,
    modo: 'ruta' as const,
    origen: { lat: -31.42, lng: -64.19 },
    destino: { lat: -31.42, lng: -64.5 },
    origenNombre: 'Güemes',
    destinoNombre: 'Villa Carlos Paz',
  };

  it('ida y vuelta con acentos', () => {
    expect(decodificarBusqueda(codificarBusqueda(busqueda))).toEqual(busqueda);
  });

  it('rechaza parámetros inválidos', () => {
    expect(decodificarBusqueda(null)).toBeNull();
    expect(decodificarBusqueda('basura')).toBeNull();
    expect(decodificarBusqueda(codificarBusqueda({ ...busqueda, destino: undefined }))).toBeNull();
  });

  it('el pedido a la API no incluye los nombres para mostrar', () => {
    expect(aPedido(busqueda)).toEqual({
      vehiculo: { modeloId: 'abc' },
      bateriaPct: 45,
      modo: 'ruta',
      origen: busqueda.origen,
      destino: busqueda.destino,
    });
  });
});

describe('política de contraseñas', () => {
  it('lista lo que falta', () => {
    expect(problemasDePassword('Usuario123!')).toEqual([]);
    expect(problemasDePassword('abc')).toEqual([
      '8 caracteres',
      'una mayúscula',
      'un número',
      'un símbolo',
    ]);
  });
});

describe('agrupar franjas horarias', () => {
  const todos = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const franja = (dia: string, horaInicio = '18:00', horaFin = '23:00') => ({
    dia,
    horaInicio,
    horaFin,
  });

  it('resume los casos comunes', () => {
    expect(agruparFranjas(todos.map((d) => franja(d)))).toEqual([
      { dias: 'Todos los días', horario: '18:00 a 23:00' },
    ]);
    expect(
      agruparFranjas([
        ...todos.slice(0, 5).map((d) => franja(d, '19:00')),
        ...todos.slice(5).map((d) => franja(d, '08:00', '22:00')),
      ]),
    ).toEqual([
      { dias: 'Lunes a viernes', horario: '19:00 a 23:00' },
      { dias: 'Fines de semana', horario: '08:00 a 22:00' },
    ]);
    expect(agruparFranjas([franja('miercoles'), franja('lunes')])).toEqual([
      { dias: 'Lunes, Miércoles', horario: '18:00 a 23:00' },
    ]);
  });
});
