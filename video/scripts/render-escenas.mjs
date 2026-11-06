// Exporta cada escena como un MP4 aparte (para intercalar en una edición): out/escenas/NN-id.mp4.
// Lee los ids de src/config/escenas.ts, así que respeta las duraciones que haya ahí.
// Uso: npm run render:escenas            (todas)
//      npm run render:escenas -- 5 6      (solo las escenas 5 y 6)
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const config = readFileSync(new URL('../src/config/escenas.ts', import.meta.url), 'utf8');
const escenas = [...config.matchAll(/id: '([^']+)',\s*numero: (\d+)/g)].map(([, id, numero]) => ({
  id,
  numero: Number(numero),
}));
const pedidas = process.argv.slice(2).map(Number);
const elegidas = pedidas.length ? escenas.filter((e) => pedidas.includes(e.numero)) : escenas;

for (const { id, numero } of elegidas) {
  const nn = String(numero).padStart(2, '0');
  console.log(`\n▶ Escena ${nn} (${id})`);
  // H.264 con CRF 18: calidad alta y archivos que cualquier editor importa.
  const r = spawnSync(
    'npx',
    [
      'remotion',
      'render',
      'src/index.ts',
      `Escena${nn}-${id}`,
      `out/escenas/${nn}-${id}.mp4`,
      '--crf=18',
    ],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}
