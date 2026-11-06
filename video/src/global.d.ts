// Los componentes reutilizados de la app importan CSS Modules y hojas de estilo.
declare module '*.module.css' {
  const clases: Record<string, string>;
  export default clases;
}
declare module '*.css';
