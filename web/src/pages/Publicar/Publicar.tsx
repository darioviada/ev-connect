// /publicar y /mis-cargadores/:id/editar — HU-004: ubicación (clic en el mapa o búsqueda), conector,
// potencia, precio por kWh y franjas de disponibilidad.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lazy, Suspense, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import { apiCargadores } from '../../api/endpoints';
import type { DiaSemana, Franja, LatLng } from '../../api/tipos';
import { useSesion } from '../../auth/Sesion';
import { SelectorUbicacion } from '../../components/Buscador/SelectorUbicacion';
import {
  Alerta,
  Boton,
  BotonIcono,
  Cabecera,
  Campo,
  Cargando,
  claseControl,
} from '../../components/ui';
import { CONECTORES_OPCIONES, DIAS_OPCIONES } from '../../dominio/formato';
import s from './Publicar.module.css';

const MapaSelector = lazy(() => import('../../components/Buscador/MapaSelector'));

export function Publicar() {
  const { id } = useParams();
  const existente = useQuery({
    queryKey: ['cargador', id],
    queryFn: () => apiCargadores.detalle(id!),
    enabled: Boolean(id),
  });
  if (id && existente.isPending) return <Cargando />;
  if (id && existente.isError) {
    return (
      <Alerta>
        <p>{mensajeDeError(existente.error)}</p>
      </Alerta>
    );
  }
  // `key` reinicia el formulario si cambia el cargador editado
  return <FormularioCargador key={id ?? 'nuevo'} inicial={existente.data} />;
}

