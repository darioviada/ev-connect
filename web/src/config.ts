// Configuración del frontend (variables VITE_* del .env de la raíz; quedan fijas en el build).
export const config = {
  apiUrl: import.meta.env.VITE_API_URL || '/api/v1',
  modoAuth: (import.meta.env.VITE_AUTH_MODE === 'cognito' ? 'cognito' : 'local') as
    'local' | 'cognito',
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID ?? '',
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID ?? '',
  },
  /** Centro inicial del mapa: Córdoba (zona piloto del seed). El sistema tiene alcance nacional. */
  centroMapa: { lat: -31.4201, lng: -64.1888 },
};
