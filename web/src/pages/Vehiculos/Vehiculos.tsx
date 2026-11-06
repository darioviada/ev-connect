// /vehiculos, /vehiculos/:id, /vehiculos/nuevo, /vehiculos/:id/editar — HU-003.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import { apiVehiculos } from '../../api/endpoints';
import type { DatosVehiculo, TipoConector } from '../../api/tipos';
import {
  Alerta,
  Boton,
  Cabecera,
  Campo,
  Cargando,
  Chips,
  claseControl,
  EnlaceBoton,
  Segmentado,
  TarjetaEnlace,
  Vacio,
} from '../../components/ui';
import { CONECTORES_OPCIONES, kwh, nombreConector } from '../../dominio/formato';
import { autonomiaKm } from '../../dominio/vehiculo';
import { useCatalogo, useMisVehiculos } from '../../hooks/consultas';
import { FotoVehiculo } from '../../components/Vehiculo/FotoVehiculo';
import s from './Vehiculos.module.css';

const chipsDe = (v: DatosVehiculo) => [
  { icono: 'bateria' as const, valor: kwh(v.capacidadBateriaKwh), nombre: 'Batería' },
  {
    icono: 'velocimetro' as const,
    valor: `~${Math.round(autonomiaKm(v))} km`,
    nombre: 'Autonomía',
  },
  { icono: 'enchufe' as const, valor: nombreConector(v.tipoConector), nombre: 'Conector' },
];

export function Vehiculos() {
  const vehiculos = useMisVehiculos();
  return (
    <>
      <Cabecera
        titulo="Mis vehículos"
        accion={<EnlaceBoton a="/vehiculos/nuevo">Agregar</EnlaceBoton>}
      />
      {vehiculos.isPending && <Cargando />}
      {vehiculos.isError && (
        <Alerta>
          <p>{mensajeDeError(vehiculos.error)}</p>
        </Alerta>
      )}
      {vehiculos.data?.length === 0 && (
        <Vacio titulo="Todavía no guardaste vehículos" icono="auto">
          <p>Guardalo para buscar más rápido.</p>
          <EnlaceBoton a="/vehiculos/nuevo">Agregar vehículo</EnlaceBoton>
        </Vacio>
      )}
      <ul className={s.lista}>
        {vehiculos.data?.map((v) => (
          <li key={v.id}>
            <TarjetaEnlace a={`/vehiculos/${v.id}`}>
              <div className={s.fila}>
                <FotoVehiculo vehiculo={v} tamano="miniatura" sinCredito />
                <div>
                  <h2 className={s.nombre}>
                    {v.marca} {v.modelo}
                  </h2>
                  <p className={s.datos}>
                    {kwh(v.capacidadBateriaKwh)} · ~{Math.round(autonomiaKm(v))} km ·{' '}
                    {nombreConector(v.tipoConector)}
                    {v.personalizado ? ' · cargado por vos' : ''}
                  </p>
                </div>
              </div>
            </TarjetaEnlace>
          </li>
        ))}
      </ul>
    </>
  );
}

export function VehiculoDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const vehiculos = useMisVehiculos();
  const v = vehiculos.data?.find((x) => x.id === id);
  const eliminar = useMutation({
    mutationFn: () => apiVehiculos.eliminar(id!),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mis-vehiculos'] });
      navigate('/vehiculos');
    },
  });

  if (vehiculos.isPending) return <Cargando />;
  if (!v) return <Vacio titulo="No encontramos ese vehículo" icono="auto" />;

  return (
    <div className={s.detalle}>
      <Cabecera titulo="Detalle del vehículo" volver="/vehiculos" />
      <FotoVehiculo vehiculo={v} />
      <div className={s.tarjetaModelo}>
        <h2 className={s.nombre}>
          {v.marca} {v.modelo}
        </h2>
        <p className={s.datos}>
          {v.personalizado ? 'Cargado por vos' : 'Del catálogo · especificaciones aproximadas'}
        </p>
      </div>
      <Chips items={chipsDe(v)} />
      <p className={s.datos}>
        Consumo {v.consumoKwhPor100km} kWh/100 km · AC hasta {v.potenciaMaxAcKw} kW ·{' '}
        {v.potenciaMaxDcKw ? `DC hasta ${v.potenciaMaxDcKw} kW` : 'sin carga rápida DC'}
      </p>
      {eliminar.isError && (
        <Alerta>
          <p>{mensajeDeError(eliminar.error)}</p>
        </Alerta>
      )}
      <div className={s.acciones}>
        <EnlaceBoton a={`/vehiculos/${v.id}/editar`} variante="secundario" anchoCompleto>
          Editar
        </EnlaceBoton>
        <Boton
          variante="peligro"
          anchoCompleto
          cargando={eliminar.isPending}
          onClick={() => {
            if (window.confirm(`¿Eliminar ${v.marca} ${v.modelo}?`)) eliminar.mutate();
          }}
        >
          − Eliminar vehículo
        </Boton>
      </div>
    </div>
  );
}

const VACIO: Record<keyof DatosVehiculo, string> = {
  marca: '',
  modelo: '',
  capacidadBateriaKwh: '',
  consumoKwhPor100km: '',
  tipoConector: 'CCS_COMBO',
  potenciaMaxAcKw: '',
  potenciaMaxDcKw: '',
};

