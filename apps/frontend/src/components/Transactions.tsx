import { usePageTitle } from '../hooks/usePageTitle';
import { useState, useEffect, useCallback, useRef } from 'react';
import Papa from 'papaparse';
import { TransactionModal } from './TransactionModal';
import { TransferModal } from './TransferModal';
import { ConfirmationModal } from './ConfirmationModal';
import { Snackbar } from './Snackbar';

interface Transaction {
  transactionId: string;
  account: string;
  date: string;
  description: string;
  subject?: string;
  currency: 'GBP' | 'EUR';
  amount: number;
  fee: number;
  category: string;
  createdAt: string;
  updatedAt: string;
  transferId?: string;
  transferType?: 'outgoing' | 'incoming' | 'regular';
  relatedAccount?: string;
  relatedTransactionId?: string;
}

interface BankAccount {
  accountId: string;
  accountName: string;
  accountType: string;
  currency: string;
  balance: number;
  isActive: boolean;
}

interface Category {
  categoryId: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
}

type TransactionFormData = Omit<Transaction, 'transactionId' | 'createdAt' | 'updatedAt'>;

interface TransferData {
  fromAccount: string;
  toAccount: string;
  amount: number;
  date: string;
  description: string;
  currency: 'GBP' | 'EUR';
  fee: number;
}

interface CSVRow {
  Type?: string;
  Product?: string;
  'Started Date'?: string;
  'Started_Date'?: string;
  'Completed Date'?: string;
  Description?: string;
  Amount?: string;
  Fee?: string;
  Currency?: string;
  State?: string;
  Balance?: string;
}

