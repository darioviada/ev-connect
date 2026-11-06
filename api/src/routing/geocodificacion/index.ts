import type { Config } from '../../config/index.js';
import { NominatimProvider } from './nominatim.js';
import { StaticGeocodingProvider } from './static.js';
import type { GeocodingProvider } from './tipos.js';

export { LUGARES } from './lugares.js';
export {
  expandirAbreviaturas,
  nombreDeResultado,
  NominatimProvider,
  URL_NOMINATIM,
  USER_AGENT_NOMINATIM,
} from './nominatim.js';
export { normalizarTexto, StaticGeocodingProvider } from './static.js';
export * from './tipos.js';

export function crearGeocodingProvider(config: Pick<Config, 'geocoding'>): GeocodingProvider {
  return config.geocoding.provider === 'nominatim'
    ? new NominatimProvider()
    : new StaticGeocodingProvider();
}
