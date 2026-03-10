import { useState, useEffect, useCallback, useMemo } from 'react';
import { authFetch } from '../auth/auth-fetch';

interface Transaction {
  transactionId: string;
  account: string;
  date: string;
  description: string;
  subject?: string;
  currency: string;
  amount: number;
  fee: number;
  category: string;
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
  icon?: string;
  color?: string;
  isActive: boolean;
}

const apiEndpoint =
  import.meta.env.VITE_API_ENDPOINT ||
  'https://your-api-gateway-url.com/prod/';

export function AnalisiTab() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(
    new Set()
  );
  const _now = new Date();
  const [fromMonth, setFromMonth] = useState(() => {
    const d = new Date(_now.getFullYear(), _now.getMonth() - 2, 1);
    return d.getMonth() + 1;
  });
  const [fromYear, setFromYear] = useState(() => {
    const d = new Date(_now.getFullYear(), _now.getMonth() - 2, 1);
    return d.getFullYear();
  });
  const [toMonth, setToMonth] = useState(_now.getMonth() + 1);
  const [toYear, setToYear] = useState(_now.getFullYear());
  const [subView, setSubView] = useState<'categoria' | 'soggetto'>(
    'categoria'
  );
  const [loading, setLoading] = useState(true);
  const [hoveredSegment, setHoveredSegment] = useState<{
    accountId: string;
    categoryId: string;
  } | null>(null);
  const [hoveredSubject, setHoveredSubject] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const response = await authFetch(`${apiEndpoint}accounts`);
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const data = await response.json();
      const accts = (data.accounts || []).filter(
        (a: BankAccount) => a.isActive
      );
      setAccounts(accts);
      setSelectedAccountIds(
        new Set(accts.map((a: BankAccount) => a.accountId))
      );
    } catch (err) {
      console.error('Error fetching accounts:', err);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await authFetch(
        `${apiEndpoint}categories?isActive=true`
      );
      if (!response.ok) throw new Error('Failed to fetch categories');
      const data = await response.json();
      const cats = data.categories || [];
      setCategories(cats);
      setSelectedCategoryIds(
        new Set(cats.map((c: Category) => c.categoryId))
      );
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  const fetchAllTransactions = useCallback(
    async (accts: BankAccount[]) => {
      setLoading(true);
      try {
        const results = await Promise.all(
          accts.map(async (account) => {
            const response = await authFetch(
              `${apiEndpoint}transactions?account=${encodeURIComponent(account.accountId)}`
            );
            if (!response.ok) return [];
            const data = await response.json();
            return (data.transactions || []) as Transaction[];
          })
        );
        setAllTransactions(results.flat());
      } catch (err) {
        console.error('Error fetching transactions:', err);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  useEffect(() => {
    if (accounts.length > 0) {
      fetchAllTransactions(accounts);
    }
  }, [accounts, fetchAllTransactions]);

  // Apply quick preset (months back from today)
  const applyPreset = useCallback((months: number) => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
    setFromMonth(from.getMonth() + 1);
    setFromYear(from.getFullYear());
    setToMonth(now.getMonth() + 1);
    setToYear(now.getFullYear());
  }, []);

  // Filter transactions by date range and selected accounts
  const filteredTransactions = useMemo(() => {
    const fromDate = new Date(fromYear, fromMonth - 1, 1);
    const toDate = new Date(toYear, toMonth, 0, 23, 59, 59); // last day of toMonth
    return allTransactions.filter((t) => {
      const d = new Date(t.date);
      return d >= fromDate && d <= toDate && selectedAccountIds.has(t.account);
    });
  }, [allTransactions, fromMonth, fromYear, toMonth, toYear, selectedAccountIds]);

  // Per Categoria: expenses grouped by account → category
  const categoryChartData = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.amount < 0);
    const filtered = expenses.filter((t) =>
      selectedCategoryIds.has(t.category)
    );

    const byAccount = new Map<string, Map<string, number>>();
    for (const t of filtered) {
      if (!byAccount.has(t.account))
        byAccount.set(t.account, new Map());
      const catMap = byAccount.get(t.account)!;
      catMap.set(
        t.category,
        (catMap.get(t.category) || 0) + Math.abs(t.amount)
      );
    }
    return byAccount;
  }, [filteredTransactions, selectedCategoryIds]);

  // Category totals for legend
  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const [, catMap] of categoryChartData) {
      for (const [catId, amount] of catMap) {
        totals.set(catId, (totals.get(catId) || 0) + amount);
      }
    }
    return [...totals.entries()]
      .map(([catId, total]) => ({ categoryId: catId, total }))
      .sort((a, b) => b.total - a.total);
  }, [categoryChartData]);

  // Per Soggetto: expenses grouped by subject
  const subjectChartData = useMemo(() => {
    const expenses = filteredTransactions.filter((t) => t.amount < 0);

    const bySubject = new Map<
      string,
      { total: number; count: number; categoryCounts: Map<string, number> }
    >();
    for (const t of expenses) {
      const key = t.subject || t.description;
      if (!bySubject.has(key))
        bySubject.set(key, {
          total: 0,
          count: 0,
          categoryCounts: new Map(),
        });
      const entry = bySubject.get(key)!;
      entry.total += Math.abs(t.amount);
      entry.count += 1;
      entry.categoryCounts.set(
        t.category,
        (entry.categoryCounts.get(t.category) || 0) + 1
      );
    }

    return [...bySubject.entries()]
      .map(([subject, data]) => {
        let maxCat = '';
        let maxCount = 0;
        for (const [cat, count] of data.categoryCounts) {
          if (count > maxCount) {
            maxCat = cat;
            maxCount = count;
          }
        }
        return {
          subject,
          total: data.total,
          count: data.count,
          categoryId: maxCat,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [filteredTransactions]);

  const getCategoryName = (categoryId: string) => {
    const cat = categories.find((c) => c.categoryId === categoryId);
    return cat ? `${cat.icon ?? ''} ${cat.name}`.trim() : categoryId;
  };

  const getCategoryColor = (categoryId: string) => {
    const cat = categories.find((c) => c.categoryId === categoryId);
    return cat?.color || '#94a3b8';
  };

  const getAccountName = (accountId: string) => {
    const acc = accounts.find((a) => a.accountId === accountId);
    return acc?.accountName || accountId;
  };

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const monthNames = [
    'Gennaio',
    'Febbraio',
    'Marzo',
    'Aprile',
    'Maggio',
    'Giugno',
    'Luglio',
    'Agosto',
    'Settembre',
    'Ottobre',
    'Novembre',
    'Dicembre',
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const renderCategoryChart = () => {
    const accountIds = [...categoryChartData.keys()];
    if (accountIds.length === 0) {
      return (
        <p
          className="text-center py-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          Nessuna spesa trovata per il periodo selezionato.
        </p>
      );
    }

    const maxTotal = Math.max(
      ...accountIds.map((id) => {
        let sum = 0;
        for (const v of categoryChartData.get(id)!.values()) sum += v;
        return sum;
      })
    );

    const barHeight = 40;
    const gap = 20;
    const labelWidth = 160;
    const totalLabelWidth = 100;
    const chartWidth = 800;
    const chartAreaWidth = chartWidth - labelWidth - totalLabelWidth;
    const svgHeight = accountIds.length * (barHeight + gap) + gap;

    return (
      <div className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${svgHeight}`}
          className="w-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ maxHeight: '500px' }}
        >
          {accountIds.map((accountId, i) => {
            const catMap = categoryChartData.get(accountId)!;
            const y = gap + i * (barHeight + gap);
            let x = labelWidth;
            const accountTotal = [...catMap.values()].reduce(
              (a, b) => a + b,
              0
            );
            const segments: React.ReactElement[] = [];

            const sortedCats = [...catMap.entries()].sort(
              (a, b) => b[1] - a[1]
            );

            for (const [catId, amount] of sortedCats) {
              const width =
                maxTotal > 0
                  ? (amount / maxTotal) * chartAreaWidth
                  : 0;
              const isHovered =
                hoveredSegment?.accountId === accountId &&
                hoveredSegment?.categoryId === catId;
              segments.push(
                <rect
                  key={`${accountId}-${catId}`}
                  x={x}
                  y={y}
                  width={width}
                  height={barHeight}
                  fill={getCategoryColor(catId)}
                  opacity={isHovered ? 1 : 0.85}
                  stroke={isHovered ? 'var(--text-primary)' : 'none'}
                  strokeWidth={isHovered ? 2 : 0}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    setHoveredSegment({
                      accountId,
                      categoryId: catId,
                    });
                    setTooltipPos({
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  onMouseMove={(e) =>
                    setTooltipPos({
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }
                  onMouseLeave={() => {
                    setHoveredSegment(null);
                    setTooltipPos(null);
                  }}
                >
                  <title>{`${getCategoryName(catId)}: ${formatCurrency(amount)}`}</title>
                </rect>
              );
              x += width;
            }

            return (
              <g key={accountId}>
                <text
                  x={labelWidth - 8}
                  y={y + barHeight / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="13"
                  fill="var(--text-primary)"
                >
                  {getAccountName(accountId)}
                </text>
                {segments}
                <text
                  x={
                    labelWidth +
                    (maxTotal > 0
                      ? (accountTotal / maxTotal) * chartAreaWidth
                      : 0) +
                    8
                  }
                  y={y + barHeight / 2}
                  dominantBaseline="middle"
                  fontSize="12"
                  fontWeight="600"
                  fill="var(--text-primary)"
                >
                  {formatCurrency(accountTotal)}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredSegment && tooltipPos && (
          <div
            className="fixed z-50 px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none"
            style={{
              left: tooltipPos.x + 12,
              top: tooltipPos.y - 10,
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          >
            <span className="font-medium">
              {getCategoryName(hoveredSegment.categoryId)}
            </span>
            {': '}
            {formatCurrency(
              categoryChartData
                .get(hoveredSegment.accountId)
                ?.get(hoveredSegment.categoryId) || 0
            )}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {categoryTotals.map(({ categoryId, total }) => (
            <div
              key={categoryId}
              className="flex items-center gap-2 text-sm"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: getCategoryColor(categoryId),
                }}
              />
              <span style={{ color: 'var(--text-primary)' }}>
                {getCategoryName(categoryId)}
              </span>
              <span
                className="ml-auto font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                {formatCurrency(total)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSubjectChart = () => {
    if (subjectChartData.length === 0) {
      return (
        <p
          className="text-center py-8"
          style={{ color: 'var(--text-secondary)' }}
        >
          Nessuna spesa trovata per il periodo selezionato.
        </p>
      );
    }

    const maxTotal = subjectChartData[0].total;
    const barHeight = 32;
    const gap = 12;
    const labelWidth = 200;
    const amountLabelWidth = 100;
    const chartWidth = 800;
    const chartAreaWidth = chartWidth - labelWidth - amountLabelWidth;
    const svgHeight =
      subjectChartData.length * (barHeight + gap) + gap;

    return (
      <div className="relative">
        <svg
          viewBox={`0 0 ${chartWidth} ${svgHeight}`}
          className="w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {subjectChartData.map((item, i) => {
            const y = gap + i * (barHeight + gap);
            const barWidth =
              maxTotal > 0
                ? (item.total / maxTotal) * chartAreaWidth
                : 0;
            const isHovered = hoveredSubject === item.subject;

            return (
              <g key={item.subject}>
                <text
                  x={labelWidth - 8}
                  y={y + barHeight / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize="12"
                  fill="var(--text-primary)"
                >
                  {item.subject.length > 28
                    ? item.subject.slice(0, 28) + '\u2026'
                    : item.subject}
                </text>
                <rect
                  x={labelWidth}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={getCategoryColor(item.categoryId)}
                  opacity={isHovered ? 1 : 0.85}
                  rx={4}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(e) => {
                    setHoveredSubject(item.subject);
                    setTooltipPos({
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  onMouseMove={(e) =>
                    setTooltipPos({
                      x: e.clientX,
                      y: e.clientY,
                    })
                  }
                  onMouseLeave={() => {
                    setHoveredSubject(null);
                    setTooltipPos(null);
                  }}
                >
                  <title>{`${item.subject}: ${formatCurrency(item.total)} (${item.count} transazioni)`}</title>
                </rect>
                <text
                  x={labelWidth + barWidth + 8}
                  y={y + barHeight / 2}
                  dominantBaseline="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--text-primary)"
                >
                  {formatCurrency(item.total)}
                </text>
              </g>
            );
          })}
        </svg>

        {hoveredSubject &&
          tooltipPos &&
          (() => {
            const item = subjectChartData.find(
              (d) => d.subject === hoveredSubject
            );
            if (!item) return null;
            return (
              <div
                className="fixed z-50 px-3 py-2 rounded-lg shadow-lg text-sm pointer-events-none"
                style={{
                  left: tooltipPos.x + 12,
                  top: tooltipPos.y - 10,
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                }}
              >
                <div className="font-medium">{item.subject}</div>
                <div>
                  {formatCurrency(item.total)} &mdash; {item.count}{' '}
                  transazioni
                </div>
              </div>
            );
          })()}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div
        className="p-4 rounded-lg shadow-sm border"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
        }}
      >
        <div className="flex flex-wrap gap-6">
          {/* Date range selector */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Periodo
            </label>
            {/* Preset buttons */}
            <div className="flex gap-2 mb-2">
              {([3, 6, 12] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => applyPreset(m)}
                  className="px-3 py-1 rounded-md text-xs font-semibold border transition-colors"
                  style={{
                    backgroundColor: 'var(--bg-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-primary)',
                  }}
                >
                  {m}M
                </button>
              ))}
            </div>
            {/* From / To */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Dal</span>
              <select
                value={fromMonth}
                onChange={(e) => setFromMonth(Number(e.target.value))}
                className="px-2 py-1.5 border rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                {monthNames.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
              <select
                value={fromYear}
                onChange={(e) => setFromYear(Number(e.target.value))}
                className="px-2 py-1.5 border rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>al</span>
              <select
                value={toMonth}
                onChange={(e) => setToMonth(Number(e.target.value))}
                className="px-2 py-1.5 border rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                {monthNames.map((name, i) => (
                  <option key={i} value={i + 1}>{name}</option>
                ))}
              </select>
              <select
                value={toYear}
                onChange={(e) => setToYear(Number(e.target.value))}
                className="px-2 py-1.5 border rounded-lg text-sm"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Account selector */}
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Conti
            </label>
            <div className="flex flex-wrap gap-3">
              {accounts.map((acc) => (
                <label
                  key={acc.accountId}
                  className="flex items-center gap-1.5 text-sm cursor-pointer"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedAccountIds.has(acc.accountId)}
                    onChange={() => toggleAccount(acc.accountId)}
                    className="rounded"
                  />
                  {acc.accountName}
                </label>
              ))}
            </div>
          </div>

          {/* Category selector — only in Per Categoria view */}
          {subView === 'categoria' && (
            <div>
              <label
                className="block text-sm font-medium mb-1"
                style={{ color: 'var(--text-secondary)' }}
              >
                Categorie
              </label>
              <div className="flex flex-wrap gap-3 max-h-24 overflow-y-auto">
                {categories.map((cat) => (
                  <label
                    key={cat.categoryId}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategoryIds.has(
                        cat.categoryId
                      )}
                      onChange={() =>
                        toggleCategory(cat.categoryId)
                      }
                      className="rounded"
                    />
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{
                        backgroundColor:
                          cat.color || '#94a3b8',
                      }}
                    />
                    {cat.icon ?? ''} {cat.name}
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sub-view toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setSubView('categoria')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            subView === 'categoria'
              ? 'bg-blue-600 text-white'
              : ''
          }`}
          style={
            subView !== 'categoria'
              ? {
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }
              : {}
          }
        >
          Per Categoria
        </button>
        <button
          onClick={() => setSubView('soggetto')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            subView === 'soggetto'
              ? 'bg-blue-600 text-white'
              : ''
          }`}
          style={
            subView !== 'soggetto'
              ? {
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                }
              : {}
          }
        >
          Per Soggetto
        </button>
      </div>

      {/* Chart area */}
      <div
        className="p-6 rounded-lg shadow-sm border"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <span
              className="ml-3"
              style={{ color: 'var(--text-secondary)' }}
            >
              Caricamento...
            </span>
          </div>
        ) : subView === 'categoria' ? (
          renderCategoryChart()
        ) : (
          renderSubjectChart()
        )}
      </div>
    </div>
  );
}
