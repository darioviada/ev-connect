// Componentes base de la interfaz (sin kit de UI). Accesibilidad: label asociado a cada control,
// foco visible (global.css), aria-label en botones de solo ícono.
import { useId, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { Icono, type NombreIcono } from './Icono';
import s from './ui.module.css';

export { Icono, type NombreIcono } from './Icono';

const cx = (...clases: (string | false | undefined | null)[]) => clases.filter(Boolean).join(' ');

type Variante = 'primario' | 'secundario' | 'contorno' | 'peligro' | 'texto';

export function Boton({
  variante = 'primario',
  anchoCompleto,
  chico,
  cargando,
  icono,
  children,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  anchoCompleto?: boolean;
  chico?: boolean;
  cargando?: boolean;
  icono?: NombreIcono;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || cargando}
      aria-busy={cargando || undefined}
      className={cx(
        s.boton,
        s[variante],
        anchoCompleto && s.anchoCompleto,
        chico && s.chico,
        className,
      )}
    >
      {icono && <Icono nombre={icono} tamano={18} />}
      {cargando ? 'Un momento…' : children}
    </button>
  );
}

export function EnlaceBoton({
  a,
  variante = 'primario',
  anchoCompleto,
  children,
}: {
  a: string;
  variante?: Variante;
  anchoCompleto?: boolean;
  children: ReactNode;
}) {
  return (
    <Link to={a} className={cx(s.boton, s[variante], anchoCompleto && s.anchoCompleto)}>
      {children}
    </Link>
  );
}

export function BotonIcono({
  icono,
  etiqueta,
  suave,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icono: NombreIcono;
  etiqueta: string;
  suave?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      aria-label={etiqueta}
      title={etiqueta}
      className={cx(s.botonIcono, suave && s.botonIconoSuave, props.className)}
    >
      <Icono nombre={icono} />
    </button>
  );
}

/** Campo con etiqueta asociada. `children` recibe el id para el control. */
export function Campo({
  etiqueta,
  ayuda,
  error,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }) => ReactNode;
}) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  return (
    <div className={s.campo}>
      <label htmlFor={id} className={s.etiqueta}>
        {etiqueta}
      </label>
      {children({
        id,
        ...(ayuda || error ? { 'aria-describedby': idAyuda } : {}),
        ...(error ? { 'aria-invalid': true } : {}),
      })}
      {error ? (
        <p id={idAyuda} className={s.errorCampo} role="alert">
          {error}
        </p>
      ) : (
        ayuda && (
          <p id={idAyuda} className={s.ayuda}>
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}

export const claseControl = s.control;

/** Grupo de opciones excluyentes (Ubicación/Ruta) o pestañas. */
export function Segmentado<T extends string>({
  opciones,
  valor,
  onCambio,
  etiqueta,
  pestanas,
}: {
  opciones: { valor: T; nombre: string }[];
  valor: T;
  onCambio: (v: T) => void;
  etiqueta: string;
  pestanas?: boolean;
}) {
  return (
    <div
      className={cx(s.segmentado, pestanas && s.pestanas)}
      role={pestanas ? 'tablist' : 'group'}
      aria-label={etiqueta}
    >
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          className={s.segmento}
          {...(pestanas
            ? { role: 'tab', 'aria-selected': o.valor === valor }
            : { 'aria-pressed': o.valor === valor })}
          onClick={() => onCambio(o.valor)}
        >
          {o.nombre}
        </button>
      ))}
    </div>
  );
}

export function Tarjeta({
  children,
  destacada,
  suave,
  className,
}: {
  children: ReactNode;
  destacada?: boolean;
  suave?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cx(s.tarjeta, destacada && s.tarjetaDestacada, suave && s.tarjetaSuave, className)}
    >
      {children}
    </div>
  );
}

export function TarjetaEnlace({
  a,
  children,
  destacada,
}: {
  a: string;
  children: ReactNode;
  destacada?: boolean;
}) {
  return (
    <Link to={a} className={cx(s.tarjeta, destacada && s.tarjetaDestacada)}>
      {children}
    </Link>
  );
}

export function Insignia({
  tono = 'exito',
  children,
}: {
  tono?: 'primario' | 'exito' | 'pendiente' | 'atenuado' | 'error';
  children: ReactNode;
}) {
  const clase = {
    primario: s.insigniaPrimario,
    exito: s.insigniaExito,
    pendiente: s.insigniaPendiente,
    atenuado: s.insigniaAtenuado,
    error: s.insigniaError,
  }[tono];
  return <span className={cx(s.insignia, clase)}>{children}</span>;
}

/** Título de página con botón "Volver" opcional y una acción a la derecha. */
export function Cabecera({
  titulo,
  subtitulo,
  volver,
  accion,
}: {
  titulo: string;
  subtitulo?: string;
  volver?: string | true;
  accion?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className={s.cabecera}>
      {volver && (
        <button
          type="button"
          className={s.volver}
          aria-label="Volver"
          onClick={() => (volver === true ? navigate(-1) : navigate(volver))}
        >
          <Icono nombre="volver" />
        </button>
      )}
      <div className={s.cabeceraTextos}>
        <h1 className={s.cabeceraTitulo}>{titulo}</h1>
        {subtitulo && <p className={s.cabeceraSubtitulo}>{subtitulo}</p>}
      </div>
      {accion}
    </header>
  );
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className={s.estado} role="status">
      <div className={s.girando} />
      <p>{texto}</p>
    </div>
  );
}

export function Vacio({
  titulo,
  children,
  icono = 'rayo',
}: {
  titulo: string;
  children?: ReactNode;
  icono?: NombreIcono;
}) {
  return (
    <div className={s.estado}>
      <Icono nombre={icono} tamano={36} />
      <h2 className={s.estadoTitulo}>{titulo}</h2>
      {children}
    </div>
  );
}

export function Alerta({
  tipo = 'error',
  children,
}: {
  tipo?: 'error' | 'aviso' | 'exito';
  children: ReactNode;
}) {
  const clase = { error: s.alertaError, aviso: s.alertaAviso, exito: s.alertaExito }[tipo];
  return (
    <div className={cx(s.alerta, clase)} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}

export function Chips({
  items,
}: {
  items: { icono: NombreIcono; valor: string; nombre: string }[];
}) {
  return (
    <div className={s.chips}>
      {items.map((c) => (
        <div key={c.nombre} className={s.chip}>
          <Icono nombre={c.icono} />
          <span className={s.chipValor}>{c.valor}</span>
          <span className={s.chipNombre}>{c.nombre}</span>
        </div>
      ))}
    </div>
  );
}

export function SoloLectores({ children }: { children: ReactNode }) {
  return <span className={s.soloLectores}>{children}</span>;
}
