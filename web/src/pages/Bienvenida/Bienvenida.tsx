import styles from './Bienvenida.module.css';

export function Bienvenida() {
  return (
    <main className={styles.pagina}>
      <div className={styles.logo} aria-hidden="true">
        <svg viewBox="0 0 24 24" width="36" height="36">
          <path
            d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h1 className={styles.titulo}>EVConnect</h1>
      <p className={styles.subtitulo}>Cargadores públicos y privados, recomendados para vos</p>
      <p className={styles.estado}>Demo en construcción.</p>
    </main>
  );
}
