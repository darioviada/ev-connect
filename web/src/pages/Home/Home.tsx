// Home = buscador (HU-006 y HU-007): vehículo, ubicación o ruta, batería → urgencia y autonomía.
import { useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ModeloVehiculo, VehiculoBusqueda } from '../../api/tipos';
import { useSesion } from '../../auth/Sesion';
import { BateriaUrgencia } from '../../components/Buscador/BateriaUrgencia';
import { FotoVehiculo } from '../../components/Vehiculo/FotoVehiculo';
import {
  SelectorUbicacion,
  type UbicacionElegida,
} from '../../components/Buscador/SelectorUbicacion';
import { Alerta, Boton, Chips, claseControl, Icono, Segmentado } from '../../components/ui';
import { codificarBusqueda, type Busqueda } from '../../dominio/busqueda';
import { kwh, nombreConector } from '../../dominio/formato';
import { autonomiaKm } from '../../dominio/vehiculo';
import { useCatalogo, useMisVehiculos, useRutasGuardadas } from '../../hooks/consultas';
import s from './Home.module.css';

const CLAVE_FORMULARIO = 'evconnect.buscador';

interface Formulario {
  vehiculo: string; // 'u:<id>' (propio) o 'm:<id>' (catálogo)
  bateriaPct: number;
  modo: 'ubicacion' | 'ruta';
  origen: UbicacionElegida | null;
  destino: UbicacionElegida | null;
}

const INICIAL: Formulario = {
  vehiculo: '',
  bateriaPct: 45,
  modo: 'ubicacion',
  origen: null,
  destino: null,
};

function leerFormulario(): Formulario {
  try {
    const guardado = sessionStorage.getItem(CLAVE_FORMULARIO);
    return guardado ? { ...INICIAL, ...JSON.parse(guardado) } : INICIAL;
  } catch {
    return INICIAL;
  }
}

