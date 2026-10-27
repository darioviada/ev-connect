// Generador del seed (puro, sin base de datos).
import { describe, expect, it } from 'vitest';
import { diaDeLaSemana, hoyEnZona, sumarDias } from '../../seeds/fechas.js';
import { dentroDeDisponibilidad, generarDatos } from '../../seeds/generar.js';

const HOY = '2026-10-27'; // martes

describe('fechas', () => {
  it('suma días y obtiene el día de la semana sin corrimientos', () => {
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
    expect(diaDeLaSemana('2026-10-27')).toBe('martes');
    expect(diaDeLaSemana('2026-11-01')).toBe('domingo');
  });

  it('calcula "hoy" en la zona horaria de negocio', () => {
    // 02:00 UTC del 28 = 23:00 del 27 en Argentina (UTC−3)
    expect(hoyEnZona('America/Argentina/Cordoba', new Date('2026-10-28T02:00:00Z'))).toBe(
      '2026-10-27',
    );
  });
});

describe('generarDatos', () => {
  const datos = generarDatos({ hoy: HOY, incluirUsuariosDemo: true });

  it('es determinista: misma semilla y fecha → mismos datos', () => {
    expect(generarDatos({ hoy: HOY, incluirUsuariosDemo: true })).toEqual(datos);
  });

  it('los cargadores no dependen del modo de autenticación', () => {
    const cognito = generarDatos({ hoy: HOY, incluirUsuariosDemo: false });
    expect(cognito.cargadores).toEqual(datos.cargadores);
    expect(cognito.usuarios.some((u) => u.credencial)).toBe(false);
    expect(cognito.vehiculos).toEqual([]);
  });

  it('incluye al menos 8 modelos con los tres conectores y los modelos pedidos', () => {
    expect(datos.modelos.length).toBeGreaterThanOrEqual(8);
    expect(new Set(datos.modelos.map((m) => m.tipoConector))).toEqual(
      new Set(['TIPO_2', 'CCS_COMBO', 'CHADEMO']),
    );
    const nombres = datos.modelos.map((m) => `${m.marca} ${m.modelo}`);
    expect(nombres).toEqual(
      expect.arrayContaining(['Peugeot e-208', 'BYD Dolphin Mini', 'Renault Kwid E-Tech']),
    );
  });

  it('genera ~60 cargadores: 20 públicos y 40 privados, de 7.4 a 150 kW', () => {
    const publicos = datos.cargadores.filter((c) => c.tipo === 'publico');
    const privados = datos.cargadores.filter((c) => c.tipo === 'privado');
    expect(publicos).toHaveLength(20);
    expect(privados).toHaveLength(40);
    const potencias = datos.cargadores.map((c) => c.potencia);
    expect(Math.min(...potencias)).toBe(7.4);
    expect(Math.max(...potencias)).toBe(150);
    expect(privados.every((c) => c.usuarioId !== null)).toBe(true);
    expect(publicos.every((c) => c.usuarioId === null)).toBe(true);
    expect(datos.cargadores.some((c) => c.tipoConector === 'CHADEMO')).toBe(true);
    expect(datos.cargadores.some((c) => c.estado === 'inactivo')).toBe(true);
  });

  it('cubre Córdoba capital, ambos corredores y otras ciudades', () => {
    const grupos = new Set(datos.cargadores.map((c) => c.zona.grupo));
    expect(grupos).toEqual(
      new Set(['cordoba', 'corredor-carlos-paz', 'corredor-alta-gracia', 'otras-ciudades']),
    );
    expect(datos.cargadores.filter((c) => c.zona.grupo === 'cordoba').length).toBeGreaterThan(40);
  });

  it('rotula direcciones como de ejemplo y los ids son únicos', () => {
    expect(datos.cargadores.every((c) => c.direccion.includes('(dirección de ejemplo)'))).toBe(
      true,
    );
    const ids = datos.cargadores.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('los nombres de cargadores no se repiten', () => {
    const nombres = datos.cargadores.map((c) => c.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it('las reservas respetan la disponibilidad del cargador y no se solapan', () => {
    const porId = new Map(datos.cargadores.map((c) => [c.id, c]));
    const activas = datos.reservas.filter((r) => r.estado !== 'cancelada');
    for (const r of datos.reservas) {
      const c = porId.get(r.cargadorId)!;
      expect(
        dentroDeDisponibilidad(c.franjas, diaDeLaSemana(r.fecha), r.horaInicio, r.horaFin),
      ).toBe(true);
      expect(c.estado).toBe('activo');
      expect(r.usuarioId).not.toBe(c.usuarioId); // nadie reserva su propio cargador
    }
    for (const a of activas) {
      for (const b of activas) {
        if (a === b || a.cargadorId !== b.cargadorId || a.fecha !== b.fecha) continue;
        expect(a.horaInicio < b.horaFin && b.horaInicio < a.horaFin).toBe(false);
      }
    }
  });

  it('el usuario de demostración tiene una reserva de cada estado y un vehículo', () => {
    const usuario = datos.usuarios.find((u) => u.email === 'usuario@demo.local')!;
    const estados = datos.reservas.filter((r) => r.usuarioId === usuario.id).map((r) => r.estado);
    expect(estados.sort()).toEqual(['cancelada', 'confirmada', 'pendiente']);
    expect(datos.vehiculos.filter((v) => v.usuarioId === usuario.id)).toHaveLength(1);
  });
});