export function VehiculoFormulario() {
  const { id } = useParams();
  const editando = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const catalogo = useCatalogo();
  const misVehiculos = useMisVehiculos();
  const actual = misVehiculos.data?.find((x) => x.id === id);
  const idModelo = useId();

  const [origen, setOrigen] = useState<'catalogo' | 'propio' | null>(null);
  const [modeloId, setModeloId] = useState<string | null>(null);
  const [propio, setPropio] = useState<Record<keyof DatosVehiculo, string> | null>(null);

  // Valores efectivos (al editar, parte de los datos actuales)
  const modo = origen ?? (actual?.personalizado ? 'propio' : 'catalogo');
  const modeloElegido = modeloId ?? actual?.modeloId ?? '';
  const datosPropios =
    propio ??
    (actual?.personalizado
      ? (Object.fromEntries(
          Object.keys(VACIO).map((k) => [k, String(actual[k as keyof DatosVehiculo] ?? '')]),
        ) as Record<keyof DatosVehiculo, string>)
      : VACIO);
  const modelo = catalogo.data?.find((m) => m.id === modeloElegido);

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo =
        modo === 'catalogo'
          ? { modeloId: modeloElegido }
          : {
              personalizado: {
                marca: datosPropios.marca.trim(),
                modelo: datosPropios.modelo.trim(),
                capacidadBateriaKwh: Number(datosPropios.capacidadBateriaKwh),
                consumoKwhPor100km: Number(datosPropios.consumoKwhPor100km),
                tipoConector: datosPropios.tipoConector as TipoConector,
                potenciaMaxAcKw: Number(datosPropios.potenciaMaxAcKw),
                potenciaMaxDcKw: datosPropios.potenciaMaxDcKw
                  ? Number(datosPropios.potenciaMaxDcKw)
                  : null,
              },
            };
      return editando ? apiVehiculos.editar(id!, cuerpo) : apiVehiculos.crear(cuerpo);
    },
    onSuccess: async (v) => {
      await queryClient.invalidateQueries({ queryKey: ['mis-vehiculos'] });
      navigate(`/vehiculos/${v.id}`);
    },
  });

  if (editando && misVehiculos.isPending) return <Cargando />;

  const cambiarPropio = (campo: keyof DatosVehiculo, valor: string) =>
    setPropio({ ...datosPropios, [campo]: valor });

  function enviar(e: FormEvent) {
    e.preventDefault();
    guardar.mutate();
  }

  const numero = (
    campo: keyof DatosVehiculo,
    etiqueta: string,
    opciones: { min?: number; step?: string; requerido?: boolean } = {},
  ) => (
    <Campo etiqueta={etiqueta}>
      {(p) => (
        <input
          {...p}
          type="number"
          inputMode="decimal"
          className={claseControl}
          min={opciones.min ?? 0.1}
          step={opciones.step ?? '0.1'}
          required={opciones.requerido ?? true}
          value={datosPropios[campo]}
          onChange={(e) => cambiarPropio(campo, e.target.value)}
        />
      )}
    </Campo>
  );

  return (
    <form className={s.formulario} onSubmit={enviar}>
      <Cabecera
        titulo={editando ? 'Editar vehículo' : 'Agregar vehículo'}
        volver={editando ? `/vehiculos/${id}` : '/vehiculos'}
      />
      <Segmentado
        etiqueta="Origen de los datos"
        opciones={[
          { valor: 'catalogo', nombre: 'Elegir del catálogo' },
          { valor: 'propio', nombre: 'Cargar el mío' },
        ]}
        valor={modo}
        onCambio={setOrigen}
      />

      {modo === 'catalogo' ? (
        <>
          <div className={s.campo}>
            <label htmlFor={idModelo} className={s.etiqueta}>
              Modelo
            </label>
            <select
              id={idModelo}
              className={claseControl}
              required
              value={modeloElegido}
              onChange={(e) => setModeloId(e.target.value)}
            >
              <option value="">Elegí un modelo…</option>
              {catalogo.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.marca} {m.modelo}
                </option>
              ))}
            </select>
          </div>
          <span className={s.etiqueta}>Batería, consumo y conector</span>
          {modelo ? (
            <Chips items={chipsDe(modelo)} />
          ) : (
            <p className={s.placeholder}>Se completan automáticamente al elegir el modelo</p>
          )}
        </>
      ) : (
        <div className={s.grilla}>
          <Campo etiqueta="Marca">
            {(p) => (
              <input
                {...p}
                className={claseControl}
                required
                maxLength={60}
                value={datosPropios.marca}
                onChange={(e) => cambiarPropio('marca', e.target.value)}
              />
            )}
          </Campo>
          <Campo etiqueta="Modelo">
            {(p) => (
              <input
                {...p}
                className={claseControl}
                required
                maxLength={80}
                value={datosPropios.modelo}
                onChange={(e) => cambiarPropio('modelo', e.target.value)}
              />
            )}
          </Campo>
          {numero('capacidadBateriaKwh', 'Batería (kWh)')}
          {numero('consumoKwhPor100km', 'Consumo (kWh/100 km)')}
          <Campo etiqueta="Conector">
            {(p) => (
              <select
                {...p}
                className={claseControl}
                value={datosPropios.tipoConector}
                onChange={(e) => cambiarPropio('tipoConector', e.target.value)}
              >
                {CONECTORES_OPCIONES.map((c) => (
                  <option key={c.valor} value={c.valor}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            )}
          </Campo>
          {numero('potenciaMaxAcKw', 'Potencia máxima AC (kW)')}
          {numero('potenciaMaxDcKw', 'Potencia máxima DC (kW)', {
            requerido: datosPropios.tipoConector !== 'TIPO_2',
          })}
        </div>
      )}

      {guardar.isError && (
        <Alerta>
          <p>{mensajeDeError(guardar.error)}</p>
        </Alerta>
      )}
      <Boton type="submit" anchoCompleto cargando={guardar.isPending}>
        Guardar vehículo
      </Boton>
    </form>
  );
}
