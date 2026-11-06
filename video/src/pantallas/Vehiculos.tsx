// Pantallas de "Mis vehículos" (web/src/pages/Vehiculos): lista, agregar (desde el catálogo) y detalle,
// con los componentes y el CSS Module reales. El selector de modelo de la app es un <select> nativo: su
// lista desplegada se dibuja aparte, con el estilo de los controles de la app.
import type { ModeloVehiculo } from '../../../web/src/api/tipos';
import {
  Boton,
  Cabecera,
  Chips,
  claseControl,
  EnlaceBoton,
  Segmentado,
  TarjetaEnlace,
} from '../../../web/src/components/ui';
import { FotoVehiculo } from '../../../web/src/components/Vehiculo/FotoVehiculo';
import { kwh, nombreConector } from '../../../web/src/dominio/formato';
import { autonomiaKm } from '../../../web/src/dominio/vehiculo';
import vs from '../../../web/src/pages/Vehiculos/Vehiculos.module.css';
import { CATALOGO } from '../datos/vehiculos';
import { ListaDesplegada } from '../marco/ListaDesplegada';
import { MarcoApp } from './MarcoApp';

/** Igual que chipsDe() de la app; `p` (0 a 1) hace que los valores "se completen" al elegir el modelo. */
const chipsDe = (v: ModeloVehiculo, p = 1) => [
  {
    icono: 'bateria' as const,
    valor: kwh(Math.round(v.capacidadBateriaKwh * p)),
    nombre: 'Batería',
  },
  {
    icono: 'velocimetro' as const,
    valor: `~${Math.round(autonomiaKm(v) * p)} km`,
    nombre: 'Autonomía',
  },
  {
    icono: 'enchufe' as const,
    valor: p < 0.5 ? '—' : nombreConector(v.tipoConector),
    nombre: 'Conector',
  },
];

export function PantallaMisVehiculos({ vehiculos }: { vehiculos: readonly ModeloVehiculo[] }) {
  return (
    <MarcoApp seccion="vehiculos">
      <Cabecera
        titulo="Mis vehículos"
        accion={<EnlaceBoton a="/vehiculos/nuevo">Agregar</EnlaceBoton>}
      />
      <ul className={vs.lista}>
        {vehiculos.map((v) => (
          <li key={v.id}>
            <TarjetaEnlace a={`/vehiculos/${v.id}`}>
              <div className={vs.fila}>
                <FotoVehiculo vehiculo={v} tamano="miniatura" sinCredito />
                <div>
                  <h2 className={vs.nombre}>
                    {v.marca} {v.modelo}
                  </h2>
                  <p className={vs.datos}>
                    {kwh(v.capacidadBateriaKwh)} · ~{Math.round(autonomiaKm(v))} km ·{' '}
                    {nombreConector(v.tipoConector)}
                  </p>
                </div>
              </div>
            </TarjetaEnlace>
          </li>
        ))}
      </ul>
    </MarcoApp>
  );
}

export function PantallaAgregarVehiculo({
  modelo,
  desplegado,
  resaltado,
  completado,
  enviando,
}: {
  modelo: ModeloVehiculo | null;
  /** Lista del selector abierta. */
  desplegado: boolean;
  /** Índice del modelo resaltado en la lista abierta (-1 = ninguno). */
  resaltado: number;
  /** Progreso (0 a 1) del completado automático de batería, autonomía y conector. */
  completado: number;
  enviando: boolean;
}) {
  return (
    <MarcoApp seccion="vehiculos">
      <form className={vs.formulario}>
        <Cabecera titulo="Agregar vehículo" volver="/vehiculos" />
        <Segmentado
          etiqueta="Origen de los datos"
          opciones={[
            { valor: 'catalogo', nombre: 'Elegir del catálogo' },
            { valor: 'propio', nombre: 'Cargar el mío' },
          ]}
          valor="catalogo"
          onCambio={() => undefined}
        />
        <div className={vs.campo} style={{ position: 'relative' }}>
          <label className={vs.etiqueta}>Modelo</label>
          <select
            className={claseControl}
            value={modelo?.id ?? ''}
            onChange={() => undefined}
            style={
              desplegado
                ? { outline: 'var(--foco-anillo)', outlineOffset: 'var(--foco-separacion)' }
                : undefined
            }
          >
            <option value="">Elegí un modelo…</option>
            {CATALOGO.map((m) => (
              <option key={m.id} value={m.id}>
                {m.marca} {m.modelo}
              </option>
            ))}
          </select>
          {desplegado && (
            <ListaDesplegada
              grupos={[{ opciones: CATALOGO.map((m) => `${m.marca} ${m.modelo}`) }]}
              resaltada={
                resaltado >= 0
                  ? `${CATALOGO[resaltado]!.marca} ${CATALOGO[resaltado]!.modelo}`
                  : null
              }
            />
          )}
        </div>
        <span className={vs.etiqueta}>Batería, consumo y conector</span>
        {modelo ? (
          <Chips items={chipsDe(modelo, completado)} />
        ) : (
          <p className={vs.placeholder}>Se completan automáticamente al elegir el modelo</p>
        )}
        <Boton type="button" anchoCompleto cargando={enviando}>
          Guardar vehículo
        </Boton>
      </form>
    </MarcoApp>
  );
}

export function PantallaDetalleVehiculo({
  v,
  desplazamiento = 0,
}: {
  v: ModeloVehiculo;
  desplazamiento?: number;
}) {
  return (
    <MarcoApp seccion="vehiculos" desplazamiento={desplazamiento}>
      <div className={vs.detalle}>
        <Cabecera titulo="Detalle del vehículo" volver="/vehiculos" />
        <FotoVehiculo vehiculo={v} />
        <div className={vs.tarjetaModelo}>
          <h2 className={vs.nombre}>
            {v.marca} {v.modelo}
          </h2>
          <p className={vs.datos}>Del catálogo · especificaciones aproximadas</p>
        </div>
        <Chips items={chipsDe(v)} />
        <p className={vs.datos}>
          Consumo {v.consumoKwhPor100km} kWh/100 km · AC hasta {v.potenciaMaxAcKw} kW ·{' '}
          {v.potenciaMaxDcKw ? `DC hasta ${v.potenciaMaxDcKw} kW` : 'sin carga rápida DC'}
        </p>
      </div>
    </MarcoApp>
  );
}

/** Posiciones (área de contenido del celular) para el cursor. Ajustadas con capturas de prueba. */
export const POS_VEHICULOS = {
  agregar: { x: 316, y: 112 },
  selector: { x: 250, y: 292 },
  /** Primera opción de la lista desplegada (BYD Dolphin Mini). */
  primeraOpcion: { x: 120, y: 354 },
  guardar: { x: 195, y: 543 },
} as const;
