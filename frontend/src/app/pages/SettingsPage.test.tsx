import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import SettingsPage from './SettingsPage';

vi.mock('../components/Sidebar', () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}));

describe('Settings page premium structure', () => {
  test('shows sectioned preferences heading', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/preferences center/i)).toBeInTheDocument();
  });

  test('shows profile and notifications navigation labels', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });
});
