// Contexto común de los tests de la API: base de pruebas sembrada con fecha fija y tokens de los usuarios
// del seed. El reloj de la app es el martes 27/10/2026 10:00 (AHORA_API).
import type { Knex } from 'knex';
import request from 'supertest';
import { uuidDeterministico } from '../../seeds/aleatorio.js';
import { sembrar } from '../../seeds/demo.js';
import { generarDatos, type CargadorSeed, type DatosSeed } from '../../seeds/generar.js';
import { prepararBaseDePrueba } from '../db/baseDePrueba.js';
import { appDePrueba, authLocalDePrueba, HOY_API } from '../helpers.js';

export interface ContextoApi {
  db: Knex;
  app: ReturnType<typeof appDePrueba>;
  datos: DatosSeed;
}

export async function prepararContextoApi(): Promise<ContextoApi> {
  const db = await prepararBaseDePrueba();
  await sembrar(db, { reset: true, modoAuth: 'local', hoy: HOY_API });
  return {
    db,
    app: appDePrueba({ db }),
    datos: generarDatos({ hoy: HOY_API, incluirUsuariosDemo: true }),
  };
}

/** Token de un usuario del seed: 'admin', 'usuario' o 'anfitrion-NN'. */
export function tokenSeed(clave: string): string {
  const email =
    clave === 'admin'
      ? 'admin@demo.local'
      : clave === 'usuario'
        ? 'usuario@demo.local'
        : `${clave}@demo.local`;
  return authLocalDePrueba().firmar({
    sub: uuidDeterministico(`sub:${clave}`),
    email,
    nombre: clave,
    rol: clave === 'admin' ? 'admin' : 'user',
  });
}

export const idUsuarioSeed = (clave: string) => uuidDeterministico(`usuario:${clave}`);

/** Clave ('anfitrion-NN') del dueño de un cargador privado del seed. */
export function claveDueno(datos: DatosSeed, c: CargadorSeed): string {
  return datos.usuarios.find((u) => u.id === c.usuarioId)!.clave;
}

/** Cliente HTTP con token opcional. */
export function cliente(app: ContextoApi['app'], token?: string) {
  const conToken = <T extends request.Test>(r: T) =>
    token ? r.set('Authorization', `Bearer ${token}`) : r;
  return {
    get: (url: string) => conToken(request(app).get(`/api/v1${url}`)),
    post: (url: string, body?: object) => conToken(request(app).post(`/api/v1${url}`)).send(body),
    put: (url: string, body?: object) => conToken(request(app).put(`/api/v1${url}`)).send(body),
    patch: (url: string, body?: object) => conToken(request(app).patch(`/api/v1${url}`)).send(body),
    delete: (url: string) => conToken(request(app).delete(`/api/v1${url}`)),
  };
}
