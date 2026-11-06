// Favoritos (web/src/pages/Favoritos): pestañas "Cargadores" y "Rutas guardadas", con el CSS Module y los
// componentes reales.
import { BotonIcono, Cabecera, Icono, Segmentado, Tarjeta } from '../../../web/src/components/ui';
import { kw, nombreConector } from '../../../web/src/dominio/formato';
import fav from '../../../web/src/pages/Favoritos/Favoritos.module.css';
import { RUTAS_GUARDADAS } from '../datos/lugares';
import { RUTA_9, WALLBOX_GARCIA } from '../datos/recomendaciones';
import { MarcoApp } from './MarcoApp';

const FAVORITOS = [WALLBOX_GARCIA.cargador, RUTA_9.cargador];

export function PantallaFavoritos({ pestana }: { pestana: 'cargadores' | 'rutas' }) {
  return (
    <MarcoApp seccion="favoritos">
      <Cabecera titulo="Favoritos" volver="/" />
      <Segmentado
        pestanas
        etiqueta="Favoritos"
        opciones={[
          { valor: 'cargadores', nombre: 'Cargadores' },
          { valor: 'rutas', nombre: 'Rutas guardadas' },
        ]}
        valor={pestana}
        onCambio={() => undefined}
      />
      <div className={fav.contenido} role="tabpanel">
        <ul className={fav.lista}>
          {pestana === 'cargadores'
            ? FAVORITOS.map((c) => (
                <li key={c.id}>
                  <Tarjeta>
                    <div className={fav.fila}>
                      <span className={fav.enlace}>
                        <h2 className={fav.nombre}>{c.nombre}</h2>
                        <p className={fav.datos}>
                          {nombreConector(c.tipoConector)} · {kw(c.potenciaKw)}
                        </p>
                      </span>
                      <BotonIcono
                        icono="corazon"
                        etiqueta={`Quitar ${c.nombre} de favoritos`}
                        className={fav.corazon}
                      />
                    </div>
                  </Tarjeta>
                </li>
              ))
            : RUTAS_GUARDADAS.map((r) => (
                <li key={r}>
                  <Tarjeta>
                    <div className={fav.fila}>
                      <span className={fav.enlace}>
                        <h2 className={fav.nombre}>
                          <Icono nombre="ruta" tamano={18} /> {r}
                        </h2>
                        <p className={fav.datos}>Buscar cargadores en esta ruta</p>
                      </span>
                      <BotonIcono icono="basura" etiqueta={`Borrar la ruta ${r}`} />
                    </div>
                  </Tarjeta>
                </li>
              ))}
        </ul>
      </div>
    </MarcoApp>
  );
}
