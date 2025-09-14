import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';

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

import App from './app';

describe('App', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(baseElement).toBeTruthy();
  });

  it('should render navigation', () => {
    const { getByRole } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(getByRole('navigation')).toBeTruthy();
  });

  it('should have dashboard component', () => {
    const { getByTestId } = render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    expect(getByTestId('dashboard')).toBeTruthy();
  });
});
