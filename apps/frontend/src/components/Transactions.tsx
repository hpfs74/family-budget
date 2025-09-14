import { useState, useEffect, useCallback } from 'react';
import Papa from 'papaparse';

interface Transaction {
  transactionId: string;
  account: string;
  date: string;
  description: string;
  currency: 'GBP' | 'EUR';
  amount: number;
  fee: number;
  category: string;
  createdAt: string;
  updatedAt: string;
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [error, setError] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
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
  const [formData, setFormData] = useState<TransactionFormData>({
    account: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    currency: 'GBP',
    amount: 0,
    fee: 0,
    category: ''
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Check if we're editing a transaction and the category has changed
      const isCategoryChanged = editingTransaction &&
        editingTransaction.category !== formData.category;

      let shouldBulkUpdate = false;

      if (isCategoryChanged) {
        shouldBulkUpdate = window.confirm(
          `Do you want to update the category to "${getCategoryName(formData.category)}" for all transactions with the description "${editingTransaction.description}"?`
        );
      }

      // If bulk update is requested, call the bulk update endpoint
      if (shouldBulkUpdate && editingTransaction) {
        const bulkResponse = await fetch(`${apiEndpoint}transactions/bulkUpdate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            account: editingTransaction.account,
            description: editingTransaction.description,
            newCategory: formData.category
          })
        });

        if (!bulkResponse.ok) {
          const errorData = await bulkResponse.json();
          throw new Error(errorData.error || 'Failed to bulk update transactions');
        }

        const bulkResult = await bulkResponse.json();
        alert(`Successfully updated ${bulkResult.updatedCount} transactions!`);
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
      setShowForm(false);
      setEditingTransaction(null);
      setFormData({
        account: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        currency: 'GBP',
        amount: 0,
        fee: 0,
        category: ''
      });
    } catch (err) {
      setError('Error saving transaction: ' + (err as Error).message);
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      account: transaction.account,
      date: transaction.date,
      description: transaction.description,
      currency: transaction.currency,
      amount: transaction.amount,
      fee: transaction.fee,
      category: transaction.category
    });
    setShowForm(true);
  };

  const handleAddTransaction = () => {
    if (selectedAccount) {
      setFormData(prev => ({
        ...prev,
        account: selectedAccount
      }));
    }
    setShowForm(true);
  };

  const handleDelete = async (transactionId: string) => {
    if (!window.confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const response = await fetch(`${apiEndpoint}transactions/${transactionId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete transaction');
      await fetchTransactions(selectedAccount);
    } catch (err) {
      setError('Error deleting transaction: ' + (err as Error).message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
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

  // Handle account selection change
  const handleAccountChange = (accountId: string) => {
    setSelectedAccount(accountId);
    setTransactions([]); // Clear current transactions immediately
    setError(''); // Clear any previous errors
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

        // Find default category or use first available category
        const defaultCategory = categories.find(cat => cat.name.toLowerCase().includes('uncategorized'))
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
          <h1 className="text-3xl font-bold text-gray-900">Bank Transactions</h1>
          <p className="text-gray-600 mt-1">Track all your financial transactions in one place</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <button
            onClick={() => showForm ? setShowForm(false) : handleAddTransaction()}
            disabled={!selectedAccount}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {showForm ? '✕ Cancel' : '+ Add Transaction'}
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
        <label className="block text-sm font-medium text-gray-700 mb-2">
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

      {/* CSV Import Section */}
      {showImport && (
        <div className="mb-8 bg-green-50 rounded-lg p-6 shadow-sm border border-green-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Import Transactions from CSV</h2>

          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Expected CSV Format:</h3>
            <div className="bg-gray-100 p-3 rounded text-sm text-gray-600 font-mono">
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

      {showForm && (
        <div className="mb-8 bg-gray-50 rounded-lg p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">
            {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account
                </label>
                <select
                  name="account"
                  value={formData.account}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                >
                  <option value="">Select Account</option>
                  {accounts.filter(acc => acc.isActive).map(account => (
                    <option key={account.accountId} value={account.accountId}>
                      {account.accountName} ({account.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date
                </label>
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                >
                  <option value="">Select Category</option>
                  {categories.map(category => (
                    <option key={category.categoryId} value={category.categoryId}>
                      {category.icon} {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                >
                  <option value="GBP">GBP (£)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount
                  <span className="text-xs text-gray-500 ml-1">(negative for expenses)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fee
                </label>
                <input
                  type="number"
                  step="0.01"
                  name="fee"
                  value={formData.fee}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                placeholder="Transaction description..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200 resize-vertical"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                {editingTransaction ? 'Update Transaction' : 'Create Transaction'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setEditingTransaction(null);
                }}
                className="bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-6 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {!selectedAccount ? (
        <div className="text-center py-12">
          <div className="w-24 h-24 mx-auto mb-4 text-gray-300">
            <svg fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Account</h3>
          <p className="text-gray-500">Choose a bank account from the dropdown above to view its transactions.</p>
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
          <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
          <p className="text-gray-500">This account has no transactions yet. Create your first transaction!</p>
        </div>
      ) : (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fee</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions
                  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                  .map((transaction) => (
                  <tr key={transaction.transactionId} className="hover:bg-gray-50 transition-colors duration-200">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.date).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {getAccountName(transaction.account)}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {transaction.description}
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
                        <span className="text-sm text-gray-900">
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
                          onClick={() => handleDelete(transaction.transactionId)}
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
      )}
    </div>
  );
}