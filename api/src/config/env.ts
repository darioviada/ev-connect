// Configuración tipada a partir de variables de entorno. Función pura: recibe el entorno y devuelve la
// configuración, o lanza ConfigError con la lista de problemas.
import { z } from 'zod';

/** Valor de JWT_SECRET que trae .env.example. Solo sirve para la demo local. */
export const JWT_SECRET_DEMO = 'demo-local-inseguro-cambiar-antes-de-usar-fuera-de-la-demo';

export class ConfigError extends Error {
  readonly problemas: string[];

  constructor(problemas: string[]) {
    super(
      'Configuración inválida. Revisá tu archivo .env (podés partir de .env.example):\n' +
        problemas.map((p) => `  - ${p}`).join('\n'),
    );
    this.name = 'ConfigError';
    this.problemas = problemas;
  }
}

const esquema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
    TZ: z.string().default('America/Argentina/Cordoba'),
    DATABASE_URL: z
      .string({ error: 'es obligatoria (ej.: postgres://tfg:tfg@localhost:5432/tfg)' })
      .regex(/^postgres(ql)?:\/\//, 'debe empezar con postgres:// o postgresql://'),
    AUTH_MODE: z.enum(['local', 'cognito']).default('local'),
    JWT_SECRET: z.string().optional(),
    COGNITO_REGION: z.string().optional(),
    COGNITO_USER_POOL_ID: z.string().optional(),
    COGNITO_CLIENT_ID: z.string().optional(),
    ROUTING_PROVIDER: z.enum(['auto', 'offline', 'google']).default('auto'),
    GOOGLE_MAPS_API_KEY: z.string().optional(),
    GEOCODING_PROVIDER: z.enum(['static', 'nominatim']).default('static'),
    CANDIDATES_LIMIT: z.coerce.number().int().min(1).max(25).default(8),
    SEARCH_RADIUS_KM: z.coerce.number().positive().default(20),
    CORRIDOR_KM: z.coerce.number().positive().default(5),
    /** Cantidad de proxies confiables delante de la API (1 detrás del Application Load Balancer). */
    TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
    /** Carpeta con el build de la web para servirla desde la API (contenedor de producción). */
    WEB_DIST: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const problema = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    if (env.AUTH_MODE === 'local') {
      if (!env.JWT_SECRET) {
        problema('JWT_SECRET', 'es obligatoria con AUTH_MODE=local');
      } else if (env.JWT_SECRET.length < 32) {
        problema('JWT_SECRET', 'debe tener al menos 32 caracteres');
      } else if (env.JWT_SECRET === JWT_SECRET_DEMO && env.NODE_ENV === 'production') {
        problema('JWT_SECRET', 'el valor de demostración no se puede usar con NODE_ENV=production');
      }
    } else {
      for (const clave of [
        'COGNITO_REGION',
        'COGNITO_USER_POOL_ID',
        'COGNITO_CLIENT_ID',
      ] as const) {
        if (!env[clave]) problema(clave, 'es obligatoria con AUTH_MODE=cognito');
      }
    }

    if (env.ROUTING_PROVIDER === 'google' && !env.GOOGLE_MAPS_API_KEY) {
      problema('GOOGLE_MAPS_API_KEY', 'es obligatoria con ROUTING_PROVIDER=google');
    }
  });

export type ConfigAuth =
  | { mode: 'local'; jwtSecret: string }
  | { mode: 'cognito'; region: string; userPoolId: string; clientId: string };

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace' | 'silent';
  corsOrigins: string[];
  tz: string;
  databaseUrl: string;
  auth: ConfigAuth;
  routing: { provider: 'offline' | 'google'; googleApiKey?: string };
  geocoding: { provider: 'static' | 'nominatim' };
  engine: { candidatesLimit: number; searchRadiusKm: number; corridorKm: number };
  trustProxy: number;
  webDist: string | null;
  /** Avisos no fatales para mostrar al arrancar. */
  advertencias: string[];
}

export function parseConfig(entorno: Record<string, string | undefined>): Config {
  // Una variable vacía (ej. `COGNITO_REGION=`) cuenta como no definida.
  const limpio = Object.fromEntries(
    Object.entries(entorno).filter(([, v]) => v !== undefined && v.trim() !== ''),
  );

  const resultado = esquema.safeParse(limpio);
  if (!resultado.success) {
    throw new ConfigError(
      resultado.error.issues.map((i) => `${i.path.join('.') || '(entorno)'}: ${i.message}`),
    );
  }
  const env = resultado.data;
  const advertencias: string[] = [];

  let auth: ConfigAuth;
  if (env.AUTH_MODE === 'local') {
    // El superRefine ya garantiza que existe.
    auth = { mode: 'local', jwtSecret: env.JWT_SECRET as string };
    advertencias.push('AUTH_MODE=local: modo demo, no usar en producción.');
    if (env.JWT_SECRET === JWT_SECRET_DEMO) {
      advertencias.push('JWT_SECRET usa el valor de demostración de .env.example.');
    }
  } else {
    auth = {
      mode: 'cognito',
      region: env.COGNITO_REGION as string,
      userPoolId: env.COGNITO_USER_POOL_ID as string,
      clientId: env.COGNITO_CLIENT_ID as string,
    };
  }

  // auto = Google si hay clave; si no, offline.
  const usarGoogle =
    env.ROUTING_PROVIDER === 'google' ||
    (env.ROUTING_PROVIDER === 'auto' && Boolean(env.GOOGLE_MAPS_API_KEY));
  const routing: Config['routing'] = usarGoogle
    ? { provider: 'google', googleApiKey: env.GOOGLE_MAPS_API_KEY as string }
    : { provider: 'offline' };

  return {
    nodeEnv: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    corsOrigins: env.CORS_ORIGIN.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    tz: env.TZ,
    databaseUrl: env.DATABASE_URL,
    auth,
    routing,
    geocoding: { provider: env.GEOCODING_PROVIDER },
    engine: {
      candidatesLimit: env.CANDIDATES_LIMIT,
      searchRadiusKm: env.SEARCH_RADIUS_KM,
      corridorKm: env.CORRIDOR_KM,
    },
    trustProxy: env.TRUST_PROXY,
    webDist: env.WEB_DIST ?? null,
    advertencias,
  };
}

/** Lo mínimo para los comandos de base de datos (migrar y sembrar): no requieren secretos ni Cognito. */
export interface ConfigBase {
  databaseUrl: string;
  authMode: 'local' | 'cognito';
  tz: string;
}

const esquemaBase = z.object({
  DATABASE_URL: z
    .string({ error: 'es obligatoria (ej.: postgres://tfg:tfg@localhost:5432/tfg)' })
    .regex(/^postgres(ql)?:\/\//, 'debe empezar con postgres:// o postgresql://'),
  AUTH_MODE: z.enum(['local', 'cognito']).default('local'),
  TZ: z.string().default('America/Argentina/Cordoba'),
});

export function parseConfigBase(entorno: Record<string, string | undefined>): ConfigBase {
  const limpio = Object.fromEntries(
    Object.entries(entorno).filter(([, v]) => v !== undefined && v.trim() !== ''),
  );
  const r = esquemaBase.safeParse(limpio);
  if (!r.success) {
    throw new ConfigError(r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
  }
  return { databaseUrl: r.data.DATABASE_URL, authMode: r.data.AUTH_MODE, tz: r.data.TZ };
}
