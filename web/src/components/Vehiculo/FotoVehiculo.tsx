// Foto de un modelo del catálogo con su crédito (D-047). Sin foto, un dibujo genérico.
import type { ModeloVehiculo } from '../../api/tipos';
import { Icono } from '../ui';
import s from './FotoVehiculo.module.css';

type ConFoto = Pick<
  ModeloVehiculo,
  'marca' | 'modelo' | 'fotoUrl' | 'fotoCredito' | 'fotoFuenteUrl'
>;

export function FotoVehiculo({
  vehiculo,
  tamano = 'grande',
  sinCredito,
}: {
  vehiculo: ConFoto;
  tamano?: 'miniatura' | 'mediana' | 'grande';
  /** En miniaturas el crédito se muestra en la vista de detalle. */
  sinCredito?: boolean;
}) {
  const clase = `${s.foto} ${s[tamano]}`;
  if (!vehiculo.fotoUrl) {
    return (
      <div className={`${clase} ${s.sinFoto}`} aria-hidden="true">
        <Icono nombre="auto" tamano={tamano === 'miniatura' ? 26 : 72} />
      </div>
    );
  }
  return (
    <figure className={s.figura}>
      <img
        className={clase}
        src={vehiculo.fotoUrl}
        alt={`${vehiculo.marca} ${vehiculo.modelo}`}
        loading="lazy"
        decoding="async"
      />
      {!sinCredito && vehiculo.fotoCredito && (
        <figcaption className={s.credito}>
          {vehiculo.fotoFuenteUrl ? (
            <a href={vehiculo.fotoFuenteUrl} target="_blank" rel="noopener noreferrer">
              {vehiculo.fotoCredito}
            </a>
          ) : (
            vehiculo.fotoCredito
          )}
        </figcaption>
      )}
    </figure>
  );
}
