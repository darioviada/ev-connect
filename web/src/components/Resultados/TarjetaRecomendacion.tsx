// Tarjeta de un cargador recomendado: distancia (y desvío en modo ruta), conector, potencia, disponibilidad, tiempo y costo.
import type { Recomendacion } from '../../api/tipos';
import { disponibilidad, km, kw, minutos, nombreConector, pesos } from '../../dominio/formato';
import { Insignia, TarjetaEnlace } from '../ui';
import s from './Resultados.module.css';

export function TarjetaRecomendacion({
  rec,
  modo,
  enlace,
  compacta,
}: {
  rec: Recomendacion;
  modo: 'ubicacion' | 'ruta';
  enlace: string;
  compacta?: boolean;
}) {
  const m = rec.metricas;
  const distancia =
    modo === 'ruta' && m.desvioKm !== undefined
      ? `A ${km(m.distanciaKm)} · desvío ${km(m.desvioKm)}`
      : km(m.distanciaKm);
  // Con plan de viaje, la tarjeta avisa cuántas paradas más hacen falta.
  const extra = rec.plan ? rec.plan.paradas.length - 1 : 0;
  const paradas = extra > 0 ? [`+${extra} parada${extra === 1 ? '' : 's'} en el viaje`] : [];
  const datos = compacta
    ? [
        distancia,
        nombreConector(rec.cargador.tipoConector),
        minutos(m.cargaMin),
        pesos(m.costoEstimado),
        ...paradas,
      ]
    : [
        distancia,
        nombreConector(rec.cargador.tipoConector),
        kw(rec.cargador.potenciaKw),
        disponibilidad(m.esperaMin),
        `${minutos(m.cargaMin)} de carga`,
        pesos(m.costoEstimado),
        ...paradas,
      ];

  return (
    <TarjetaEnlace a={enlace} destacada={rec.mejorOpcion}>
      <div className={s.cabeceraTarjeta}>
        <h2 className={s.nombre}>{rec.cargador.nombre}</h2>
        {rec.mejorOpcion && <Insignia tono="primario">Mejor opción</Insignia>}
      </div>
      <p className={s.datos}>{datos.join(' · ')}</p>
      {!compacta && (
        <p className={s.pie}>
          <span>{rec.cargador.tipo === 'privado' ? 'Privado' : 'Público'}</span>
          <span>
            Puntaje <strong>{Math.round(rec.score)}</strong>/100
          </span>
        </p>
      )}
    </TarjetaEnlace>
  );
}
