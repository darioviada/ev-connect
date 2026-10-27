// Códigos de error de PostgreSQL que la API traduce a respuestas HTTP.
export const PG = {
  VIOLACION_UNICA: '23505',
  VIOLACION_FK: '23503',
  VIOLACION_EXCLUSION: '23P01',
  VIOLACION_CHECK: '23514',
} as const;

export const codigoPg = (error: unknown): string | undefined =>
  (error as { code?: string } | null)?.code;
