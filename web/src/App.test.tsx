import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('muestra el nombre del producto como título principal', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: 'EVConnect' })).toBeInTheDocument();
  });

  it('muestra el aviso de datos sintéticos', () => {
    render(<App />);
    expect(screen.getByRole('note')).toHaveTextContent('Datos de demostración (sintéticos)');
  });
});
