import { useState, useEffect, useCallback } from 'react';

interface BudgetItem {
  budgetId: string;
  name: string;
  categoryId: string;
  amount: number;
  currency: string;
  type: 'monthly' | 'periodic' | 'one-time';
  direction?: 'expense' | 'income';
  startMonth: string;
  endMonth: string;
  year: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Category {
  categoryId: string;
  name: string;
  color?: string;
}

interface ComparisonCategory {
  categoryId: string;
  planned: number;
  actual: number;
  delta: number;
}

interface ComparisonMonth {
  month: string;
  categories: ComparisonCategory[];
  incomeCategories: ComparisonCategory[];
  totalPlanned: number;
  totalActual: number;
  totalPlannedExpenses: number;
  totalActualExpenses: number;
  totalPlannedIncome: number;
  totalActualIncome: number;
}

type BudgetFormData = {
  name: string;
  categoryId: string;
  amount: number;
  currency: string;
  type: 'monthly' | 'periodic' | 'one-time';
  direction: 'expense' | 'income';
  startMonth: string;
  endMonth: string;
  year: number;
  notes: string;
  isActive: boolean;
};

const apiEndpoint = import.meta.env.VITE_API_ENDPOINT || 'https://2fq77pd4al.execute-api.eu-south-1.amazonaws.com/prod/';

const monthLabelsShort = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

export function Budget() {
  const [activeTab, setActiveTab] = useState<'piano' | 'confronto' | 'annuale'>('piano');
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<BudgetItem | null>(null);

  // Confronto state
  const [comparisonMonth, setComparisonMonth] = useState(new Date().getMonth() + 1);
  const [comparisonData, setComparisonData] = useState<ComparisonMonth | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);

  // Annual chart state
  const [annualData, setAnnualData] = useState<ComparisonMonth[]>([]);
  const [annualLoading, setAnnualLoading] = useState(false);

  const defaultFormData: BudgetFormData = {
    name: '',
    categoryId: '',
    amount: 0,
    currency: 'EUR',
    type: 'monthly',
    direction: 'expense',
    startMonth: `${selectedYear}-01`,
    endMonth: `${selectedYear}-12`,
    year: selectedYear,
    notes: '',
    isActive: true,
  };

