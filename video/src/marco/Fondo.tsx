// Fondo de todas las escenas: el gris verdoso de la app con dos manchas suaves del color primario.
import { AbsoluteFill } from 'remotion';

export function Fondo() {
  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(900px 700px at 82% 18%, rgb(12 127 87 / 0.10), transparent 70%),
          radial-gradient(800px 600px at 8% 92%, rgb(12 127 87 / 0.07), transparent 70%),
          var(--color-fondo)`,
      }}
    />
  );
}
