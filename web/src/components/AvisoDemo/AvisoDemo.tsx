import styles from './AvisoDemo.module.css';

/** Aviso discreto y permanente: los datos de la demo son sintéticos. */
export function AvisoDemo() {
  return (
    <p className={styles.aviso} role="note">
      Datos de demostración (sintéticos)
    </p>
  );
}
