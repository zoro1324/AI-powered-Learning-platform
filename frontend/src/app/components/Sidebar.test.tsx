import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { Sidebar } from './Sidebar';

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: null,
    handleLogout: vi.fn(),
  }),
}));

describe('Sidebar premium shell', () => {
  test('renders branded learnpath marker for editorial shell', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByText('LearnPath')).toBeInTheDocument();
  });

  test('renders quick access label to support grouped navigation', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(
      screen.getByRole('heading', { name: /quick access/i })
    ).toBeInTheDocument();
  });
});
