// /inicio — Bienvenida (HU-001): "Iniciar sesión" o "Continuar como invitado".
import { Navigate, useNavigate } from 'react-router';
import { marcarInvitado, useSesion } from '../../auth/Sesion';
import { Boton, EnlaceBoton, Icono } from '../../components/ui';
import s from './Inicio.module.css';

export function Inicio() {
  const { perfil } = useSesion();
  const navigate = useNavigate();
  if (perfil) return <Navigate to="/" replace />;

  return (
    <main className={s.pagina}>
      <div className={s.logo} aria-hidden="true">
        <Icono nombre="rayo" tamano={40} />
      </div>
      <h1 className={s.titulo}>EVConnect</h1>
      <p className={s.subtitulo}>Cargadores públicos y privados, recomendados para vos</p>
      <div className={s.acciones}>
        <EnlaceBoton a="/login" anchoCompleto>
          Iniciar sesión
        </EnlaceBoton>
        <Boton
          variante="contorno"
          anchoCompleto
          onClick={() => {
            marcarInvitado();
            navigate('/');
          }}
        >
          Continuar como invitado
        </Boton>
      </div>
      <p className={s.aviso} role="note">
        Datos de demostración (sintéticos)
      </p>
    </main>
  );
}
