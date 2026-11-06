// Configuración de Remotion (https://www.remotion.dev/docs/webpack).
// Las escenas reutilizan componentes reales de ../web/src. Esos archivos importan React y react-router, que
// tienen que resolverse a UNA sola copia (la de este proyecto) para que los hooks funcionen: por eso los
// módulos se buscan primero en video/node_modules.
import path from 'node:path';
import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.overrideWebpackConfig((actual) => ({
  ...actual,
  resolve: {
    ...actual.resolve,
    modules: [path.resolve(process.cwd(), 'node_modules'), 'node_modules'],
  },
}));
