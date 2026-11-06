// Home "¿Dónde cargamos tu vehículo?" (web/src/pages/Home) con sus CSS Modules y componentes reales.
// BateriaUrgencia es el componente real (la urgencia se calcula sola a partir de la batería). El selector
// de ubicación usa hooks de la API, así que se arma con su mismo CSS (Buscador.module.css).
import type { ModeloVehiculo } from '../../../web/src/api/tipos';
import { BateriaUrgencia } from '../../../web/src/components/Buscador/BateriaUrgencia';
import buscador from '../../../web/src/components/Buscador/Buscador.module.css';
import {
  Boton,
  BotonIcono,
  Chips,
  claseControl,
  Icono,
  Segmentado,
} from '../../../web/src/components/ui';
import { FotoVehiculo } from '../../../web/src/components/Vehiculo/FotoVehiculo';
import { kwh, nombreConector } from '../../../web/src/dominio/formato';
import { autonomiaKm } from '../../../web/src/dominio/vehiculo';
import home from '../../../web/src/pages/Home/Home.module.css';
import { CATALOGO, JUAN } from '../datos/vehiculos';
import { ListaDesplegada } from '../marco/ListaDesplegada';
import { MarcoApp } from './MarcoApp';

export interface Lugar {
  nombre: string;
  lat: number;
  lng: number;
}

const foco = { outline: 'var(--foco-anillo)', outlineOffset: 'var(--foco-separacion)' };

export const opcionVehiculoPropio = (v: ModeloVehiculo) => `Mi ${v.marca} ${v.modelo} (guardado)`;

/** Ubicación elegida (mismo marcado que SelectorUbicacion: pin, nombre, coordenadas y quitar). */
function LugarElegido({ lugar }: { lugar: Lugar }) {
  return (
    <p className={buscador.elegido}>
      <Icono nombre="pin" tamano={18} />
      <span>
        {lugar.nombre}{' '}
        <small>
          ({lugar.lat.toFixed(4)}, {lugar.lng.toFixed(4)})
        </small>
      </span>
      <span className={buscador.quitar} style={{ flex: 'none' }}>
        <Icono nombre="x" tamano={16} />
      </span>
    </p>
  );
}

function SelectorUbicacion({ etiqueta, valor }: { etiqueta: string; valor: Lugar | null }) {
  return (
    <div className={buscador.bloque}>
      <label className={buscador.etiqueta}>{etiqueta}</label>
      <div className={buscador.filaUbicacion}>
        <BotonIcono icono="gps" etiqueta="Usar mi ubicación actual" />
        <input
          className={claseControl}
          placeholder="Calle y número, barrio o ciudad"
          readOnly
          value=""
        />
        <BotonIcono icono="buscar" etiqueta="Buscar" />
      </div>
      {valor ? (
        <LugarElegido lugar={valor} />
      ) : (
        <p className={buscador.ayuda}>Escribí la dirección y apretá Enter.</p>
      )}
    </div>
  );
}

