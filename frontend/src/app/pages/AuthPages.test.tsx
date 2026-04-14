import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import LoginPage from './LoginPage';
import SignUpPage from './SignUpPage';
import ForgotPasswordPage from './ForgotPasswordPage';

const mockNavigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...(actual as object),
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    handleLogin: vi.fn(),
    handleRegister: vi.fn(),
    isAuthenticated: false,
    loading: false,
    error: null,
    clearAuthError: vi.fn(),
  }),
}));

describe('Auth pages premium editorial structure', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  test('login page renders editorial intro message', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/crafted for focused, modern learning/i)
    ).toBeInTheDocument();
  });

  test('signup page renders editorial account creation prompt', () => {
    render(
      <MemoryRouter>
        <SignUpPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/build your learning identity/i)
    ).toBeInTheDocument();
  });

  test('forgot password page renders secure access copy', () => {
    render(
      <MemoryRouter>
        <ForgotPasswordPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/securely recover access to your workspace/i)
    ).toBeInTheDocument();
  });
});
