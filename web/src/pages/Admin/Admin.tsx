// /admin (P2) — usuarios (habilitar/deshabilitar, rol en modo local), moderación de cargadores y catálogo.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { mensajeDeError } from '../../api/cliente';
import { apiAdmin, apiCargadores } from '../../api/endpoints';
import type { DatosVehiculo, ModeloVehiculo, Rol, TipoConector } from '../../api/tipos';
import { FotoVehiculo } from '../../components/Vehiculo/FotoVehiculo';
import { useSesion } from '../../auth/Sesion';
import {
  Alerta,
  Boton,
  Cabecera,
  Campo,
  Cargando,
  claseControl,
  Insignia,
  Segmentado,
} from '../../components/ui';
import { CONECTORES_OPCIONES, kw, nombreConector } from '../../dominio/formato';
import { useCatalogo } from '../../hooks/consultas';
import s from './Admin.module.css';

export function Admin() {
  const [pestana, setPestana] = useState<'usuarios' | 'cargadores' | 'catalogo'>('usuarios');
  return (
    <>
      <Cabecera titulo="Administración" volver="/" />
      <Segmentado
        pestanas
        etiqueta="Secciones de administración"
        opciones={[
          { valor: 'usuarios', nombre: 'Usuarios' },
          { valor: 'cargadores', nombre: 'Cargadores' },
          { valor: 'catalogo', nombre: 'Catálogo' },
        ]}
        valor={pestana}
        onCambio={setPestana}
      />
      <div className={s.panel} role="tabpanel">
        {pestana === 'usuarios' && <Usuarios />}
        {pestana === 'cargadores' && <Cargadores />}
        {pestana === 'catalogo' && <Catalogo />}
      </div>
    </>
  );
}

