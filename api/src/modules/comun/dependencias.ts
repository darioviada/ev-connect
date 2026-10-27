import type { Knex } from 'knex';
import type { Logger } from 'pino';
import type { AuthProvider } from '../../auth/tipos.js';
import type { Config } from '../../config/index.js';
import type { GeocodingProvider } from '../../routing/geocodificacion/tipos.js';
import type { RoutingProvider } from '../../routing/tipos.js';
import type { Reloj } from './reloj.js';

/** Todo lo que necesitan los módulos de la API (inyectado: así se reemplaza en los tests). */
export interface DependenciasApi {
  config: Config;
  logger: Logger;
  db: Knex;
  auth: AuthProvider;
  rutas: RoutingProvider;
  geocoding: GeocodingProvider;
  reloj: Reloj;
}
