import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BateriaUrgencia } from '../components/Buscador/BateriaUrgencia';

const E208 = { capacidadBateriaKwh: 50, consumoKwhPor100km: 15.6 };

function Envoltorio({ inicial = 45, vehiculo = E208 as typeof E208 | null }) {
  const [pct, setPct] = useState(inicial);
  return <BateriaUrgencia bateriaPct={pct} onCambio={setPct} vehiculo={vehiculo} />;
}

const urgenciaActiva = () => screen.getByRole('listitem', { current: true });

describe('BateriaUrgencia', () => {
  it('muestra el porcentaje, la urgencia y la autonomía actual', () => {
    render(<Envoltorio />);
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(urgenciaActiva()).toHaveTextContent('Media');
    expect(screen.getByText('Autonomía actual: ~144 km')).toBeInTheDocument();
  });

  it('recalcula en vivo al mover el slider (bordes 29/30 y 70/71)', () => {
    render(<Envoltorio />);
    const slider = screen.getByLabelText('Batería actual');
    fireEvent.change(slider, { target: { value: '15' } });
    expect(urgenciaActiva()).toHaveTextContent('Alta');
    expect(screen.getByText('Autonomía actual: ~48 km')).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: '30' } });
    expect(urgenciaActiva()).toHaveTextContent('Media');
    fireEvent.change(slider, { target: { value: '71' } });
    expect(urgenciaActiva()).toHaveTextContent('Baja');
    expect(slider).toHaveAttribute('aria-valuetext', '71 por ciento, urgencia baja');
  });

  it('sin vehículo pide elegir uno', () => {
    render(<Envoltorio vehiculo={null} />);
    expect(screen.getByText(/Elegí un vehículo/)).toBeInTheDocument();
  });
});
