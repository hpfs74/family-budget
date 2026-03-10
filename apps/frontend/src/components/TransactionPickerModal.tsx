import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '../auth/auth-fetch';

interface Transaction {
  transactionId: string;
  account: string;
  date: string;
  description: string;
  subject?: string;
  currency: 'GBP' | 'EUR';
  amount: number;
  transferId?: string;
}

interface BankAccount {
  accountId: string;
  accountName: string;
  currency: string;
  isActive: boolean;
}

interface TransactionPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (transaction: Transaction, account: BankAccount) => void;
  accounts: BankAccount[];
  excludeAccountId?: string;
  title?: string;
}

export function TransactionPickerModal({
  isOpen,
  onClose,
  onSelect,
  accounts,
  excludeAccountId,
  title = 'Seleziona transazione collegata',
}: TransactionPickerModalProps) {
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const apiEndpoint = import.meta.env.VITE_API_ENDPOINT || 'https://your-api-gateway-url.com/prod/';

  const fetchTransactions = useCallback(async (accountId: string) => {
    if (!accountId) { setTransactions([]); return; }
    setLoading(true);
    try {
      const res = await authFetch(`${apiEndpoint}transactions?account=${encodeURIComponent(accountId)}`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [apiEndpoint]);

  useEffect(() => {
    if (isOpen) {
      setSelectedAccountId('');
      setTransactions([]);
      setSearch('');
    }
  }, [isOpen]);

  useEffect(() => {
    fetchTransactions(selectedAccountId);
  }, [selectedAccountId, fetchTransactions]);

  if (!isOpen) return null;

  const filtered = transactions
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (t.subject ?? '').toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.amount.toString().includes(q)
      );
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const selectedAccount = accounts.find(a => a.accountId === selectedAccountId);

  const formatAmount = (amount: number, currency: string) => {
    const symbol = currency === 'GBP' ? '£' : '€';
    const cls = amount >= 0 ? 'text-green-600' : 'text-red-600';
    return <span className={`font-semibold ${cls}`}>{amount >= 0 ? '+' : ''}{symbol}{Math.abs(amount).toFixed(2)}</span>;
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[60]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col" style={{ backgroundColor: 'var(--bg-card)' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>🔗 {title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Filters */}
        <div className="p-4 border-b flex flex-col sm:flex-row gap-3" style={{ borderColor: 'var(--border-color)' }}>
          <select
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
          >
            <option value="">Seleziona conto...</option>
            {accounts
              .filter(a => a.isActive && a.accountId !== excludeAccountId)
              .map(a => (
                <option key={a.accountId} value={a.accountId}>
                  {a.accountName} ({a.currency})
                </option>
              ))}
          </select>
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca soggetto, descrizione, importo..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
            />
          </div>
        </div>

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto">
          {!selectedAccountId ? (
            <div className="text-center py-12 text-gray-400">Seleziona un conto per vedere le transazioni</div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">Nessuna transazione trovata</div>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-50 sticky top-0" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Soggetto / Descrizione</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Importo</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100" style={{ borderColor: 'var(--border-color)' }}>
                {filtered.map(tx => (
                  <tr key={tx.transactionId} className="hover:bg-purple-50 transition-colors" style={{ borderColor: 'var(--border-color)' }}>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(tx.date).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {tx.subject && tx.subject !== tx.description ? (
                        <>
                          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{tx.subject}</div>
                          <div className="text-xs text-gray-400 truncate">{tx.description}</div>
                        </>
                      ) : (
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>{tx.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                      {formatAmount(tx.amount, tx.currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => selectedAccount && onSelect(tx, selectedAccount)}
                        className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-medium px-3 py-1 rounded-lg transition-colors"
                      >
                        Seleziona
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
