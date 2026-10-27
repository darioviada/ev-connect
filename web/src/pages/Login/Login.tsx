// /login — Iniciar sesión / Registrarme / Confirmar código (este último solo en modo Cognito).
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { mensajeDeError } from '../../api/cliente';
import { ErrorAuth } from '../../auth/servicio';
import { useSesion } from '../../auth/Sesion';
import { Alerta, Boton, Campo, claseControl, Segmentado } from '../../components/ui';
import { problemasDePassword } from '../../dominio/password';
import s from './Login.module.css';

type Pestana = 'ingresar' | 'registrarme';

/** Solo se vuelve a rutas internas (evita redirecciones abiertas). */
function destinoSeguro(volver: string | null): string {
  return volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : '/';
}

export function Login() {
  const { perfil, modo, iniciarSesion, registrarse, confirmarRegistro } = useSesion();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const destino = destinoSeguro(params.get('volver'));

  const [pestana, setPestana] = useState<Pestana>('ingresar');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [confirmando, setConfirmando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  if (perfil) return <Navigate to={destino} replace />;

  const problemas = pestana === 'registrarme' && password ? problemasDePassword(password) : [];

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMensaje(null);
    if (pestana === 'registrarme' && problemasDePassword(password).length > 0) {
      setError('La contraseña no cumple la política.');
      return;
    }
    setEnviando(true);
    try {
      if (confirmando) {
        await confirmarRegistro(email, codigo);
        await iniciarSesion(email, password);
      } else if (pestana === 'ingresar') {
        await iniciarSesion(email, password);
      } else {
        const r = await registrarse(nombre, email, password);
        if (r.requiereConfirmacion) {
          setConfirmando(true);
          setMensaje('Te enviamos un código a tu correo. Ingresalo para confirmar la cuenta.');
          return;
        }
      }
      navigate(destino, { replace: true });
    } catch (err) {
      setError(err instanceof ErrorAuth ? err.message : mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className={s.pagina}>
      <Link to="/inicio" className={s.marca}>
        EVConnect
      </Link>

      {modo === 'local' && (
        <p className={s.modoLocal} role="note">
          Modo demo local — no usar en producción
        </p>
      )}

      {!confirmando && (
        <Segmentado
          pestanas
          etiqueta="Acceso"
          opciones={[
            { valor: 'ingresar', nombre: 'Iniciar sesión' },
            { valor: 'registrarme', nombre: 'Registrarme' },
          ]}
          valor={pestana}
          onCambio={(p) => {
            setPestana(p);
            setError(null);
          }}
        />
      )}

      <form className={s.formulario} onSubmit={enviar} noValidate={false}>
        {confirmando ? (
          <Campo etiqueta="Código de confirmación">
            {(p) => (
              <input
                {...p}
                className={claseControl}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            )}
          </Campo>
        ) : (
          <>
            {pestana === 'registrarme' && (
              <Campo etiqueta="Nombre">
                {(p) => (
                  <input
                    {...p}
                    className={claseControl}
                    autoComplete="name"
                    required
                    maxLength={100}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                )}
              </Campo>
            )}
            <Campo etiqueta="Correo electrónico">
              {(p) => (
                <input
                  {...p}
                  type="email"
                  className={claseControl}
                  placeholder="nombre@correo.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              )}
            </Campo>
            <Campo
              etiqueta="Contraseña"
              ayuda={
                pestana === 'registrarme'
                  ? 'Mínimo 8 caracteres, con mayúscula, minúscula, número y símbolo.'
                  : undefined
              }
              error={problemas.length > 0 ? `Falta: ${problemas.join(', ')}.` : null}
            >
              {(p) => (
                <input
                  {...p}
                  type="password"
                  className={claseControl}
                  autoComplete={pestana === 'registrarme' ? 'new-password' : 'current-password'}
                  required
                  maxLength={72}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              )}
            </Campo>
          </>
        )}

        {mensaje && (
          <Alerta tipo="exito">
            <p>{mensaje}</p>
          </Alerta>
        )}
        {error && (
          <Alerta>
            <p>{error}</p>
          </Alerta>
        )}

        <Boton type="submit" anchoCompleto cargando={enviando}>
          {confirmando ? 'Confirmar' : 'Continuar'}
        </Boton>
      </form>

      {modo === 'local' && pestana === 'ingresar' && (
        <p className={s.demo}>
          Usuarios de demostración: <code>usuario@demo.local</code> / <code>Usuario123!</code> ·{' '}
          <code>admin@demo.local</code> / <code>Admin123!</code>
        </p>
      )}
    </main>
  );
}