export function PantallaHome({
  propios,
  vehiculo,
  vehiculoDesplegado,
  vehiculoResaltado,
  modo,
  rutasGuardadas,
  rutaDesplegada,
  rutaResaltada,
  origen,
  destino,
  bateriaPct,
  focoBateria,
  desplazamiento,
}: {
  propios: readonly ModeloVehiculo[];
  vehiculo: ModeloVehiculo;
  vehiculoDesplegado: boolean;
  vehiculoResaltado: string | null;
  modo: 'ubicacion' | 'ruta';
  rutasGuardadas: readonly string[];
  rutaDesplegada: boolean;
  rutaResaltada: string | null;
  origen: Lugar | null;
  destino: Lugar | null;
  bateriaPct: number;
  focoBateria: boolean;
  desplazamiento: number;
}) {
  return (
    <MarcoApp seccion="home" desplazamiento={desplazamiento}>
      <div className={home.pagina}>
        <p className={home.saludo}>
          Hola,
          <strong>{JUAN.nombre.split(' ')[0]}</strong>
        </p>

        <section className={home.tarjeta}>
          <h1 className={home.titulo}>¿Dónde cargamos tu vehículo?</h1>

          <div className={home.grilla}>
            <div className={home.columna}>
              <div className={home.campo} style={{ position: 'relative' }}>
                <label className={home.etiqueta}>Tu vehículo</label>
                <select
                  className={claseControl}
                  value={vehiculo.id}
                  onChange={() => undefined}
                  style={vehiculoDesplegado ? foco : undefined}
                >
                  {propios.map((v) => (
                    <option key={v.id} value={v.id}>
                      {opcionVehiculoPropio(v)}
                    </option>
                  ))}
                </select>
                {vehiculoDesplegado && (
                  <ListaDesplegada
                    grupos={[
                      { titulo: 'Mis vehículos', opciones: propios.map(opcionVehiculoPropio) },
                      {
                        titulo: 'Catálogo',
                        opciones: CATALOGO.slice(1, 5).map((m) => `${m.marca} ${m.modelo}`),
                      },
                    ]}
                    resaltada={vehiculoResaltado}
                  />
                )}
              </div>
              {vehiculo.fotoUrl && <FotoVehiculo vehiculo={vehiculo} tamano="mediana" />}
              <Chips
                items={[
                  { icono: 'bateria', valor: kwh(vehiculo.capacidadBateriaKwh), nombre: 'Batería' },
                  {
                    icono: 'velocimetro',
                    valor: `~${Math.round(autonomiaKm(vehiculo))} km`,
                    nombre: 'Autonomía',
                  },
                  {
                    icono: 'enchufe',
                    valor: nombreConector(vehiculo.tipoConector),
                    nombre: 'Conector',
                  },
                ]}
              />
              <p className={home.aviso}>Especificaciones aproximadas.</p>
            </div>

            <div className={home.columna}>
              <div className={home.campo}>
                <span className={home.etiqueta}>Buscar por</span>
                <Segmentado
                  etiqueta="Buscar por"
                  opciones={[
                    { valor: 'ubicacion', nombre: 'Ubicación' },
                    { valor: 'ruta', nombre: 'Ruta' },
                  ]}
                  valor={modo}
                  onCambio={() => undefined}
                />
              </div>

              {modo === 'ruta' && (
                <div className={home.campo} style={{ position: 'relative' }}>
                  <label className={home.etiqueta}>Usar una ruta guardada</label>
                  <select
                    className={claseControl}
                    value=""
                    onChange={() => undefined}
                    style={rutaDesplegada ? foco : undefined}
                  >
                    <option value="">Elegir…</option>
                  </select>
                  {rutaDesplegada && (
                    <ListaDesplegada
                      grupos={[{ opciones: rutasGuardadas }]}
                      resaltada={rutaResaltada}
                    />
                  )}
                </div>
              )}

              <SelectorUbicacion
                etiqueta={modo === 'ruta' ? 'Origen' : 'Ubicación'}
                valor={origen}
              />
              {modo === 'ruta' && <SelectorUbicacion etiqueta="Destino" valor={destino} />}
            </div>
          </div>

          <div
            style={
              focoBateria
                ? {
                    borderRadius: 'var(--radio-campo)',
                    boxShadow: '0 0 0 8px var(--color-primario-claro)',
                    background: 'var(--color-primario-claro)',
                  }
                : undefined
            }
          >
            <BateriaUrgencia
              bateriaPct={bateriaPct}
              onCambio={() => undefined}
              vehiculo={vehiculo}
            />
          </div>

          <Boton anchoCompleto>Buscar cargadores</Boton>
        </section>

        {/* Accesos rápidos (solo en escritorio, como en la app) */}
        <nav className={home.accesos} aria-label="Accesos rápidos">
          <a>
            <Icono nombre="auto" />
            Mis vehículos
          </a>
          <a>
            <Icono nombre="rayo" />
            Publicar cargador
          </a>
          <a>
            <Icono nombre="calendario" />
            Mis reservas
          </a>
          <a>
            <Icono nombre="corazon" />
            Favoritos
          </a>
        </nav>
      </div>
    </MarcoApp>
  );
}