function FormularioCargador({
  inicial,
}: {
  inicial?: Awaited<ReturnType<typeof apiCargadores.detalle>>;
}) {
  const editando = Boolean(inicial);
  const { perfil } = useSesion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [direccion, setDireccion] = useState(inicial?.direccion ?? '');
  const [ubicacion, setUbicacion] = useState<(LatLng & { nombre: string }) | null>(
    inicial ? { ...inicial.ubicacion, nombre: 'Ubicación actual' } : null,
  );
  const [conector, setConector] = useState<string>(inicial?.tipoConector ?? 'TIPO_2');
  const [potencia, setPotencia] = useState(inicial ? String(inicial.potenciaKw) : '');
  const [precio, setPrecio] = useState(inicial ? String(inicial.precioKwh) : '');
  const [tipo, setTipo] = useState<'privado' | 'publico'>(inicial?.tipo ?? 'privado');
  const [todoElDia, setTodoElDia] = useState(inicial ? inicial.disponibilidad.length === 0 : false);
  const [franjas, setFranjas] = useState<Franja[]>(
    inicial?.disponibilidad.length
      ? inicial.disponibilidad
      : [{ dia: 'lunes', horaInicio: '08:00', horaFin: '20:00' }],
  );
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const guardar = useMutation({
    mutationFn: async () => {
      const datos = {
        nombre: nombre.trim(),
        direccion: direccion.trim() || null,
        ubicacion: { lat: ubicacion!.lat, lng: ubicacion!.lng },
        tipoConector: conector,
        potenciaKw: Number(potencia),
        precioKwh: Number(precio),
      };
      const disponibilidad = todoElDia ? [] : franjas;
      if (inicial) {
        await apiCargadores.editar(inicial.id, datos);
        return apiCargadores.disponibilidad(inicial.id, disponibilidad);
      }
      return apiCargadores.publicar({
        ...datos,
        disponibilidad,
        ...(perfil?.rol === 'admin' ? { tipo } : {}),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mis-cargadores'] });
      await queryClient.invalidateQueries({ queryKey: ['cargador'] });
      navigate('/mis-cargadores');
    },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    setErrorLocal(null);
    if (!ubicacion)
      return setErrorLocal('Marcá la ubicación del cargador en el mapa o buscala por dirección.');
    if (!todoElDia && franjas.length === 0)
      return setErrorLocal('Agregá al menos una franja o marcá “Disponible 24/7”.');
    guardar.mutate();
  }

  const cambiarFranja = (i: number, cambio: Partial<Franja>) =>
    setFranjas(franjas.map((f, j) => (j === i ? { ...f, ...cambio } : f)));

  return (
    <form className={s.formulario} onSubmit={enviar}>
      <Cabecera
        titulo={editando ? 'Editar cargador' : 'Publicar cargador'}
        volver={editando ? '/mis-cargadores' : '/'}
      />

      <Campo etiqueta="Nombre" ayuda="Por ejemplo: “Cochera de Ana”.">
        {(p) => (
          <input
            {...p}
            className={claseControl}
            required
            maxLength={80}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
        )}
      </Campo>
      <Campo etiqueta="Dirección" ayuda="Se muestra a quien reserve. Opcional.">
        {(p) => (
          <input
            {...p}
            className={claseControl}
            placeholder="Dirección del cargador"
            maxLength={200}
            value={direccion}
            onChange={(e) => setDireccion(e.target.value)}
          />
        )}
      </Campo>

      <SelectorUbicacion etiqueta="Ubicación" valor={ubicacion} onCambio={setUbicacion} />
      {!ubicacion && (
        <Suspense fallback={null}>
          <MapaSelector
            valor={null}
            onElegir={(p) => setUbicacion({ ...p, nombre: 'Punto elegido en el mapa' })}
          />
        </Suspense>
      )}

      <div className={s.grilla}>
        <Campo etiqueta="Tipo de conector">
          {(p) => (
            <select
              {...p}
              className={claseControl}
              value={conector}
              onChange={(e) => setConector(e.target.value)}
            >
              {CONECTORES_OPCIONES.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Potencia (kW)">
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="decimal"
              min={0.1}
              max={400}
              step="0.1"
              placeholder="Ej: 22"
              className={claseControl}
              required
              value={potencia}
              onChange={(e) => setPotencia(e.target.value)}
            />
          )}
        </Campo>
        <Campo etiqueta="Precio por kWh (ARS)">
          {(p) => (
            <input
              {...p}
              type="number"
              inputMode="decimal"
              min={0}
              step="1"
              placeholder="Ej: 350"
              className={claseControl}
              required
              value={precio}
              onChange={(e) => setPrecio(e.target.value)}
            />
          )}
        </Campo>
        {perfil?.rol === 'admin' && !editando && (
          <Campo etiqueta="Tipo de cargador">
            {(p) => (
              <select
                {...p}
                className={claseControl}
                value={tipo}
                onChange={(e) => setTipo(e.target.value as 'privado' | 'publico')}
              >
                <option value="privado">Privado (propio)</option>
                <option value="publico">Público</option>
              </select>
            )}
          </Campo>
        )}
      </div>

      <fieldset className={s.franjas}>
        <legend>Disponibilidad horaria</legend>
        <label className={s.check}>
          <input
            type="checkbox"
            checked={todoElDia}
            onChange={(e) => setTodoElDia(e.target.checked)}
          />
          Disponible 24/7
        </label>
        {!todoElDia && (
          <>
            {franjas.map((f, i) => (
              <div key={i} className={s.franja}>
                <Campo etiqueta="Día">
                  {(p) => (
                    <select
                      {...p}
                      className={claseControl}
                      value={f.dia}
                      onChange={(e) => cambiarFranja(i, { dia: e.target.value as DiaSemana })}
                    >
                      {DIAS_OPCIONES.map((d) => (
                        <option key={d.valor} value={d.valor}>
                          {d.nombre}
                        </option>
                      ))}
                    </select>
                  )}
                </Campo>
                <Campo etiqueta="Desde">
                  {(p) => (
                    <input
                      {...p}
                      type="time"
                      className={claseControl}
                      required
                      value={f.horaInicio}
                      onChange={(e) => cambiarFranja(i, { horaInicio: e.target.value })}
                    />
                  )}
                </Campo>
                <Campo etiqueta="Hasta">
                  {(p) => (
                    <input
                      {...p}
                      type="time"
                      className={claseControl}
                      required
                      value={f.horaFin}
                      onChange={(e) => cambiarFranja(i, { horaFin: e.target.value })}
                    />
                  )}
                </Campo>
                <BotonIcono
                  icono="basura"
                  etiqueta={`Quitar franja ${i + 1}`}
                  onClick={() => setFranjas(franjas.filter((_, j) => j !== i))}
                />
              </div>
            ))}
            <div className={s.botonesFranja}>
              <Boton
                variante="secundario"
                chico
                icono="mas"
                onClick={() =>
                  setFranjas([...franjas, { dia: 'lunes', horaInicio: '08:00', horaFin: '20:00' }])
                }
              >
                Agregar franja
              </Boton>
              <Boton
                variante="texto"
                chico
                onClick={() => {
                  const base = franjas[0] ?? { horaInicio: '08:00', horaFin: '20:00' };
                  setFranjas(
                    DIAS_OPCIONES.map((d) => ({
                      dia: d.valor as DiaSemana,
                      horaInicio: base.horaInicio,
                      horaFin: base.horaFin,
                    })),
                  );
                }}
              >
                Mismo horario todos los días
              </Boton>
            </div>
          </>
        )}
      </fieldset>

      {(errorLocal || guardar.isError) && (
        <Alerta>
          <p>{errorLocal ?? mensajeDeError(guardar.error)}</p>
        </Alerta>
      )}
      <Boton type="submit" anchoCompleto cargando={guardar.isPending}>
        {editando ? 'Guardar cambios' : 'Publicar'}
      </Boton>
    </form>
  );
}
