// Esquemas zod reutilizables por los módulos de la API (toda entrada se valida).
import type { Request } from 'express';
import type { Knex } from 'knex';
import { z } from 'zod';

export const CONECTORES = ['TIPO_2', 'CCS_COMBO', 'CHADEMO'] as const;
export const DIAS = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

export const esquemaId = z.uuid('Identificador inválido.');

/** Valida un parámetro de ruta con formato uuid (400 si no lo es, antes de tocar la base). */
export const idDe = (req: Request, nombre = 'id') => esquemaId.parse(req.params[nombre]);

export const esquemaLatLng = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** 'HH:MM' (24 h). Se admite '24:00' como fin del día. */
export const esquemaHora = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, 'Hora inválida (formato HH:MM).');

export const esquemaFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (formato AAAA-MM-DD).')
  .refine((f) => {
    const d = new Date(`${f}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(f);
  }, 'Fecha inexistente.');

export const esquemaFranja = z
  .object({ dia: z.enum(DIAS), horaInicio: esquemaHora, horaFin: esquemaHora })
  .refine((f) => f.horaFin > f.horaInicio, {
    message: 'La hora de fin debe ser posterior a la de inicio.',
    path: ['horaFin'],
  });

/** Lista de franjas sin solapamientos dentro del mismo día. Vacía = disponible 24/7. */
export const esquemaFranjas = z
  .array(esquemaFranja)
  .max(50)
  .superRefine((franjas, ctx) => {
    for (const [i, a] of franjas.entries()) {
      for (const b of franjas.slice(i + 1)) {
        if (a.dia === b.dia && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin) {
          ctx.addIssue({
            code: 'custom',
            message: `Las franjas del ${a.dia} se superponen.`,
            path: [i],
          });
        }
      }
    }
  });

export const esquemaPaginacion = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function paginado<T>(items: T[], total: number, p: { limit: number; offset: number }) {
  return { items, paginacion: { limit: p.limit, offset: p.offset, total } };
}

/** Cuenta total de un query antes de aplicarle limit/offset. */
export async function contarTotal(query: Knex.QueryBuilder): Promise<number> {
  const filas = await query.clone().clearSelect().clearOrder().count<{ n: string }[]>({ n: '*' });
  return Number(filas[0]?.n ?? 0);
}

/** 'HH:MM:SS' (como devuelve PostgreSQL) → 'HH:MM'. */
export const hhmm = (hora: string) => hora.slice(0, 5);

/** Patrón "contiene" para ILIKE, escapando los comodines % y _ que escriba el usuario. */
export const patronContiene = (texto: string) => `%${texto.replace(/[\\%_]/g, '\\$&')}%`;
