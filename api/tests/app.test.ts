import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { appDePrueba } from './helpers.js';

const app = appDePrueba();

describe('GET /api/v1/salud', () => {
  it('responde 200 con estado ok', async () => {
    const res = await request(app).get('/api/v1/salud');
    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('ok');
    expect(typeof res.body.hora).toBe('string');
  });

  it('incluye los encabezados de seguridad de helmet', async () => {
    const res = await request(app).get('/api/v1/salud');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('formato de errores', () => {
  it('devuelve 404 con el formato estándar en rutas inexistentes', async () => {
    const res = await request(app).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 'NO_ENCONTRADO', message: expect.any(String), details: {} },
    });
  });

  it('devuelve 400 JSON_INVALIDO si el cuerpo no es JSON válido', async () => {
    const res = await request(app)
      .post('/api/v1/salud')
      .set('Content-Type', 'application/json')
      .send('{ esto no es json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('JSON_INVALIDO');
  });

  it('devuelve 413 si el cuerpo supera el límite', async () => {
    const res = await request(app)
      .post('/api/v1/salud')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ relleno: 'x'.repeat(200 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('CUERPO_DEMASIADO_GRANDE');
  });
});

describe('CORS', () => {
  it('permite el origen configurado y no otros', async () => {
    const permitido = await request(app)
      .get('/api/v1/salud')
      .set('Origin', 'http://localhost:5173');
    expect(permitido.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const ajeno = await request(app).get('/api/v1/salud').set('Origin', 'http://malicioso.test');
    expect(ajeno.headers['access-control-allow-origin']).toBeUndefined();
  });
});
