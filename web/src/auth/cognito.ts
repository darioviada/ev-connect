// AUTH_MODE=cognito: Amazon Cognito con Amplify v6 (registro, confirmación por código, login, logout).
// App client público (sin secreto). La API verifica el ID token, que es el que se envía.
// Verificado en los tipos de @aws-amplify/auth 6.x: signIn, signUp, confirmSignUp, signOut, fetchAuthSession.
import { Amplify } from 'aws-amplify';
import { confirmSignUp, fetchAuthSession, signIn, signOut, signUp } from 'aws-amplify/auth';
import { ErrorAuth, type ServicioAuth } from './servicio';

const MENSAJES: Record<string, string> = {
  NotAuthorizedException: 'El correo o la contraseña no son correctos.',
  UserNotFoundException: 'El correo o la contraseña no son correctos.',
  UsernameExistsException: 'Ya existe una cuenta con ese correo electrónico.',
  CodeMismatchException: 'El código no es correcto.',
  ExpiredCodeException: 'El código venció. Pedí uno nuevo registrándote otra vez.',
  InvalidPasswordException:
    'La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula, número y símbolo.',
  LimitExceededException: 'Demasiados intentos. Esperá unos minutos.',
  UserNotConfirmedException: 'Tenés que confirmar tu correo con el código que te enviamos.',
};

function traducir(error: unknown): never {
  const nombre = (error as { name?: string } | null)?.name ?? '';
  throw new ErrorAuth(nombre || 'ERROR', MENSAJES[nombre] ?? 'No se pudo completar la operación.');
}

export function crearServicioCognito(opciones: {
  userPoolId: string;
  clientId: string;
}): ServicioAuth {
  Amplify.configure({
    Auth: { Cognito: { userPoolId: opciones.userPoolId, userPoolClientId: opciones.clientId } },
  });

  return {
    modo: 'cognito',
    async iniciarSesion(email, password) {
      try {
        const r = await signIn({ username: email, password });
        if (r.isSignedIn) return;
        if (r.nextStep.signInStep === 'CONFIRM_SIGN_UP') {
          throw new ErrorAuth('CONFIRMACION_PENDIENTE', MENSAJES.UserNotConfirmedException!);
        }
        throw new ErrorAuth(
          'PASO_NO_SOPORTADO',
          'Este tipo de inicio de sesión no está soportado en la demo.',
        );
      } catch (error) {
        if (error instanceof ErrorAuth) throw error;
        traducir(error);
      }
    },
    async registrarse(nombre, email, password) {
      try {
        const r = await signUp({
          username: email,
          password,
          options: { userAttributes: { email, name: nombre } },
        });
        return { requiereConfirmacion: !r.isSignUpComplete };
      } catch (error) {
        traducir(error);
      }
    },
    async confirmarRegistro(email, codigo) {
      try {
        await confirmSignUp({ username: email, confirmationCode: codigo });
      } catch (error) {
        traducir(error);
      }
    },
    async cerrarSesion() {
      await signOut();
    },
    async obtenerToken() {
      try {
        const sesion = await fetchAuthSession();
        return sesion.tokens?.idToken?.toString() ?? null;
      } catch {
        return null;
      }
    },
  };
}