  const [formData, setFormData] = useState<BudgetFormData>(defaultFormData);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await fetch(`${apiEndpoint}categories`);
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (err) {
      setError('Error fetching categories: ' + (err as Error).message);
    }
  }, []);

  const fetchBudgetItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiEndpoint}budget?year=${selectedYear}`);
      if (!response.ok) throw new Error('Failed to fetch budget items');
      const data = await response.json();
      setBudgetItems(data.items || []);
      setError('');
    } catch (err) {
      setError('Error fetching budget: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  const fetchComparison = useCallback(async () => {
    try {
      setComparisonLoading(true);
      const response = await fetch(
        `${apiEndpoint}budget/comparison?year=${selectedYear}&month=${String(comparisonMonth).padStart(2, '0')}`
      );
      if (!response.ok) throw new Error('Failed to fetch comparison');
      const data = await response.json();
      setComparisonData(data.months?.[0] || null);
      setError('');
    } catch (err) {
      setError('Error fetching comparison: ' + (err as Error).message);
    } finally {
      setComparisonLoading(false);
    }
  }, [selectedYear, comparisonMonth]);

  const fetchAnnualData = useCallback(async () => {
    try {
      setAnnualLoading(true);
      const response = await fetch(`${apiEndpoint}budget/comparison?year=${selectedYear}`);
      if (!response.ok) throw new Error('Failed to fetch annual data');
      const data = await response.json();
      setAnnualData(data.months || []);
      setError('');
    } catch (err) {
      setError('Error fetching annual data: ' + (err as Error).message);
    } finally {
      setAnnualLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchBudgetItems();
  }, [fetchBudgetItems]);

  useEffect(() => {
    if (activeTab === 'confronto') {
      fetchComparison();
    }
  }, [activeTab, fetchComparison]);

  useEffect(() => {
    if (activeTab === 'annuale') {
      fetchAnnualData();
    }
  }, [activeTab, fetchAnnualData]);

  const getCategoryName = (categoryId: string) => {
    if (categoryId === '__uncategorized__') return 'Senza categoria';
    return categories.find(c => c.categoryId === categoryId)?.name || categoryId;
  };

  const handleTypeChange = (type: 'monthly' | 'periodic' | 'one-time') => {
    const updates: Partial<BudgetFormData> = { type };
    if (type === 'monthly') {
      updates.endMonth = `${formData.year}-12`;
    } else if (type === 'one-time') {
      updates.endMonth = formData.startMonth;
    }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleStartMonthChange = (startMonth: string) => {
    const updates: Partial<BudgetFormData> = { startMonth };
    if (formData.type === 'one-time') {
      updates.endMonth = startMonth;
    }
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      ...defaultFormData,
      year: selectedYear,
      startMonth: `${selectedYear}-01`,
      endMonth: `${selectedYear}-12`,
    });
    setShowModal(true);
  };

  const openEditModal = (item: BudgetItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      categoryId: item.categoryId,
      amount: item.amount,
      currency: item.currency,
      type: item.type,
      direction: item.direction || 'expense',
      startMonth: item.startMonth,
      endMonth: item.endMonth,
      year: item.year,
      notes: item.notes || '',
      isActive: item.isActive,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingItem
        ? `${apiEndpoint}budget/${editingItem.budgetId}`
        : `${apiEndpoint}budget`;
      const method = editingItem ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Failed to save budget item');
      await fetchBudgetItems();
      setShowModal(false);
      setEditingItem(null);
    } catch (err) {
      setError('Error saving budget item: ' + (err as Error).message);
    }
  };

  const handleDelete = async (budgetId: string) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa voce?')) return;
    try {
      const response = await fetch(`${apiEndpoint}budget/${budgetId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete budget item');
      await fetchBudgetItems();
    } catch (err) {
      setError('Error deleting budget item: ' + (err as Error).message);
    }
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      monthly: 'bg-blue-100 text-blue-800',
      periodic: 'bg-purple-100 text-purple-800',
      'one-time': 'bg-orange-100 text-orange-800',
    };
    const labels: Record<string, string> = {
      monthly: 'Mensile',
      periodic: 'Periodico',
      'one-time': 'Una tantum',
    };
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${styles[type] || 'bg-gray-100 text-gray-800'}`}>
        {labels[type] || type}
      </span>
    );
  };

  // Group items by category
  const groupedItems = budgetItems.reduce<Record<string, BudgetItem[]>>((acc, item) => {
    const cat = item.categoryId;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  // Monthly projected total: sum of all monthly/periodic amounts + one-time spread
  const monthlyTotal = budgetItems.reduce((sum, item) => {
    if (item.type === 'one-time') return sum + item.amount;
    const start = new Date(item.startMonth + '-01');
    const end = new Date(item.endMonth + '-01');
    let months = 0;
    const cur = new Date(start);
    while (cur <= end) {
      months++;
      cur.setMonth(cur.getMonth() + 1);
    }
    return sum + item.amount * months;
  }, 0);

  const formatCurrency = (amount: number, currency = 'EUR') => {
    const symbol = currency === 'GBP' ? '£' : '€';
    return `${symbol}${amount.toFixed(2)}`;
  };

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  if (loading && activeTab === 'piano') {
    return (
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-lg text-gray-600">Caricamento budget...</span>
        </div>
      </div>
    );
  }

  // Annual chart renderer
  const renderAnnualChart = () => {
    if (annualLoading) {
      return (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Caricamento dati annuali...</span>
        </div>
      );
    }

    if (annualData.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-gray-500">Nessun dato disponibile per questo anno.</p>
        </div>
      );
    }

    const maxValue = Math.max(
      ...annualData.map(m => Math.max(m.totalPlannedExpenses, m.totalActualExpenses)),
      1
    );

    const chartWidth = 800;
    const chartHeight = 350;
    const paddingLeft = 70;
    const paddingRight = 20;
    const paddingTop = 40;
    const paddingBottom = 50;
    const innerWidth = chartWidth - paddingLeft - paddingRight;
    const innerHeight = chartHeight - paddingTop - paddingBottom;

    const barGroupWidth = innerWidth / 12;
    const barWidth = barGroupWidth * 0.35;
    const barGap = barGroupWidth * 0.05;

    // Y-axis ticks
    const tickCount = 5;
    const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => Math.round((maxValue / tickCount) * i));

    const totalPlannedExpensesYear = annualData.reduce((s, m) => s + m.totalPlannedExpenses, 0);
    const totalActualExpensesYear = annualData.reduce((s, m) => s + m.totalActualExpenses, 0);
    const totalPlannedIncomeYear = annualData.reduce((s, m) => s + m.totalPlannedIncome, 0);
    const totalActualIncomeYear = annualData.reduce((s, m) => s + m.totalActualIncome, 0);

    const plannedSavings = totalPlannedIncomeYear - totalPlannedExpensesYear;
    const actualSavings = totalActualIncomeYear - totalActualExpensesYear;

    return (
      <div>
        {/* Legend */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span className="text-sm text-gray-700">Previsto (spese)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-sm text-gray-700">Reale (spese)</span>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full max-w-4xl" preserveAspectRatio="xMidYMid meet">
            {/* Y-axis gridlines and labels */}
            {yTicks.map(tick => {
              const y = paddingTop + innerHeight - (tick / maxValue) * innerHeight;
              return (
                <g key={tick}>
                  <line x1={paddingLeft} y1={y} x2={chartWidth - paddingRight} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                  <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="11" fill="#6b7280">
                    {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick}
                  </text>
                </g>
              );
            })}

            {/* Y-axis label */}
            <text x={14} y={paddingTop + innerHeight / 2} textAnchor="middle" fontSize="12" fill="#6b7280" transform={`rotate(-90, 14, ${paddingTop + innerHeight / 2})`}>
              EUR
            </text>

            {/* Bars */}
            {annualData.map((m, i) => {
              const x = paddingLeft + i * barGroupWidth;
              const plannedH = (m.totalPlannedExpenses / maxValue) * innerHeight;
              const actualH = (m.totalActualExpenses / maxValue) * innerHeight;
              const overBudget = m.totalActualExpenses > m.totalPlannedExpenses;

              return (
                <g key={m.month}>
                  {/* Planned bar */}
                  <rect
                    x={x + barGap}
                    y={paddingTop + innerHeight - plannedH}
                    width={barWidth}
                    height={plannedH}
                    fill="#3b82f6"
                    rx="2"
                  >
                    <title>{`${monthLabelsShort[i]} - Previsto: ${formatCurrency(m.totalPlannedExpenses)}`}</title>
                  </rect>
                  {/* Actual bar */}
                  <rect
                    x={x + barGap + barWidth + barGap}
                    y={paddingTop + innerHeight - actualH}
                    width={barWidth}
                    height={actualH}
                    fill={overBudget ? '#ef4444' : '#22c55e'}
                    rx="2"
                  >
                    <title>{`${monthLabelsShort[i]} - Reale: ${formatCurrency(m.totalActualExpenses)}`}</title>
                  </rect>
                  {/* X label */}
                  <text
                    x={x + barGroupWidth / 2}
                    y={chartHeight - paddingBottom + 18}
                    textAnchor="middle"
                    fontSize="12"
                    fill="#6b7280"
                  >
                    {monthLabelsShort[i]}
                  </text>
                </g>
              );
            })}

            {/* Axes */}
            <line x1={paddingLeft} y1={paddingTop} x2={paddingLeft} y2={paddingTop + innerHeight} stroke="#9ca3af" strokeWidth="1" />
            <line x1={paddingLeft} y1={paddingTop + innerHeight} x2={chartWidth - paddingRight} y2={paddingTop + innerHeight} stroke="#9ca3af" strokeWidth="1" />
          </svg>
        </div>

        {/* Summary row */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" style={{backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)'}}>
            <p className="text-sm font-medium text-gray-500 mb-1">Risparmio annuale previsto</p>
            <p className={`text-2xl font-bold ${plannedSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(plannedSavings)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Entrate: {formatCurrency(totalPlannedIncomeYear)} — Spese: {formatCurrency(totalPlannedExpensesYear)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" style={{backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)'}}>
            <p className="text-sm font-medium text-gray-500 mb-1">Risparmio annuale reale</p>
            <p className={`text-2xl font-bold ${actualSavings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(actualSavings)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Entrate: {formatCurrency(totalActualIncomeYear)} — Spese: {formatCurrency(totalActualExpensesYear)}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{color: 'var(--text-primary)'}}>Budget Planner</h1>
          <p className="text-gray-600 mt-1" style={{color: 'var(--text-secondary)'}}>Pianifica e confronta il tuo budget</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700">Anno:</label>
          <select
            value={selectedYear}
            onChange={e => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {[2024, 2025, 2026, 2027, 2028].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm font-medium text-red-800">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6" style={{borderColor: 'var(--border-color)'}}>
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('piano')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'piano'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Piano Budget
          </button>
          <button
            onClick={() => setActiveTab('confronto')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'confronto'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Confronto Mensile
          </button>
          <button
            onClick={() => setActiveTab('annuale')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'annuale'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Grafico Annuale
          </button>
        </nav>
      </div>

      {/* Piano Budget Tab */}
      {activeTab === 'piano' && (
        <div>
          {Object.keys(groupedItems).length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessuna voce di budget</h3>
              <p className="text-gray-500">Inizia aggiungendo la tua prima voce di budget!</p>
            </div>
          ) : (
            <>
              {Object.entries(groupedItems).map(([categoryId, items]) => {
                const categorySubtotal = items.reduce((sum, item) => {
                  if (item.type === 'one-time') return sum + item.amount;
                  const start = new Date(item.startMonth + '-01');
                  const end = new Date(item.endMonth + '-01');
                  let months = 0;
                  const cur = new Date(start);
                  while (cur <= end) { months++; cur.setMonth(cur.getMonth() + 1); }
                  return sum + item.amount * months;
                }, 0);

                return (
                  <div key={categoryId} className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold text-gray-800" style={{color: 'var(--text-primary)'}}>{getCategoryName(categoryId)}</h3>
                      <span className="text-sm font-medium text-gray-500">
                        Subtotale annuo: {formatCurrency(categorySubtotal)}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full bg-white shadow-sm rounded-lg overflow-hidden" style={{backgroundColor: 'var(--bg-card)'}}>
                        <thead className="bg-gray-50" style={{backgroundColor: 'var(--bg-secondary)'}}>
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Importo/mese</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Periodo</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Azioni</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200" style={{borderColor: 'var(--border-color)'}}>
                          {items.map(item => (
                            <tr key={item.budgetId} className="hover:bg-gray-50 transition-colors duration-200">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap">{getTypeBadge(item.type)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">
                                <span className={item.direction === 'income' ? 'text-green-600' : 'text-gray-900'}>
                                  {item.direction === 'income' ? (
                                    <span title="Entrata">↑ </span>
                                  ) : (
                                    <span className="text-red-500" title="Spesa">↓ </span>
                                  )}
                                  {formatCurrency(item.amount, item.currency)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {item.startMonth} → {item.endMonth}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{item.notes || '—'}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <div className="flex justify-end space-x-2">
                                  <button
                                    onClick={() => openEditModal(item)}
                                    className="text-blue-600 hover:text-blue-900 font-medium transition duration-200"
                                  >
                                    Modifica
                                  </button>
                                  <button
                                    onClick={() => handleDelete(item.budgetId)}
                                    className="text-red-600 hover:text-red-900 font-medium transition duration-200"
                                  >
                                    Elimina
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200" style={{backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)'}}>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900" style={{color: 'var(--text-primary)'}}>Totale annuo previsto</span>
                  <span className="text-xl font-bold text-blue-600">{formatCurrency(monthlyTotal)}</span>
                </div>
              </div>
            </>
          )}

          {/* Floating add button */}
          <button
            onClick={openAddModal}
            className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-full shadow-lg transition duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            + Aggiungi voce
          </button>
        </div>
      )}

      {/* Confronto Mensile Tab */}
      {activeTab === 'confronto' && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <label className="text-sm font-medium text-gray-700">Mese:</label>
            <select
              value={comparisonMonth}
              onChange={e => setComparisonMonth(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {monthNames.map((name, i) => (
                <option key={i + 1} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>

          {comparisonLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Caricamento confronto...</span>
            </div>
          ) : comparisonData ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" style={{backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)'}}>
                  <p className="text-sm font-medium text-gray-500 mb-1">Spese Previste</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {formatCurrency(comparisonData.totalPlannedExpenses)}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" style={{backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)'}}>
                  <p className="text-sm font-medium text-gray-500 mb-1">Spese Reali</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(comparisonData.totalActualExpenses)}
                  </p>
                </div>
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6" style={{backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)'}}>
                  <p className="text-sm font-medium text-gray-500 mb-1">Delta Spese</p>
                  <p className={`text-2xl font-bold ${
                    comparisonData.totalPlannedExpenses - comparisonData.totalActualExpenses >= 0
                      ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(comparisonData.totalPlannedExpenses - comparisonData.totalActualExpenses)}
                  </p>
                </div>
              </div>

              {/* Income summary */}
              {(comparisonData.totalPlannedIncome > 0 || comparisonData.totalActualIncome > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6" style={{backgroundColor: 'var(--bg-card)'}}>
                    <p className="text-sm font-medium text-gray-500 mb-1">Entrate Previste</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(comparisonData.totalPlannedIncome)}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6" style={{backgroundColor: 'var(--bg-card)'}}>
                    <p className="text-sm font-medium text-gray-500 mb-1">Entrate Reali</p>
                    <p className="text-2xl font-bold text-green-700">
                      {formatCurrency(comparisonData.totalActualIncome)}
                    </p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border border-green-200 p-6" style={{backgroundColor: 'var(--bg-card)'}}>
                    <p className="text-sm font-medium text-gray-500 mb-1">Risparmio Mese</p>
                    <p className={`text-2xl font-bold ${
                      (comparisonData.totalActualIncome - comparisonData.totalActualExpenses) >= 0
                        ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {formatCurrency(comparisonData.totalActualIncome - comparisonData.totalActualExpenses)}
                    </p>
                  </div>
                </div>
              )}

              {/* Expense comparison table */}
              {comparisonData.categories.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nessun dato disponibile per questo mese.</p>
                </div>
              ) : (
                <>
                  <h3 className="text-md font-semibold text-gray-700 mb-3">Spese per categoria</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white shadow-sm rounded-lg overflow-hidden" style={{backgroundColor: 'var(--bg-card)'}}>
                      <thead className="bg-gray-50" style={{backgroundColor: 'var(--bg-secondary)'}}>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previsto</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reale</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Differenza</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Progresso</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200" style={{borderColor: 'var(--border-color)'}}>
                        {comparisonData.categories.map(cat => {
                          const overBudget = cat.planned > 0 && cat.actual > cat.planned;
                          const noBudget = cat.planned === 0;
                          const percentage = cat.planned > 0
                            ? Math.min((cat.actual / cat.planned) * 100, 100)
                            : 0;
                          const rowColor = noBudget
                            ? 'bg-gray-50'
                            : overBudget ? 'bg-red-50' : 'bg-green-50';

                          return (
                            <tr key={cat.categoryId} className={`${rowColor} transition-colors duration-200`}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {getCategoryName(cat.categoryId)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(cat.planned)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(cat.actual)}
                              </td>
                              <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                                cat.delta >= 0 ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {cat.delta >= 0 ? '+' : ''}{formatCurrency(cat.delta)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {cat.planned > 0 ? (
                                  <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div
                                      className={`h-3 rounded-full transition-all duration-300 ${
                                        overBudget ? 'bg-red-500' : 'bg-green-500'
                                      }`}
                                      style={{ width: `${percentage}%` }}
                                    ></div>
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">N/A</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Income comparison table */}
              {comparisonData.incomeCategories && comparisonData.incomeCategories.length > 0 && (
                <>
                  <h3 className="text-md font-semibold text-gray-700 mb-3 mt-6">Entrate per categoria</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full bg-white shadow-sm rounded-lg overflow-hidden" style={{backgroundColor: 'var(--bg-card)'}}>
                      <thead className="bg-gray-50" style={{backgroundColor: 'var(--bg-secondary)'}}>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Categoria</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Previsto</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reale</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Differenza</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200" style={{borderColor: 'var(--border-color)'}}>
                        {comparisonData.incomeCategories.map(cat => (
                          <tr key={cat.categoryId} className="bg-green-50 transition-colors duration-200">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {getCategoryName(cat.categoryId)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(cat.planned)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatCurrency(cat.actual)}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                              cat.delta >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {cat.delta >= 0 ? '+' : ''}{formatCurrency(cat.delta)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">Nessun dato di confronto disponibile.</p>
            </div>
          )}
        </div>
      )}

      {/* Grafico Annuale Tab */}
      {activeTab === 'annuale' && renderAnnualChart()}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" style={{backgroundColor: 'var(--bg-card)'}}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900" style={{color: 'var(--text-primary)'}}>
                  {editingItem ? 'Modifica voce' : 'Nuova voce di budget'}
                </h2>
                <button
                  onClick={() => { setShowModal(false); setEditingItem(null); }}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" style={{color: 'var(--text-secondary)'}}>Nome</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Es. Balletto Teresa"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" style={{color: 'var(--text-secondary)'}}>Categoria</label>
                  <select
                    value={formData.categoryId}
                    onChange={e => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleziona categoria</option>
                    {categories.map(cat => (
                      <option key={cat.categoryId} value={cat.categoryId}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                {/* Direction toggle */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{color: 'var(--text-secondary)'}}>Tipo movimento</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="direction"
                        value="expense"
                        checked={formData.direction === 'expense'}
                        onChange={() => setFormData(prev => ({ ...prev, direction: 'expense' }))}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <span className="text-sm text-gray-700">Spesa</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="direction"
                        value="income"
                        checked={formData.direction === 'income'}
                        onChange={() => setFormData(prev => ({ ...prev, direction: 'income' }))}
                        className="text-green-600 focus:ring-green-500"
                      />
                      <span className="text-sm text-gray-700">Entrata</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2" style={{color: 'var(--text-secondary)'}}>Tipo</label>
                  <div className="flex gap-4">
                    {([
                      { value: 'monthly', label: 'Mensile tutto l\'anno' },
                      { value: 'periodic', label: 'Periodico' },
                      { value: 'one-time', label: 'Una tantum' },
                    ] as const).map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="type"
                          value={opt.value}
                          checked={formData.type === opt.value}
                          onChange={() => handleTypeChange(opt.value)}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{color: 'var(--text-secondary)'}}>
                      {formData.direction === 'income' ? 'Importo entrata' : 'Importo mensile'} ({formData.currency === 'GBP' ? '£' : '€'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{color: 'var(--text-secondary)'}}>Valuta</label>
                    <select
                      value={formData.currency}
                      onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{color: 'var(--text-secondary)'}}>Mese inizio</label>
                    <input
                      type="month"
                      value={formData.startMonth}
                      onChange={e => handleStartMonthChange(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" style={{color: 'var(--text-secondary)'}}>Mese fine</label>
                    <input
                      type="month"
                      value={formData.endMonth}
                      onChange={e => setFormData(prev => ({ ...prev, endMonth: e.target.value }))}
                      required
                      disabled={formData.type === 'one-time'}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" style={{color: 'var(--text-secondary)'}}>Note (opzionale)</label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Note aggiuntive..."
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {editingItem ? 'Aggiorna' : 'Crea'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowModal(false); setEditingItem(null); }}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 font-medium py-2 px-4 rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Annulla
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
