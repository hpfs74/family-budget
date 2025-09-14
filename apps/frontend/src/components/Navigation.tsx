import { Link, useLocation } from 'react-router-dom';

export function Navigation() {
  const location = useLocation();

  const getLinkClasses = (isActive: boolean) => {
    return `px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 no-underline ${
      isActive
        ? 'text-blue-400 bg-gray-700'
        : 'text-gray-300 hover:text-white hover:bg-gray-600'
    }`;
  };

  return (
    <nav className="bg-gray-800 py-4 mb-8 shadow-lg">
      <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
        <Link to="/" className="text-white text-2xl font-bold no-underline hover:text-gray-300 transition-colors">
          💰 Budget App
        </Link>
        <ul className="flex space-x-8 list-none m-0 p-0">
          <li>
            <Link
              to="/"
              className={getLinkClasses(location.pathname === '/')}
            >
              📊 Dashboard
            </Link>
          </li>
          <li>
            <Link
              to="/accounts"
              className={getLinkClasses(location.pathname === '/accounts')}
            >
              🏦 Bank Accounts
            </Link>
          </li>
          <li>
            <Link
              to="/categories"
              className={getLinkClasses(location.pathname === '/categories')}
            >
              📈 Categories
            </Link>
          </li>
          <li>
            <Link
              to="/transactions"
              className={getLinkClasses(location.pathname === '/transactions')}
            >
              💳 Transactions
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}