function Usuarios() {
  const { perfil, modo } = useSesion();
  const queryClient = useQueryClient();
  const [q, setQ] = useState('');
  const usuarios = useQuery({
    queryKey: ['admin', 'usuarios', q],
    queryFn: () => apiAdmin.usuarios(q),
  });
  const editar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: { activo?: boolean; rol?: Rol } }) =>
      apiAdmin.editarUsuario(id, cambios),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'usuarios'] }),
  });

  return (
    <>
      <Campo etiqueta="Buscar por nombre o correo">
        {(p) => (
          <input
            {...p}
            className={claseControl}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        )}
      </Campo>
      {editar.isError && (
        <Alerta>
          <p>{mensajeDeError(editar.error)}</p>
        </Alerta>
      )}
      {usuarios.isPending && <Cargando />}
      <div className={s.tablaContenedor}>
        <table className={s.tabla}>
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Correo</th>
              <th scope="col">Rol</th>
              <th scope="col">Estado</th>
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {usuarios.data?.items.map((u) => (
              <tr key={u.id}>
                <td>{u.nombre}</td>
                <td>{u.email}</td>
                <td>
                  {modo === 'local' && u.rol && u.id !== perfil?.id ? (
                    <select
                      aria-label={`Rol de ${u.nombre}`}
                      className={s.selectChico}
                      value={u.rol}
                      onChange={(e) =>
                        editar.mutate({ id: u.id, cambios: { rol: e.target.value as Rol } })
                      }
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  ) : (
                    (u.rol ?? '—')
                  )}
                </td>
                <td>
                  <Insignia tono={u.activo ? 'exito' : 'atenuado'}>
                    {u.activo ? 'Activo' : 'Deshabilitado'}
                  </Insignia>
                </td>
                <td>
                  {u.id !== perfil?.id && (
                    <Boton
                      chico
                      variante="secundario"
                      onClick={() => editar.mutate({ id: u.id, cambios: { activo: !u.activo } })}
                    >
                      {u.activo ? 'Deshabilitar' : 'Habilitar'}
                    </Boton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modo === 'cognito' && (
        <p className={s.nota}>En modo Cognito el rol se asigna con los grupos del User Pool.</p>
      )}
    </>
  );
}

function Cargadores() {
  const queryClient = useQueryClient();
  const red = useQuery({ queryKey: ['admin', 'cargadores'], queryFn: apiCargadores.red });
  const moderar = useMutation({
    mutationFn: (id: string) => apiCargadores.moderar(id, 'inactivo'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'cargadores'] }),
  });
  if (red.isPending) return <Cargando />;
  return (
    <>
      <p className={s.nota}>
        Cargadores activos de la red. Desactivar uno lo quita de búsquedas y del mapa.
      </p>
      {moderar.isError && (
        <Alerta>
          <p>{mensajeDeError(moderar.error)}</p>
        </Alerta>
      )}
      <ul className={s.lista}>
        {red.data?.items.map((c) => (
          <li key={c.id}>
            <span>
              <strong>{c.nombre}</strong> · {c.tipo === 'publico' ? 'Público' : 'Privado'} ·{' '}
              {nombreConector(c.tipoConector)} · {kw(c.potenciaKw)}
            </span>
            <Boton
              chico
              variante="secundario"
              onClick={() => {
                if (window.confirm(`¿Desactivar ${c.nombre}?`)) moderar.mutate(c.id);
              }}
            >
              Desactivar
            </Boton>
          </li>
        ))}
      </ul>
    </>
  );
}

const MODELO_VACIO = {
  marca: '',
  modelo: '',
  capacidadBateriaKwh: '',
  consumoKwhPor100km: '',
  tipoConector: 'CCS_COMBO',
  potenciaMaxAcKw: '',
  potenciaMaxDcKw: '',
};

/** Subir, reemplazar o quitar la foto de un modelo (D-047). */
function FotoModelo({ modelo, alCambiar }: { modelo: ModeloVehiculo; alCambiar: () => void }) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [credito, setCredito] = useState('');
  const [fuente, setFuente] = useState('');
  const nombre = `${modelo.marca} ${modelo.modelo}`;
  const subir = useMutation({
    mutationFn: () =>
      apiAdmin.subirFotoModelo(
        modelo.id,
        archivo!,
        credito.trim() || undefined,
        fuente.trim() || undefined,
      ),
    onSuccess: () => {
      setArchivo(null);
      setCredito('');
      setFuente('');
      alCambiar();
    },
  });
  const quitar = useMutation({
    mutationFn: () => apiAdmin.eliminarFotoModelo(modelo.id),
    onSuccess: alCambiar,
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    if (archivo) subir.mutate();
  }

  return (
    <details className={s.fotoModelo}>
      <summary>{modelo.fotoUrl ? 'Cambiar foto' : 'Agregar foto'}</summary>
      <form className={s.formularioFoto} onSubmit={enviar}>
        {modelo.fotoCredito && <p className={s.ayuda}>Actual: {modelo.fotoCredito}</p>}
        <Campo etiqueta={`Imagen de ${nombre} (JPEG, PNG o WebP, hasta 2 MB)`}>
          {(p) => (
            <input
              {...p}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          )}
        </Campo>
        <Campo etiqueta="Crédito (autor y licencia)">
          {(p) => (
            <input
              {...p}
              className={claseControl}
              maxLength={300}
              placeholder="Foto: Autor · CC BY-SA 4.0 · Wikimedia Commons"
              value={credito}
              onChange={(e) => setCredito(e.target.value)}
            />
          )}
        </Campo>
        <Campo etiqueta="Enlace a la fuente (opcional)">
          {(p) => (
            <input
              {...p}
              className={claseControl}
              type="url"
              maxLength={500}
              value={fuente}
              onChange={(e) => setFuente(e.target.value)}
            />
          )}
        </Campo>
        <p className={s.ayuda}>Usá solo imágenes propias o con licencia que permita publicarlas.</p>
        {(subir.isError || quitar.isError) && (
          <Alerta>
            <p>{mensajeDeError(subir.error ?? quitar.error)}</p>
          </Alerta>
        )}
        <div className={s.accionesFoto}>
          <Boton type="submit" chico cargando={subir.isPending} disabled={!archivo}>
            Subir foto
          </Boton>
          {modelo.fotoUrl && (
            <Boton
              chico
              variante="texto"
              cargando={quitar.isPending}
              onClick={() => window.confirm(`¿Quitar la foto de ${nombre}?`) && quitar.mutate()}
            >
              Quitar foto
            </Boton>
          )}
        </div>
      </form>
    </details>
  );
}

function Catalogo() {
  const queryClient = useQueryClient();
  const catalogo = useCatalogo();
  const [m, setM] = useState(MODELO_VACIO);
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['catalogo'] });
  const crear = useMutation({
    mutationFn: () =>
      apiAdmin.crearModelo({
        marca: m.marca.trim(),
        modelo: m.modelo.trim(),
        capacidadBateriaKwh: Number(m.capacidadBateriaKwh),
        consumoKwhPor100km: Number(m.consumoKwhPor100km),
        tipoConector: m.tipoConector as TipoConector,
        potenciaMaxAcKw: Number(m.potenciaMaxAcKw),
        potenciaMaxDcKw: m.potenciaMaxDcKw ? Number(m.potenciaMaxDcKw) : null,
      } satisfies DatosVehiculo),
    onSuccess: () => {
      setM(MODELO_VACIO);
      void refrescar();
    },
  });
  const eliminar = useMutation({ mutationFn: apiAdmin.eliminarModelo, onSuccess: refrescar });

  function enviar(e: FormEvent) {
    e.preventDefault();
    crear.mutate();
  }
  const texto = (
    campo: keyof typeof MODELO_VACIO,
    etiqueta: string,
    numero = true,
    requerido = true,
  ) => (
    <Campo etiqueta={etiqueta}>
      {(p) => (
        <input
          {...p}
          className={claseControl}
          type={numero ? 'number' : 'text'}
          step="0.1"
          min={numero ? 0.1 : undefined}
          required={requerido}
          value={m[campo]}
          onChange={(e) => setM({ ...m, [campo]: e.target.value })}
        />
      )}
    </Campo>
  );

  return (
    <>
      {(crear.isError || eliminar.isError) && (
        <Alerta>
          <p>{mensajeDeError(crear.error ?? eliminar.error)}</p>
        </Alerta>
      )}
      <ul className={s.lista}>
        {catalogo.data?.map((x) => (
          <li key={x.id} className={s.itemModelo}>
            <FotoVehiculo vehiculo={x} tamano="miniatura" sinCredito />
            <span className={s.textoModelo}>
              <strong>
                {x.marca} {x.modelo}
              </strong>{' '}
              · {x.capacidadBateriaKwh} kWh · {nombreConector(x.tipoConector)}
            </span>
            <FotoModelo modelo={x} alCambiar={refrescar} />
            <Boton
              chico
              variante="texto"
              onClick={() =>
                window.confirm(`¿Eliminar ${x.marca} ${x.modelo}?`) && eliminar.mutate(x.id)
              }
            >
              Eliminar
            </Boton>
          </li>
        ))}
      </ul>
      <form className={s.formulario} onSubmit={enviar}>
        <h2 className={s.subtitulo}>Agregar modelo</h2>
        {texto('marca', 'Marca', false)}
        {texto('modelo', 'Modelo', false)}
        {texto('capacidadBateriaKwh', 'Batería (kWh)')}
        {texto('consumoKwhPor100km', 'Consumo (kWh/100 km)')}
        <Campo etiqueta="Conector">
          {(p) => (
            <select
              {...p}
              className={claseControl}
              value={m.tipoConector}
              onChange={(e) => setM({ ...m, tipoConector: e.target.value })}
            >
              {CONECTORES_OPCIONES.map((c) => (
                <option key={c.valor} value={c.valor}>
                  {c.nombre}
                </option>
              ))}
            </select>
          )}
        </Campo>
        {texto('potenciaMaxAcKw', 'Potencia máxima AC (kW)')}
        {texto('potenciaMaxDcKw', 'Potencia máxima DC (kW)', true, m.tipoConector !== 'TIPO_2')}
        <Boton type="submit" cargando={crear.isPending}>
          Agregar al catálogo
        </Boton>
      </form>
    </>
  );
}
