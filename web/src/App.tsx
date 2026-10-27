import { AvisoDemo } from './components/AvisoDemo/AvisoDemo';
import { Bienvenida } from './pages/Bienvenida/Bienvenida';

// Fase 0: una sola página. El ruteo (React Router) y las pantallas llegan en la Fase 5.
export function App() {
  return (
    <>
      <Bienvenida />
      <AvisoDemo />
    </>
  );
}
