import { useState, useEffect } from 'react';

interface BankAccount {
  accountId: string;
  accountName: string;
  accountNumber: string;
  bankName: string;
  accountType: 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'INVESTMENT';
  currency: 'GBP' | 'EUR';
  balance?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

type AccountFormData = Omit<BankAccount, 'accountId' | 'createdAt' | 'updatedAt'>;

export function BankAccounts() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [formData, setFormData] = useState<AccountFormData>({
    accountName: '',
    accountNumber: '',
    bankName: '',
    accountType: 'CHECKING',
    currency: 'GBP',
    balance: 0,
    isActive: true
  });

  const apiEndpoint = import.meta.env.VITE_API_ENDPOINT || 'https://your-api-gateway-url.com/prod/';

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiEndpoint}accounts`);
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const data = await response.json();
      setAccounts(data.accounts || []);
      setError('');
    } catch (err) {
      setError('Error fetching accounts: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingAccount
        ? `${apiEndpoint}accounts/${editingAccount.accountId}`
        : `${apiEndpoint}accounts`;

      const method = editingAccount ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save account');

      await fetchAccounts();
      setShowForm(false);
      setEditingAccount(null);
      setFormData({
        accountName: '',
        accountNumber: '',
        bankName: '',
        accountType: 'CHECKING',
        currency: 'GBP',
        balance: 0,
        isActive: true
      });
    } catch (err) {
      setError('Error saving account: ' + (err as Error).message);
    }
  };

  const handleEdit = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      accountName: account.accountName,
      accountNumber: account.accountNumber,
      bankName: account.bankName,
      accountType: account.accountType,
      currency: account.currency,
      balance: account.balance,
      isActive: account.isActive
    });
    setShowForm(true);
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account?')) return;

    try {
      const response = await fetch(`${apiEndpoint}accounts/${accountId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete account');
      await fetchAccounts();
    } catch (err) {
      setError('Error deleting account: ' + (err as Error).message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked
              : type === 'number' ? parseFloat(value) || 0
              : value
    }));
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1rem'
  };

  const headerStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '2rem'
  };

  const buttonStyle = {
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    fontSize: '0.875rem'
  };

  const dangerButtonStyle = {
    ...buttonStyle,
    backgroundColor: '#ef4444'
  };

  const formStyle = {
    backgroundColor: '#f9fafb',
    padding: '1.5rem',
    borderRadius: '0.5rem',
    marginBottom: '2rem'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.5rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    fontSize: '0.875rem'
  };

  const tableStyle = {
    width: '100%',
    borderCollapse: 'collapse' as const,
    backgroundColor: 'white',
    borderRadius: '0.5rem',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
  };

  const thStyle = {
    backgroundColor: '#f3f4f6',
    padding: '0.75rem',
    textAlign: 'left' as const,
    fontWeight: '600',
    borderBottom: '1px solid #e5e7eb'
  };

  const tdStyle = {
    padding: '0.75rem',
    borderBottom: '1px solid #e5e7eb'
  };

  if (loading) return <div style={containerStyle}>Loading...</div>;

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <h1>Bank Accounts</h1>
        <button
          style={buttonStyle}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#fef2f2',
          color: '#dc2626',
          padding: '1rem',
          borderRadius: '0.375rem',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} style={formStyle}>
          <h2>{editingAccount ? 'Edit Account' : 'Add New Account'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Account Name:
                <input
                  type="text"
                  name="accountName"
                  value={formData.accountName}
                  onChange={handleInputChange}
                  required
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Account Number:
                <input
                  type="text"
                  name="accountNumber"
                  value={formData.accountNumber}
                  onChange={handleInputChange}
                  required
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Bank Name:
                <input
                  type="text"
                  name="bankName"
                  value={formData.bankName}
                  onChange={handleInputChange}
                  required
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Account Type:
                <select
                  name="accountType"
                  value={formData.accountType}
                  onChange={handleInputChange}
                  style={inputStyle}
                >
                  <option value="CHECKING">Checking</option>
                  <option value="SAVINGS">Savings</option>
                  <option value="CREDIT">Credit</option>
                  <option value="INVESTMENT">Investment</option>
                </select>
              </label>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Currency:
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  style={inputStyle}
                >
                  <option value="GBP">GBP</option>
                  <option value="EUR">EUR</option>
                </select>
              </label>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Balance:
                <input
                  type="number"
                  step="0.01"
                  name="balance"
                  value={formData.balance}
                  onChange={handleInputChange}
                  style={inputStyle}
                />
              </label>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                Active Account
              </label>
            </div>
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button type="submit" style={buttonStyle}>
              {editingAccount ? 'Update Account' : 'Create Account'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingAccount(null);
              }}
              style={{ ...buttonStyle, backgroundColor: '#6b7280' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Account Name</th>
            <th style={thStyle}>Account Number</th>
            <th style={thStyle}>Bank</th>
            <th style={thStyle}>Type</th>
            <th style={thStyle}>Currency</th>
            <th style={thStyle}>Balance</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {accounts.length === 0 ? (
            <tr>
              <td colSpan={8} style={{ ...tdStyle, textAlign: 'center', color: '#6b7280' }}>
                No accounts found. Create your first account!
              </td>
            </tr>
          ) : (
            accounts.map((account) => (
              <tr key={account.accountId}>
                <td style={tdStyle}>{account.accountName}</td>
                <td style={tdStyle}>{account.accountNumber}</td>
                <td style={tdStyle}>{account.bankName}</td>
                <td style={tdStyle}>{account.accountType}</td>
                <td style={tdStyle}>{account.currency}</td>
                <td style={tdStyle}>
                  {account.balance !== undefined ? `${account.balance.toFixed(2)}` : 'N/A'}
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    backgroundColor: account.isActive ? '#d1fae5' : '#fee2e2',
                    color: account.isActive ? '#065f46' : '#991b1b'
                  }}>
                    {account.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => handleEdit(account)}
                      style={{ ...buttonStyle, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(account.accountId)}
                      style={{ ...dangerButtonStyle, fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}