export function Transactions() {
  usePageTitle('Transazioni');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [error, setError] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [highlightedTransactionId, setHighlightedTransactionId] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    isOpen: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    message: '',
    type: 'info'
  });
  const [importProgress, setImportProgress] = useState<{
    total: number;
    processed: number;
    errors: string[];
    isImporting: boolean;
  }>({
    total: 0,
    processed: 0,
    errors: [],
    isImporting: false
  });

  const apiEndpoint = import.meta.env.VITE_API_ENDPOINT || 'https://your-api-gateway-url.com/prod/';

  const fetchTransactions = useCallback(async (accountId: string) => {
    if (!accountId) {
      setTransactions([]);
      return;
    }

    try {
      setLoadingTransactions(true);
      setError('');
      const response = await fetch(`${apiEndpoint}transactions?account=${encodeURIComponent(accountId)}`);
      if (!response.ok) throw new Error('Failed to fetch transactions');
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      setError('Error fetching transactions: ' + (err as Error).message);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }, [apiEndpoint]);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}accounts`);
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const data = await response.json();
      setAccounts(data.accounts || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  }, [apiEndpoint]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}categories?isActive=true`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, [apiEndpoint]);

  const handleSaveTransaction = async (formData: TransactionFormData, editingTransaction: Transaction | null, shouldBulkUpdate: boolean) => {
    try {
      // If bulk update is requested, call the bulk update endpoint
      if (shouldBulkUpdate && editingTransaction) {
        // Collect IDs of all similar transactions (same description + same account)
        const similarIds = transactions
          .filter(t => t.description === editingTransaction.description && t.account === editingTransaction.account)
          .map(t => t.transactionId);

        const bulkResponse = await fetch(`${apiEndpoint}transactions/bulk`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account: editingTransaction.account,
            transactionIds: similarIds.length > 0 ? similarIds : [editingTransaction.transactionId],
            updates: { category: formData.category }
          })
        });

        if (!bulkResponse.ok) {
          const errorData = await bulkResponse.json();
          throw new Error(errorData.error || 'Failed to bulk update transactions');
        }

        const bulkResult = await bulkResponse.json();
        showSnackbar(`✅ Categoria aggiornata su ${bulkResult.updated} transazioni simili`, 'success');
      } else {
        // Regular single transaction update or creation
        const url = editingTransaction
          ? `${apiEndpoint}transactions/${editingTransaction.transactionId}`
          : `${apiEndpoint}transactions`;

        const method = editingTransaction ? 'PUT' : 'POST';

        const response = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });

        if (!response.ok) throw new Error('Failed to save transaction');
      }

      await fetchTransactions(selectedAccount);
      setEditingTransaction(null);
    } catch (err) {
      setError('Error saving transaction: ' + (err as Error).message);
      throw err;
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setShowModal(true);
  };

  const handleAddTransaction = () => {
    setEditingTransaction(null);
    setShowModal(true);
  };

  const handleCreateTransfer = () => {
    setShowTransferModal(true);
  };

  const handleSaveTransfer = async (transferData: TransferData) => {
    try {
      const response = await fetch(`${apiEndpoint}transactions/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transferData),
      });

      if (!response.ok) {
        throw new Error('Failed to create transfer');
      }

      await fetchTransactions(selectedAccount);
      setShowTransferModal(false);
    } catch (err) {
      setError('Error creating transfer: ' + (err as Error).message);
      throw err;
    }
  };

  const handleConvertToTransfer = async (transactionId: string, toAccount: string, toTransactionId?: string) => {
    try {
      const transferCategory = categories.find(c => c.name.toLowerCase().includes('transfer'));
      const response = await fetch(`${apiEndpoint}transactions/${transactionId}/convert-to-transfer?account=${encodeURIComponent(selectedAccount)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account: selectedAccount,
          toAccount,
          ...(transferCategory ? { categoryId: transferCategory.categoryId } : {}),
          ...(toTransactionId ? { toTransactionId } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to convert transaction to transfer');
      }

      const result = await response.json();
      if (result.matched) {
        showSnackbar(`✅ Transfer linked! Destination transaction found in ${getAccountName(toAccount)}`, 'success');
      } else {
        showSnackbar(`⚠️ Transfer marked but no matching transaction found in ${getAccountName(toAccount)}`, 'info');
      }

      await fetchTransactions(selectedAccount);
    } catch (err) {
      setError('Error converting transaction to transfer: ' + (err as Error).message);
      throw err;
    }
  };

  const showSnackbar = (message: string, type: 'success' | 'error' | 'info') => {
    setSnackbar({
      isOpen: true,
      message,
      type
    });
  };

  const handleDelete = (transaction: Transaction) => {
    setDeletingTransaction(transaction);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingTransaction) return;

    if (!selectedAccount) {
      showSnackbar('Error: No account selected for deletion', 'error');
      setShowDeleteConfirm(false);
      setDeletingTransaction(null);
      return;
    }

    try {
      const response = await fetch(`${apiEndpoint}transactions/${deletingTransaction.transactionId}?account=${encodeURIComponent(deletingTransaction.account)}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`Failed to delete transaction: ${errorData}`);
      }

      await fetchTransactions(selectedAccount);
      showSnackbar(`Transaction "${deletingTransaction.description}" has been deleted successfully`, 'success');
    } catch (err) {
      console.error('Delete error:', err);
      showSnackbar('Error deleting transaction: ' + (err as Error).message, 'error');
    } finally {
      setShowDeleteConfirm(false);
      setDeletingTransaction(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletingTransaction(null);
  };


  const getAccountName = (accountId: string) => {
    const account = accounts.find(acc => acc.accountId === accountId);
    return account ? account.accountName : accountId;
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.categoryId === categoryId);
    return category ? category.name : categoryId;
  };

  const getCategoryIcon = (categoryId: string) => {
    const category = categories.find(cat => cat.categoryId === categoryId);
    return category?.icon || '';
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(cat => cat.categoryId === categoryId);
    return category?.color || '#3b82f6';
  };

  const formatAmount = (amount: number, currency: string) => {
    const symbol = currency === 'GBP' ? '£' : '€';
    const colorClass = amount >= 0 ? 'text-green-600' : 'text-red-600';
    return (
      <span className={`font-semibold ${colorClass}`}>
        {amount >= 0 ? '+' : ''}{symbol}{amount.toFixed(2)}
      </span>
    );
  };

  // Load accounts and categories on component mount
  useEffect(() => {
    Promise.all([
      fetchAccounts(),
      fetchCategories()
    ]);
  }, [fetchAccounts, fetchCategories]);

  // Fetch transactions when account selection changes
  useEffect(() => {
    if (selectedAccount) {
      fetchTransactions(selectedAccount);
    }
  }, [selectedAccount, fetchTransactions]);

  // Scroll to and highlight the linked transaction after loading
  useEffect(() => {
    if (!highlightedTransactionId || loadingTransactions) return;
    const el = document.getElementById(`tx-${highlightedTransactionId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Clear highlight after 3 seconds
      const timer = setTimeout(() => setHighlightedTransactionId(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [highlightedTransactionId, loadingTransactions, transactions]);

  // Handle account selection change
  const handleAccountChange = (accountId: string, highlightId?: string) => {
    setSelectedAccount(accountId);
    setTransactions([]); // Clear current transactions immediately
    setError(''); // Clear any previous errors
    setHighlightedTransactionId(highlightId ?? null);
  };

  // Parse and import CSV file
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedAccount) return;

    setImportProgress({
      total: 0,
      processed: 0,
      errors: [],
      isImporting: true
    });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        importTransactions(results.data as CSVRow[]);
      },
      error: (error) => {
        setImportProgress(prev => ({
          ...prev,
          errors: [...prev.errors, `CSV Parse Error: ${error.message}`],
          isImporting: false
        }));
      }
    });
  };

  // Process and import transactions from CSV data
  const importTransactions = async (csvData: CSVRow[]) => {
    const validTransactions: Omit<Transaction, 'transactionId' | 'createdAt' | 'updatedAt'>[] = [];
    const errors: string[] = [];

    // Validate and map CSV data to transaction format
    csvData.forEach((row, index) => {
      try {
        // Map CSV columns to our transaction fields
        const startedDate = row['Started Date'] || row['Started_Date'] || '';
        const amount = parseFloat(row['Amount'] || '0');
        const fee = parseFloat(row['Fee'] || '0');
        const currency = (row['Currency'] || 'GBP').toUpperCase();
        const description = row['Description'] || '';

        // Validate required fields
        if (!startedDate || !description || isNaN(amount)) {
          errors.push(`Row ${index + 2}: Missing required data (date, description, or amount)`);
          return;
        }

        // Format date to YYYY-MM-DD
        let formattedDate: string;
        try {
          const dateObj = new Date(startedDate);
          if (isNaN(dateObj.getTime())) {
            errors.push(`Row ${index + 2}: Invalid date format`);
            return;
          }
          formattedDate = dateObj.toISOString().split('T')[0];
        } catch {
          errors.push(`Row ${index + 2}: Could not parse date`);
          return;
        }

        // Validate currency
        if (!['GBP', 'EUR'].includes(currency)) {
          errors.push(`Row ${index + 2}: Invalid currency '${currency}' (only GBP and EUR supported)`);
          return;
        }

        // Find default category: prefer "Imported", then "Uncategorized", then first active
        const defaultCategory = categories.find(cat => cat.name.toLowerCase() === 'imported')
                                || categories.find(cat => cat.name.toLowerCase().includes('imported'))
                                || categories.find(cat => cat.name.toLowerCase().includes('uncategorized'))
                                || categories.find(cat => cat.isActive)
                                || categories[0];

        if (!defaultCategory) {
          errors.push(`Row ${index + 2}: No categories available. Please create at least one category first.`);
          return;
        }

        // Create transaction object
        validTransactions.push({
          account: selectedAccount,
          date: formattedDate,
          description: description.trim(),
          currency: currency as 'GBP' | 'EUR',
          amount: amount,
          fee: isNaN(fee) ? 0 : fee,
          category: defaultCategory.categoryId
        });
      } catch (error) {
        errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    setImportProgress(prev => ({
      ...prev,
      total: validTransactions.length,
      errors: errors
    }));

    // Import valid transactions
    if (validTransactions.length > 0) {
      await batchImportTransactions(validTransactions);
    } else {
      setImportProgress(prev => ({
        ...prev,
        isImporting: false
      }));
    }
  };

  // Batch import transactions
  const batchImportTransactions = async (transactions: Omit<Transaction, 'transactionId' | 'createdAt' | 'updatedAt'>[]) => {
    const batchSize = 5; // Process 5 transactions at a time to avoid overwhelming the API
    let totalProcessed = 0;

    for (let i = 0; i < transactions.length; i += batchSize) {
      const batch = transactions.slice(i, i + batchSize);

      // Process batch in parallel
      const batchPromises = batch.map(async (transaction) => {
        try {
          const response = await fetch(`${apiEndpoint}transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transaction)
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to import transaction');
          }

          // Return success to count processed
          return true;
        } catch (error) {
          setImportProgress(prev => ({
            ...prev,
            errors: [...prev.errors, `Import error: ${error instanceof Error ? error.message : 'Unknown error'}`]
          }));
          return false;
        }
      });

      const results = await Promise.all(batchPromises);
      const successCount = results.filter(result => result === true).length;
      totalProcessed += successCount;

      setImportProgress(prev => ({
        ...prev,
        processed: totalProcessed
      }));

      // Small delay between batches to be nice to the API
      if (i + batchSize < transactions.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Refresh transactions list
    await fetchTransactions(selectedAccount);

    setImportProgress(prev => ({
      ...prev,
      isImporting: false
    }));
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg text-gray-600">Loading transactions...</span>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{color: 'var(--text-primary)'}}>Bank Transactions</h1>
          <p className="text-gray-600 mt-1" style={{color: 'var(--text-secondary)'}}>Track all your financial transactions in one place</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={handleAddTransaction}
            disabled={!selectedAccount}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            + Add Transaction
          </button>
          <button
            onClick={handleCreateTransfer}
            disabled={accounts.filter(acc => acc.isActive).length < 2}
            className="w-full sm:w-auto bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
          >
            💸 Transfer Money
          </button>
          <button
            onClick={() => setShowImport(!showImport)}
            disabled={!selectedAccount}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
          >
            {showImport ? '✕ Cancel Import' : '📄 Import CSV'}
          </button>
        </div>
      </div>

      {/* Account Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2" style={{color: 'var(--text-secondary)'}}>
          Select Account to View Transactions
        </label>
        <div className="max-w-md">
          <select
            value={selectedAccount}
            onChange={(e) => handleAccountChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
          >
            <option value="">Choose an account...</option>
            {accounts.filter(acc => acc.isActive).map(account => (
              <option key={account.accountId} value={account.accountId}>
                {account.accountName} ({account.currency}) - {account.accountType}
              </option>
            ))}
          </select>
        </div>
        {selectedAccount && (
          <p className="text-sm text-gray-600 mt-2">
            Showing transactions for: <span className="font-medium">{getAccountName(selectedAccount)}</span>
            {loadingTransactions && <span className="ml-2 text-blue-600">Loading...</span>}
          </p>
        )}
      </div>

      {/* Search & Filter Bar */}
      {selectedAccount && (
        <div className="mb-6 flex flex-col sm:flex-row gap-3">
          {/* Text search */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca nella descrizione..."
              className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          {/* Category filter */}
          <div className="relative min-w-[200px]">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 appearance-none pr-8"
              style={{ backgroundColor: 'var(--bg-card)', color: filterCategory ? 'var(--text-primary)' : 'var(--text-secondary)', borderColor: 'var(--border-color)' }}
            >
              <option value="">Tutte le categorie</option>
              {[...categories].sort((a, b) => a.name.localeCompare(b.name)).map(cat => (
                <option key={cat.categoryId} value={cat.categoryId}>
                  {cat.icon} {cat.name}
                </option>
              ))}
            </select>
            {filterCategory && (
              <button
                onClick={() => setFilterCategory('')}
                className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}

      {/* CSV Import Section */}
      {showImport && (
        <div className="mb-8 bg-green-50 rounded-lg p-6 shadow-sm border border-green-200" style={{backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'}}>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Transactions from CSV</h2>

          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Expected CSV Format:</h3>
            <div className="bg-gray-100 p-3 rounded text-sm text-gray-600 font-mono" style={{backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)'}}>
              Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Only <strong>Started Date</strong>, <strong>Description</strong>, <strong>Amount</strong>, <strong>Fee</strong>, and <strong>Currency</strong> columns will be imported.
              <br />
              <strong>Note:</strong> Imported transactions will be assigned to your default category (or first available category).
              You can reassign categories manually after import if needed.
            </p>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              disabled={importProgress.isImporting}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50"
            />
          </div>

          {/* Import Progress */}
          {importProgress.isImporting && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center mb-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                <span className="text-sm font-medium text-blue-800">
                  Importing transactions... ({importProgress.processed}/{importProgress.total})
                </span>
              </div>
              {importProgress.total > 0 && (
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(importProgress.processed / importProgress.total) * 100}%` }}
                  ></div>
                </div>
              )}
            </div>
          )}

          {/* Import Results */}
          {!importProgress.isImporting && (importProgress.processed > 0 || importProgress.errors.length > 0) && (
            <div className="space-y-3">
              {importProgress.processed > 0 && (
                <div className="p-4 bg-green-100 rounded-lg border border-green-200">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-sm font-medium text-green-800">
                      Successfully imported {importProgress.processed} transactions!
                    </span>
                  </div>
                </div>
              )}

              {importProgress.errors.length > 0 && (
                <div className="p-4 bg-red-100 rounded-lg border border-red-200">
                  <div className="flex items-start">
                    <svg className="h-5 w-5 text-red-400 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L10 11.414l1.293-1.293a1 1 0 001.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-red-800 mb-2">
                        Import Errors ({importProgress.errors.length}):
                      </h4>
                      <div className="text-sm text-red-700 max-h-32 overflow-y-auto">
                        {importProgress.errors.map((error, index) => (
                          <div key={index} className="mb-1">• {error}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="text-red-400">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}


      {!selectedAccount ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 text-gray-300">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2" style={{color: 'var(--text-primary)'}}>Select an Account</h3>
          <p className="text-gray-500" style={{color: 'var(--text-secondary)'}}>Choose a bank account from the dropdown above to view its transactions.</p>
        </div>
      ) : loadingTransactions ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-lg text-gray-600">Loading transactions...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 text-gray-300">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2" style={{color: 'var(--text-primary)'}}>No transactions found</h3>
          <p className="text-gray-500" style={{color: 'var(--text-secondary)'}}>This account has no transactions yet. Create your first transaction!</p>
        </div>
      ) : (
        <>
        {(searchQuery || filterCategory) && (
          <p className="text-sm text-gray-500 mb-2" style={{color: 'var(--text-secondary)'}}>
            {transactions.filter(t => {
              const q = searchQuery.toLowerCase();
              return (
                (!searchQuery || t.description.toLowerCase().includes(q) || (t.subject ?? '').toLowerCase().includes(q)) &&
                (!filterCategory || t.category === filterCategory)
              );
            }).length} risultati
            {searchQuery && <> per "<strong>{searchQuery}</strong>"</>}
            {filterCategory && <> · categoria: <strong>{getCategoryName(filterCategory)}</strong></>}
          </p>
        )}
        <div className="bg-white shadow-sm rounded-lg overflow-hidden" style={{backgroundColor: 'var(--bg-card)'}}>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50" style={{backgroundColor: 'var(--bg-secondary)'}}>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{color: 'var(--text-secondary)'}}>Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{color: 'var(--text-secondary)'}}>Account</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{color: 'var(--text-secondary)'}}>Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{color: 'var(--text-secondary)'}}>Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{color: 'var(--text-secondary)'}}>Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{color: 'var(--text-secondary)'}}>Fee</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider" style={{color: 'var(--text-secondary)'}}>Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200" style={{backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)'}}>
                {transactions
                  .filter(t => {
                    const q = searchQuery.toLowerCase();
                    const matchesSearch = !searchQuery ||
                      t.description.toLowerCase().includes(q) ||
                      (t.subject ?? '').toLowerCase().includes(q);
                    const matchesCategory = !filterCategory || t.category === filterCategory;
                    return matchesSearch && matchesCategory;
                  })
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((transaction) => (
                  <tr
                    key={transaction.transactionId}
                    id={`tx-${transaction.transactionId}`}
                    className={`hover:bg-gray-50 transition-colors duration-500 ${highlightedTransactionId === transaction.transactionId ? 'bg-purple-100 ring-2 ring-inset ring-purple-400' : ''}`}
                    style={{borderColor: 'var(--border-color)'}}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900" style={{color: 'var(--text-primary)'}}>
                      {new Date(transaction.date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900" style={{color: 'var(--text-primary)'}}>
                        {getAccountName(transaction.account)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm max-w-xs">
                        {transaction.subject && transaction.subject !== transaction.description ? (
                          <>
                            <div className="font-medium text-gray-900" style={{color: 'var(--text-primary)'}}>{transaction.subject}</div>
                            <div className="text-xs text-gray-500 mt-0.5 truncate" style={{color: 'var(--text-secondary)'}} title={transaction.description}>{transaction.description}</div>
                          </>
                        ) : (
                          <div className="text-gray-900" style={{color: 'var(--text-primary)'}}>{transaction.description}</div>
                        )}
                        {transaction.transferType && transaction.transferType !== 'regular' && (
                          <div className="mt-1">
                            {transaction.relatedAccount ? (
                              <button
                                onClick={() => {
                                  handleAccountChange(transaction.relatedAccount!, transaction.relatedTransactionId);
                                }}
                                className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 hover:underline transition-colors"
                                title={`Go to ${getAccountName(transaction.relatedAccount)}`}
                              >
                                {transaction.transferType === 'outgoing' && <span>↗️ Transfer to</span>}
                                {transaction.transferType === 'incoming' && <span>↙️ Transfer from</span>}
                                <span className="font-medium">{getAccountName(transaction.relatedAccount)}</span>
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                              </button>
                            ) : (
                              <span className="text-xs text-gray-500">
                                {transaction.transferType === 'outgoing' ? '↗️ Transfer out' : '↙️ Transfer in'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(transaction.category) && (
                          <span className="text-lg">{getCategoryIcon(transaction.category)}</span>
                        )}
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: getCategoryColor(transaction.category) }}
                        />
                        <span className="text-sm text-gray-900" style={{color: 'var(--text-primary)'}}>
                          {getCategoryName(transaction.category)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {formatAmount(transaction.amount, transaction.currency)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {transaction.fee > 0 && (
                        <span className="text-red-600 font-medium">
                          {transaction.currency === 'GBP' ? '£' : '€'}{transaction.fee.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(transaction)}
                          className="text-blue-600 hover:text-blue-900 transition duration-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(transaction)}
                          className="text-red-600 hover:text-red-900 transition duration-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      <TransactionModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingTransaction(null);
        }}
        onSave={handleSaveTransaction}
        onConvertToTransfer={handleConvertToTransfer}
        editingTransaction={editingTransaction}
        accounts={accounts}
        categories={categories}
        selectedAccount={selectedAccount}
        similarTransactionsCount={
          editingTransaction
            ? transactions.filter(
                t => t.description === editingTransaction.description &&
                     t.transactionId !== editingTransaction.transactionId
              ).length
            : 0
        }
      />

      <TransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        onSave={handleSaveTransfer}
        accounts={accounts}
        selectedAccount={selectedAccount}
      />

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        title="Delete Transaction"
        message={
          deletingTransaction
            ? `Are you sure you want to delete the transaction "${deletingTransaction.description}"? This action cannot be undone.`
            : 'Are you sure you want to delete this transaction?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmButtonType="danger"
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />

      <Snackbar
        isOpen={snackbar.isOpen}
        message={snackbar.message}
        type={snackbar.type}
        onClose={() => setSnackbar(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}