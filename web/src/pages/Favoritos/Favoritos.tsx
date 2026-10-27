// /favoritos — HU-011: pestañas "Cargadores" y "Rutas guardadas".
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import { apiFavoritos } from '../../api/endpoints';
import {
  Alerta,
  BotonIcono,
  Cabecera,
  Cargando,
  Icono,
  Segmentado,
  Tarjeta,
  Vacio,
} from '../../components/ui';
import { kw, nombreConector } from '../../dominio/formato';
import { useFavoritos, useRutasGuardadas } from '../../hooks/consultas';
import s from './Favoritos.module.css';

const CLAVE_FORMULARIO = 'evconnect.buscador';

export function Favoritos() {
  const [pestana, setPestana] = useState<'cargadores' | 'rutas'>('cargadores');
  return (
    <>
      <Cabecera titulo="Favoritos" volver="/" />
      <Segmentado
        pestanas
        etiqueta="Favoritos"
        opciones={[
          { valor: 'cargadores', nombre: 'Cargadores' },
          { valor: 'rutas', nombre: 'Rutas guardadas' },
        ]}
        valor={pestana}
        onCambio={setPestana}
      />
      <div className={s.contenido} role="tabpanel">
        {pestana === 'cargadores' ? <CargadoresFavoritos /> : <Rutas />}
      </div>
    </>
  );
}

function CargadoresFavoritos() {
  const queryClient = useQueryClient();
  const favoritos = useFavoritos();
  const quitar = useMutation({
    mutationFn: apiFavoritos.quitar,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favoritos'] }),
  });
  if (favoritos.isPending) return <Cargando />;
  if (favoritos.isError)
    return (
      <Alerta>
        <p>{mensajeDeError(favoritos.error)}</p>
      </Alerta>
    );
  if (favoritos.data.length === 0) {
    return (
      <Vacio titulo="Todavía no tenés cargadores favoritos" icono="corazon">
        <p>Tocá el corazón en el detalle de un cargador para guardarlo acá.</p>
      </Vacio>
    );
  }
  return (
    <ul className={s.lista}>
      {favoritos.data.map((c) => (
        <li key={c.id}>
          <Tarjeta>
            <div className={s.fila}>
              <Link to={`/cargadores/${c.id}`} className={s.enlace}>
                <h2 className={s.nombre}>{c.nombre}</h2>
                <p className={s.datos}>
                  {nombreConector(c.tipoConector)} · {kw(c.potenciaKw)}
                  {c.estado === 'inactivo' ? ' · no disponible' : ''}
                </p>
              </Link>
              <BotonIcono
                icono="corazon"
                etiqueta={`Quitar ${c.nombre} de favoritos`}
                className={s.corazon}
                onClick={() => quitar.mutate(c.id)}
              />
            </div>
          </Tarjeta>
        </li>
      ))}
    </ul>
  );
}

function Rutas() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const rutas = useRutasGuardadas();
  const borrar = useMutation({
    mutationFn: apiFavoritos.borrarRuta,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rutas-guardadas'] }),
  });
  if (rutas.isPending) return <Cargando />;
  if (rutas.isError)
    return (
      <Alerta>
        <p>{mensajeDeError(rutas.error)}</p>
      </Alerta>
    );
  if (rutas.data.length === 0) {
    return (
      <Vacio titulo="No tenés rutas guardadas" icono="ruta">
        <p>Después de buscar en modo Ruta, tocá “Guardar esta ruta”.</p>
      </Vacio>
    );
  }
  return (
    <ul className={s.lista}>
      {rutas.data.map((r) => (
        <li key={r.id}>
          <Tarjeta>
            <div className={s.fila}>
              <button
                type="button"
                className={s.enlace}
                onClick={() => {
                  // Precarga el buscador con esta ruta y lleva al Home.
                  const [o, d] = r.nombre.split('→').map((t) => t.trim());
                  try {
                    const actual = JSON.parse(sessionStorage.getItem(CLAVE_FORMULARIO) ?? '{}');
                    sessionStorage.setItem(
                      CLAVE_FORMULARIO,
                      JSON.stringify({
                        ...actual,
                        modo: 'ruta',
                        origen: { ...r.origen, nombre: o || 'Origen' },
                        destino: { ...r.destino, nombre: d || 'Destino' },
                      }),
                    );
                  } catch {
                    // sin almacenamiento: se abre el buscador vacío
                  }
                  navigate('/');
                }}
              >
                <h2 className={s.nombre}>
                  <Icono nombre="ruta" tamano={18} /> {r.nombre}
                </h2>
                <p className={s.datos}>Buscar cargadores en esta ruta</p>
              </button>
              <BotonIcono
                icono="basura"
                etiqueta={`Borrar la ruta ${r.nombre}`}
                onClick={() => borrar.mutate(r.id)}
              />
            </div>
          </Tarjeta>
        </li>
      ))}
    </ul>
  );
}
