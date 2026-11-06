// Plan de viaje en modo ruta (D-045): paradas en orden desde la opción elegida hasta el destino.
import { Link } from 'react-router';
import type { Recomendacion } from '../../api/tipos';
import type { Busqueda } from '../../dominio/busqueda';
import { fechaCorta, km, kw, minutos, nombreConector, pesos } from '../../dominio/formato';
import s from './Resultados.module.css';

const pct = (x: number) => `${Math.round(x)} %`;

export function PlanDeViaje({
  rec,
  busqueda,
  enlace,
}: {
  rec: Recomendacion;
  busqueda: Busqueda;
  /** Enlace a la ficha de un cargador (para reservar cada parada). */
  enlace: (cargadorId: string) => string;
}) {
  const plan = rec.plan;
  if (!plan?.factible || !plan.llegada) return null;
  const t = plan.totales;
  const n = plan.paradas.length;

  return (
    <section className={s.plan} aria-labelledby="titulo-plan">
      <h2 id="titulo-plan" className={s.planTitulo}>
        Plan de viaje {rec.mejorOpcion ? 'con la mejor opción' : `desde ${rec.cargador.nombre}`}
      </h2>
      <p className={s.planTotales}>
        {n} parada{n === 1 ? '' : 's'} · {minutos(t.totalMin)} en total ({minutos(t.viajeMin)}{' '}
        manejando, {minutos(t.cargaMin)} cargando
        {t.esperaMin >= 1 ? `, ${minutos(t.esperaMin)} de espera` : ''}) · {pesos(t.costoEstimado)}{' '}
        de carga
      </p>
      <ol className={s.planPasos}>
        <li className={s.planPaso}>
          <span className={`${s.planNumero} ${s.planExtremo}`} aria-hidden="true" />
          <div>
            <strong>Salida: {busqueda.origenNombre ?? 'origen'}</strong>
            <p>Con {pct(busqueda.bateriaPct)} de batería.</p>
          </div>
        </li>
        {plan.paradas.map((p, i) => (
          <li key={p.cargador.id} className={s.planPaso}>
            <span
              className={`${s.planNumero} ${i === 0 ? s.planNumeroPrimario : ''}`}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <div>
              <Link to={enlace(p.cargador.id)} aria-label={`Parada ${i + 1}: ${p.cargador.nombre}`}>
                {p.cargador.nombre}
              </Link>
              <p>
                Km {Math.round(p.kmEnRuta)} · a {km(p.tramoKm)} del punto anterior ·{' '}
                {nombreConector(p.cargador.tipoConector)} {kw(p.cargador.potenciaKw)}
              </p>
              <p>
                Llegás con {pct(p.socLlegadaPct)} y cargás hasta {pct(p.objetivoPct)}:{' '}
                {minutos(p.cargaMin)}, {pesos(p.costoEstimado)}
                {p.esperaMin >= 1 ? ` (esperás ${minutos(p.esperaMin)})` : ''}.{' '}
                {fechaCorta(p.horarioCarga.fecha)} de {p.horarioCarga.horaInicio} a{' '}
                {p.horarioCarga.horaFin}.
              </p>
            </div>
          </li>
        ))}
        <li className={s.planPaso}>
          <span className={`${s.planNumero} ${s.planExtremo}`} aria-hidden="true" />
          <div>
            <strong>Llegada: {busqueda.destinoNombre ?? 'destino'}</strong>
            <p>
              A {km(plan.llegada.tramoKm)} de la última parada. Llegás con{' '}
              {pct(plan.llegada.socPct)}, {fechaCorta(plan.llegada.fecha)} a las {plan.llegada.hora}{' '}
              (estimado, sin tráfico).
            </p>
          </div>
        </li>
      </ol>
      {plan.paradas.some((p) => p.tramoEstimado) && (
        <p className={s.leyenda}>
          Los tramos entre paradas son estimados. Cada parada se reserva por separado desde su
          ficha.
        </p>
      )}
    </section>
  );
}
