import { useState, useEffect, useCallback } from 'react';

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

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (formData: TransactionFormData, editingTransaction: Transaction | null, shouldBulkUpdate: boolean) => Promise<void>;
  editingTransaction: Transaction | null;
  accounts: BankAccount[];
  categories: Category[];
  selectedAccount?: string;
}

export function TransactionModal({
  isOpen,
  onClose,
  onSave,
  editingTransaction,
  accounts,
  categories,
  selectedAccount
}: TransactionModalProps) {
  const [formData, setFormData] = useState<TransactionFormData>({
    account: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    currency: 'GBP',
    amount: 0,
    fee: 0,
    category: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(cat => cat.categoryId === categoryId);
    return category ? category.name : categoryId;
  };

  useEffect(() => {
    if (isOpen) {
      if (editingTransaction) {
        setFormData({
          account: editingTransaction.account,
          date: editingTransaction.date,
          description: editingTransaction.description,
          currency: editingTransaction.currency,
          amount: editingTransaction.amount,
          fee: editingTransaction.fee,
          category: editingTransaction.category
        });
      } else {
        setFormData({
          account: selectedAccount || '',
          date: new Date().toISOString().split('T')[0],
          description: '',
          currency: 'GBP',
          amount: 0,
          fee: 0,
          category: ''
        });
      }
    }
  }, [isOpen, editingTransaction, selectedAccount]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const isCategoryChanged = editingTransaction &&
        editingTransaction.category !== formData.category;

      let shouldBulkUpdate = false;

      if (isCategoryChanged) {
        shouldBulkUpdate = window.confirm(
          `Do you want to update the category to "${getCategoryName(formData.category)}" for all transactions with the description "${editingTransaction.description}"?`
        );
      }

      await onSave(formData, editingTransaction, shouldBulkUpdate);
      onClose();
    } catch (error) {
      console.error('Error saving transaction:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition duration-200"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
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
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200 mt-6">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium py-2 px-6 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {isSaving ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </div>
              ) : (
                editingTransaction ? 'Update Transaction' : 'Create Transaction'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed text-gray-700 font-medium py-2 px-6 rounded-lg transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}