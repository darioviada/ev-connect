import type { Logger } from 'pino';
import type { Config } from '../config/index.js';
import type { CacheRutas } from './cache.js';
import { GoogleRoutesProvider } from './google.js';
import { OfflineProvider } from './offline.js';
import type { RoutingProvider } from './tipos.js';

export * from './cache.js';
export { AVISO_FALLBACK, FIELD_MASK, GoogleRoutesProvider, URL_ROUTE_MATRIX } from './google.js';
export { estimarCelda, haversineM, OfflineProvider, velocidadMediaKmh } from './offline.js';
export * from './tipos.js';

/** Elige el proveedor según ROUTING_PROVIDER (ya resuelto en la config: auto → google si hay clave). */
export function crearRoutingProvider(
  config: Pick<Config, 'routing'>,
  deps: { cache: CacheRutas; logger?: Logger; fetch?: typeof fetch },
): RoutingProvider {
  if (config.routing.provider === 'google') {
    return new GoogleRoutesProvider({
      apiKey: config.routing.googleApiKey!,
      cache: deps.cache,
      ...(deps.logger ? { logger: deps.logger } : {}),
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
    });
  }
  return new OfflineProvider();
}