export function Home() {
  const { perfil } = useSesion();
  const navigate = useNavigate();
  const idVehiculo = useId();
  const idRuta = useId();
  const catalogo = useCatalogo();
  const misVehiculos = useMisVehiculos();
  const rutas = useRutasGuardadas();
  const [f, setF] = useState<Formulario>(leerFormulario);
  const [error, setError] = useState<string | null>(null);

  // El formulario se recuerda en la pestaña (al volver de los resultados sigue igual).
  useEffect(() => {
    try {
      sessionStorage.setItem(CLAVE_FORMULARIO, JSON.stringify(f));
    } catch {
      // sin almacenamiento: no es grave
    }
  }, [f]);

  const propios = useMemo(() => misVehiculos.data ?? [], [misVehiculos.data]);
  const modelos = useMemo(() => catalogo.data ?? [], [catalogo.data]);

  // Con sesión y sin elección previa, se preselecciona el primer vehículo propio (o el primero del catálogo).
  const vehiculoActual =
    f.vehiculo || (propios[0] ? `u:${propios[0].id}` : modelos[0] ? `m:${modelos[0].id}` : '');
  const datosVehiculo: ModeloVehiculo | undefined = vehiculoActual.startsWith('u:')
    ? propios.find((v) => v.id === vehiculoActual.slice(2))
    : modelos.find((m) => m.id === vehiculoActual.slice(2));

  const cambiar = (parcial: Partial<Formulario>) =>
    setF((anterior) => ({ ...anterior, ...parcial }));

  function buscar() {
    setError(null);
    if (!datosVehiculo) return setError('Elegí un vehículo.');
    if (!f.origen)
      return setError(f.modo === 'ruta' ? 'Indicá el origen.' : 'Indicá tu ubicación.');
    if (f.modo === 'ruta' && !f.destino) return setError('Indicá el destino.');

    const vehiculo: VehiculoBusqueda = vehiculoActual.startsWith('u:')
      ? { vehiculoUsuarioId: datosVehiculo.id }
      : { modeloId: datosVehiculo.id };
    const busqueda: Busqueda = {
      vehiculo,
      bateriaPct: f.bateriaPct,
      modo: f.modo,
      origen: { lat: f.origen.lat, lng: f.origen.lng },
      origenNombre: f.origen.nombre,
      ...(f.modo === 'ruta' && f.destino
        ? { destino: { lat: f.destino.lat, lng: f.destino.lng }, destinoNombre: f.destino.nombre }
        : {}),
    };
    // La vista principal de resultados es el mapa (D-042); la lista está a un toque.
    navigate(`/resultados/mapa?b=${codificarBusqueda(busqueda)}`);
  }

  return (
    <div className={s.pagina}>
      {perfil && (
        <p className={s.saludo}>
          Hola,
          <strong>{perfil.nombre.split(' ')[0]}</strong>
        </p>
      )}

      <section className={s.tarjeta} aria-labelledby="titulo-buscador">
        <h1 id="titulo-buscador" className={s.titulo}>
          ¿Dónde cargamos tu vehículo?
        </h1>

        <div className={s.grilla}>
          <div className={s.columna}>
            <div className={s.campo}>
              <label htmlFor={idVehiculo} className={s.etiqueta}>
                Tu vehículo
              </label>
              <select
                id={idVehiculo}
                className={claseControl}
                value={vehiculoActual}
                onChange={(e) => cambiar({ vehiculo: e.target.value })}
                disabled={catalogo.isPending}
              >
                {catalogo.isPending && <option value="">Cargando vehículos…</option>}
                {propios.length > 0 && (
                  <optgroup label="Mis vehículos">
                    {propios.map((v) => (
                      <option key={v.id} value={`u:${v.id}`}>
                        Mi {v.marca} {v.modelo} (guardado)
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Catálogo">
                  {modelos.map((m) => (
                    <option key={m.id} value={`m:${m.id}`}>
                      {m.marca} {m.modelo}
                    </option>
                  ))}
                </optgroup>
              </select>
              {!perfil && (
                <p className={s.ayuda}>
                  <Link to="/login?volver=%2Fvehiculos%2Fnuevo">Iniciá sesión</Link> para guardar tu
                  propio vehículo.
                </p>
              )}
            </div>
            {datosVehiculo?.fotoUrl && <FotoVehiculo vehiculo={datosVehiculo} tamano="mediana" />}
            {datosVehiculo && (
              <Chips
                items={[
                  {
                    icono: 'bateria',
                    valor: kwh(datosVehiculo.capacidadBateriaKwh),
                    nombre: 'Batería',
                  },
                  {
                    icono: 'velocimetro',
                    valor: `~${Math.round(autonomiaKm(datosVehiculo))} km`,
                    nombre: 'Autonomía',
                  },
                  {
                    icono: 'enchufe',
                    valor: nombreConector(datosVehiculo.tipoConector),
                    nombre: 'Conector',
                  },
                ]}
              />
            )}
            <p className={s.aviso}>Especificaciones aproximadas.</p>
          </div>

          <div className={s.columna}>
            <div className={s.campo}>
              <span className={s.etiqueta}>Buscar por</span>
              <Segmentado
                etiqueta="Buscar por"
                opciones={[
                  { valor: 'ubicacion', nombre: 'Ubicación' },
                  { valor: 'ruta', nombre: 'Ruta' },
                ]}
                valor={f.modo}
                onCambio={(modo) => cambiar({ modo })}
              />
            </div>

            {f.modo === 'ruta' && perfil && (rutas.data?.length ?? 0) > 0 && (
              <div className={s.campo}>
                <label htmlFor={idRuta} className={s.etiqueta}>
                  Usar una ruta guardada
                </label>
                <select
                  id={idRuta}
                  className={claseControl}
                  value=""
                  onChange={(e) => {
                    const r = rutas.data!.find((x) => x.id === e.target.value);
                    if (r) {
                      const [o, d] = r.nombre.split('→').map((t) => t.trim());
                      cambiar({
                        origen: { ...r.origen, nombre: o || 'Origen guardado' },
                        destino: { ...r.destino, nombre: d || 'Destino guardado' },
                      });
                    }
                  }}
                >
                  <option value="">Elegir…</option>
                  {rutas.data!.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.nombre}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <SelectorUbicacion
              etiqueta={f.modo === 'ruta' ? 'Origen' : 'Ubicación'}
              valor={f.origen}
              onCambio={(origen) => cambiar({ origen })}
            />
            {f.modo === 'ruta' && (
              <SelectorUbicacion
                etiqueta="Destino"
                valor={f.destino}
                onCambio={(destino) => cambiar({ destino })}
                cerca={f.origen}
              />
            )}
          </div>
        </div>

        <BateriaUrgencia
          bateriaPct={f.bateriaPct}
          onCambio={(bateriaPct) => cambiar({ bateriaPct })}
          vehiculo={datosVehiculo ?? null}
        />

        {error && (
          <Alerta>
            <p>{error}</p>
          </Alerta>
        )}
        {catalogo.isError && (
          <Alerta>
            <p>No se pudo cargar el catálogo de vehículos. ¿Está corriendo la API?</p>
          </Alerta>
        )}

        <Boton anchoCompleto onClick={buscar}>
          Buscar cargadores
        </Boton>
      </section>

      <nav className={s.accesos} aria-label="Accesos rápidos">
        <Link to="/vehiculos">
          <Icono nombre="auto" />
          Mis vehículos
        </Link>
        <Link to="/publicar">
          <Icono nombre="rayo" />
          Publicar cargador
        </Link>
        <Link to="/reservas">
          <Icono nombre="calendario" />
          Mis reservas
        </Link>
        <Link to="/favoritos">
          <Icono nombre="corazon" />
          Favoritos
        </Link>
      </nav>
    </div>
  );
}
