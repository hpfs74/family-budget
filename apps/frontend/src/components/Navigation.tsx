import { Link, useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { clearTokens, buildLogoutUrl } from '../auth/tokens';

export function Navigation() {
  const location = useLocation();
  const { theme, toggle } = useTheme();

  const getLinkClasses = (isActive: boolean) => {
    return `px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 no-underline ${
      isActive
        ? 'text-blue-400 bg-gray-700'
        : 'text-gray-300 hover:text-white hover:bg-gray-600'
    }`;
  };

  const handleLogout = () => {
    const logoutUrl = buildLogoutUrl();
    clearTokens();
    window.location.href = logoutUrl;
  };

  return (
    <nav className="py-4 mb-8 shadow-lg" style={{ backgroundColor: 'var(--nav-bg)' }}>
      <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-bold no-underline hover:opacity-80 transition-colors" style={{ color: 'var(--nav-text)' }}>
          Budget App
        </Link>
        <div className="flex items-center gap-4">
          <ul className="flex space-x-8 list-none m-0 p-0">
            <li>
              <Link to="/" className={getLinkClasses(location.pathname === '/')}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link to="/accounts" className={getLinkClasses(location.pathname === '/accounts')}>
                Bank Accounts
              </Link>
            </li>
            <li>
              <Link to="/categories" className={getLinkClasses(location.pathname === '/categories')}>
                Categories
              </Link>
            </li>
            <li>
              <Link to="/budget" className={getLinkClasses(location.pathname === '/budget')}>
                Budget
              </Link>
            </li>
            <li>
              <Link to="/transactions" className={getLinkClasses(location.pathname === '/transactions')}>
                Transactions
              </Link>
            </li>
          </ul>
          <Link
            to="/profile"
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-gray-600 no-underline"
            style={{ color: 'var(--nav-text)' }}
            title="Profilo"
          >
            Profilo
          </Link>
          <button
            onClick={toggle}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-colors duration-200 hover:bg-gray-600"
            style={{ color: 'var(--nav-text)' }}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'dark' ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-gray-600"
            style={{ color: 'var(--nav-text)' }}
            title="Logout"
          >
            Esci
          </button>
        </div>
      </div>
    </nav>
  );
}
