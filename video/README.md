# Video demo de EVConnect (Remotion)

Proyecto aparte del TFG: no forma parte de los workspaces de la app, así que `npm install`, `npm test` y
`npm run lint` de la raíz no lo instalan ni lo ejecutan.

- 1920 × 1080, 30 fps, unos 4 minutos, sin audio (la voz en off se agrega después).
- Guion: `tesis/tfg-demo-docs/tfg-demo/docs/Guion video demo – EVConnect (TFG).md`.
- **Duraciones y textos:** solo en [`src/config/escenas.ts`](src/config/escenas.ts). Si cambiás la duración de
  una escena, las siguientes se corren solas y sus animaciones se estiran con ella.
- Las pantallas reutilizan componentes y estilos reales de `../web/src` (botones, íconos, tarjetas, CSS
  Modules y tokens). Las páginas se arman con datos fijos (`src/datos/`), sin API ni sesión.
- Dentro del celular se restituyen los estilos móviles de la app (sus reglas @media se evaluarían contra
  el ancho del video): ver `src/app/EstilosMovil.tsx`. La escena 9 muestra el diseño de escritorio real.
- El mapa es un SVG estilizado (los mosaicos de OpenStreetMap se descargan por red y el render no sería
  reproducible). Las fotos de vehículos son de Wikimedia Commons (CC BY-SA 4.0, ver `docs/LICENCIAS.md`).
- Las 10 escenas están armadas; cada una se puede ver sola en Studio (`Escena01-apertura` … `Escena10-cierre`).

## Uso

```bash
cd video
npm install
npm run studio      # Remotion Studio: elegir "DemoEVConnect" o una escena suelta ("Escena01-apertura", …)
npm run render      # video final en out/evconnect-demo.mp4 (solo cuando esté terminado)
```

Las tipografías (Sora y Plus Jakarta Sans, licencia OFL-1.1) están copiadas de `@fontsource` en `public/fuentes`.
