import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from './app';

// Mock auth modules
jest.mock('../auth/tokens', () => ({
  isAuthenticated: () => true,
  clearTokens: jest.fn(),
  buildLogoutUrl: () => 'https://example.com/logout',
}));

jest.mock('../pages/Login', () => ({
  Login: () => <div data-testid="login">Mocked Login</div>,
}));

jest.mock('../auth/callback', () => ({
  Callback: () => <div data-testid="callback">Mocked Callback</div>,
}));

// Mock the Dashboard component that uses import.meta
jest.mock('../components/Dashboard', () => ({
  Dashboard: () => <div data-testid="dashboard">Mocked Dashboard</div>
}));

jest.mock('../components/BankAccounts', () => ({
  BankAccounts: () => <div data-testid="bank-accounts">Mocked Bank Accounts</div>
}));

jest.mock('../components/Categories', () => ({
  Categories: () => <div data-testid="categories">Mocked Categories</div>
}));

jest.mock('../components/Transactions', () => ({
  Transactions: () => <div data-testid="transactions">Mocked Transactions</div>
}));

jest.mock('../components/Budget', () => ({
  Budget: () => <div data-testid="budget">Mocked Budget</div>
}));

jest.mock('../pages/Profile', () => ({
  Profile: () => <div data-testid="profile">Mocked Profile</div>
}));


describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(baseElement).toBeTruthy();
  });

  it('should render navigation when authenticated', () => {
    const { getByRole } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(getByRole('navigation')).toBeTruthy();
  });

  it('should have dashboard component when authenticated', () => {
    const { getByTestId } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(getByTestId('dashboard')).toBeTruthy();
  });
});
