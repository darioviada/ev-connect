import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { appDePrueba, configDePrueba } from './helpers.js';

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

describe('la API sirve el build de la web (contenedor de producción)', () => {
  const carpeta = mkdtempSync(path.join(tmpdir(), 'web-dist-'));
  mkdirSync(path.join(carpeta, 'assets'));
  writeFileSync(path.join(carpeta, 'index.html'), '<!doctype html><title>EVConnect</title>');
  writeFileSync(path.join(carpeta, 'assets', 'app-123.js'), 'console.log(1)');
  const appWeb = appDePrueba({ config: configDePrueba({ WEB_DIST: carpeta, TRUST_PROXY: '1' }) });

  it('sirve los archivos estáticos con caché larga para /assets', async () => {
    const res = await request(appWeb).get('/assets/app-123.js');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toContain('immutable');
  });

  it('las rutas de la SPA devuelven index.html', async () => {
    for (const ruta of ['/', '/resultados', '/cargadores/abc']) {
      const res = await request(appWeb).get(ruta);
      expect(res.status, ruta).toBe(200);
      expect(res.text).toContain('EVConnect');
    }
  });

  it('las rutas de la API inexistentes siguen respondiendo 404 en JSON', async () => {
    const res = await request(appWeb).get('/api/v1/no-existe');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NO_ENCONTRADO');
  });

  it('la CSP permite los mosaicos de OpenStreetMap y no fuerza https en local', async () => {
    const csp = (await request(appWeb).get('/')).headers['content-security-policy'];
    expect(csp).toContain('img-src');
    expect(csp).toContain('https://tile.openstreetmap.org');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('sin WEB_DIST no sirve archivos (modo desarrollo)', async () => {
    expect((await request(appDePrueba()).get('/')).status).toBe(404);
  });
});
