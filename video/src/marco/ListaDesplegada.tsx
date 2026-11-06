// Lista abierta de un <select> nativo (en un video no se puede abrir el menú del navegador): se dibuja
// debajo del control con el estilo de los campos de la app. Admite grupos (como <optgroup>).
export interface GrupoOpciones {
  titulo?: string;
  opciones: readonly string[];
}

export function ListaDesplegada({
  grupos,
  resaltada,
}: {
  grupos: readonly GrupoOpciones[];
  /** Texto de la opción resaltada (o null). */
  resaltada: string | null;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 20,
        marginTop: 6,
        padding: 6,
        borderRadius: 'var(--radio-campo)',
        background: 'var(--color-superficie)',
        border: '1px solid var(--color-borde)',
        boxShadow: '0 12px 32px rgb(27 29 26 / 0.18)',
      }}
    >
      {grupos.map((g, i) => (
        <div key={g.titulo ?? i}>
          {g.titulo && (
            <div
              style={{
                padding: '8px 12px 4px',
                color: 'var(--color-texto-secundario)',
                fontSize: '0.8rem',
                fontWeight: 600,
              }}
            >
              {g.titulo}
            </div>
          )}
          {g.opciones.map((o) => {
            const activa = o === resaltada;
            return (
              <div
                key={o}
                style={{
                  padding: '9px 12px',
                  borderRadius: 8,
                  background: activa ? 'var(--color-primario-claro)' : 'transparent',
                  color: activa ? 'var(--color-primario)' : 'var(--color-texto)',
                  fontWeight: activa ? 600 : 400,
                }}
              >
                {o}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
