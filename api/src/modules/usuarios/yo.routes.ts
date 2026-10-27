// GET /api/v1/yo — perfil del usuario autenticado (crea el registro la primera vez que se lo ve).
import { Router } from 'express';
import {
  autenticar,
  type DependenciasAuth,
  type UsuarioAutenticado,
} from '../../middleware/auth.js';

export function perfil(usuario: UsuarioAutenticado) {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.rol,
    fechaRegistro: usuario.fechaRegistro,
  };
}

export function yoRouter(deps: DependenciasAuth): Router {
  const router = Router();
  router.get('/', autenticar(deps, { obligatorio: true }), (req, res) => {
    res.json({ ...perfil(req.usuario!), modoAuth: deps.auth.modo });
  });
  return router;
}
