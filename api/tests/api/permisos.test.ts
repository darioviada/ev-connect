// Matriz de permisos de SPEC §2 sobre los endpoints reales: invitado / user / admin.
// "Permitido" = el middleware deja pasar (cualquier respuesta distinta de 401/403 por autorización).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cliente, prepararContextoApi, tokenSeed, type ContextoApi } from './contexto.js';

let ctx: ContextoApi;
beforeAll(async () => {
  ctx = await prepararContextoApi();
});
afterAll(async () => {
  await ctx?.db.destroy();
});

type Esperado = 'permitido' | 401 | 403;
interface Caso {
  ruta: string;
  hacer: (c: ReturnType<typeof cliente>) => Promise<{ status: number }>;
  invitado: Esperado;
  user: Esperado;
  admin: Esperado;
}

const idInexistente = randomUUID();
const busqueda = {
  vehiculo: {
    personalizado: {
      marca: 'X',
      modelo: 'Y',
      capacidadBateriaKwh: 50,
      consumoKwhPor100km: 16,
      tipoConector: 'TIPO_2',
      potenciaMaxAcKw: 11,
      potenciaMaxDcKw: null,
    },
  },
  bateriaPct: 50,
  modo: 'ubicacion',
  origen: { lat: -31.4201, lng: -64.1888 },
};

const CASOS: Caso[] = [
  // Públicos (invitado incluido)
  {
    ruta: 'GET /vehiculos-modelo',
    hacer: (c) => c.get('/vehiculos-modelo'),
    invitado: 'permitido',
    user: 'permitido',
    admin: 'permitido',
  },
  {
    ruta: 'GET /cargadores',
    hacer: (c) => c.get('/cargadores'),
    invitado: 'permitido',
    user: 'permitido',
    admin: 'permitido',
  },
  {
    ruta: 'POST /recomendaciones',
    hacer: (c) => c.post('/recomendaciones', busqueda),
    invitado: 'permitido',
    user: 'permitido',
    admin: 'permitido',
  },
  {
    ruta: 'GET /geocodificar',
    hacer: (c) => c.get('/geocodificar?q=centro'),
    invitado: 'permitido',
    user: 'permitido',
    admin: 'permitido',
  },
  // Con sesión (user y admin)
  {
    ruta: 'GET /yo',
    hacer: (c) => c.get('/yo'),
    invitado: 401,
    user: 'permitido',
    admin: 'permitido',
  },
  {
    ruta: 'GET /mis-vehiculos',
    hacer: (c) => c.get('/mis-vehiculos'),
    invitado: 401,
    user: 'permitido',
    admin: 'permitido',
  },
  {
    ruta: 'POST /mis-vehiculos',
    hacer: (c) => c.post('/mis-vehiculos', {}),
    invitado: 401,
    user: 'permitido',
    admin: 'permitido',
  },
  {
    ruta: 'POST /reservas',
    hacer: (c) => c.post('/reservas', {}),
    invitado: 401,
    user: 'permitido',
    admin: 'permitido',
  },
  {
    ruta: 'GET /mis-reservas',
    hacer: (c) => c.get('/mis-reservas'),
    invitado: 401,
    user: 'permitido',
    admin: 'permitido',
  },
  {
    ruta: 'POST /cargadores',
    hacer: (c) => c.post('/cargadores', {}),
    invitado: 401,
    user: 'permitido',
    admin: 'permitido',
  },
  {
    ruta: 'GET /mis-cargadores',
    hacer: (c) => c.get('/mis-cargadores'),
    invitado: 401,
    user: 'permitido',
    admin: 'permitido',
  },
  {
    ruta: 'GET /favoritos',
    hacer: (c) => c.get('/favoritos'),
    invitado: 401,
    user: 'permitido',
    admin: 'permitido',
  },
  {
    ruta: 'GET /rutas-guardadas',
    hacer: (c) => c.get('/rutas-guardadas'),
    invitado: 401,
    user: 'permitido',
    admin: 'permitido',
  },
  // Solo admin
  {
    ruta: 'GET /admin/usuarios',
    hacer: (c) => c.get('/admin/usuarios'),
    invitado: 401,
    user: 403,
    admin: 'permitido',
  },
  {
    ruta: 'PATCH /admin/usuarios/:id',
    hacer: (c) => c.patch(`/admin/usuarios/${idInexistente}`, { activo: true }),
    invitado: 401,
    user: 403,
    admin: 'permitido',
  },
  {
    ruta: 'PATCH /admin/cargadores/:id',
    hacer: (c) => c.patch(`/admin/cargadores/${idInexistente}`, { estado: 'activo' }),
    invitado: 401,
    user: 403,
    admin: 'permitido',
  },
  {
    ruta: 'POST /admin/vehiculos-modelo',
    hacer: (c) => c.post('/admin/vehiculos-modelo', {}),
    invitado: 401,
    user: 403,
    admin: 'permitido',
  },
  {
    ruta: 'DELETE /admin/vehiculos-modelo/:id',
    hacer: (c) => c.delete(`/admin/vehiculos-modelo/${idInexistente}`),
    invitado: 401,
    user: 403,
    admin: 'permitido',
  },
];

describe('matriz de permisos (SPEC §2)', () => {
  const roles = [
    ['invitado', () => undefined],
    ['user', () => tokenSeed('usuario')],
    ['admin', () => tokenSeed('admin')],
  ] as const;

  for (const caso of CASOS) {
    for (const [rol, token] of roles) {
      const esperado = caso[rol];
      it(`${caso.ruta} · ${rol} → ${esperado}`, async () => {
        const res = await caso.hacer(cliente(ctx.app, token()));
        expect(res.status, 'nunca un error interno').toBeLessThan(500);
        if (esperado === 'permitido') {
          expect([401, 403], `respondió ${res.status}`).not.toContain(res.status);
        } else {
          expect(res.status).toBe(esperado);
        }
      });
    }
  }
});
