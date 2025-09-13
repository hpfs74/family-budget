import { Link, useLocation } from 'react-router-dom';

export function Navigation() {
  const location = useLocation();

  const navStyle = {
    backgroundColor: '#1f2937',
    padding: '1rem 0',
    marginBottom: '2rem'
  };

  const containerStyle = {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 1rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const logoStyle = {
    color: '#fff',
    fontSize: '1.5rem',
    fontWeight: 'bold',
    textDecoration: 'none'
  };

  const navLinksStyle = {
    display: 'flex',
    gap: '2rem',
    listStyle: 'none',
    margin: 0,
    padding: 0
  };

  const linkStyle = (isActive: boolean) => ({
    color: isActive ? '#60a5fa' : '#d1d5db',
    textDecoration: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '0.375rem',
    backgroundColor: isActive ? '#374151' : 'transparent',
    transition: 'all 0.2s'
  });

  return (
    <nav style={navStyle}>
      <div style={containerStyle}>
        <Link to="/" style={logoStyle}>
          Budget App
        </Link>
        <ul style={navLinksStyle}>
          <li>
            <Link
              to="/"
              style={linkStyle(location.pathname === '/')}
            >
              DateTime
            </Link>
          </li>
          <li>
            <Link
              to="/accounts"
              style={linkStyle(location.pathname === '/accounts')}
            >
              Bank Accounts
            </Link>
          </li>
          <li>
            <Link
              to="/transactions"
              style={linkStyle(location.pathname === '/transactions')}
            >
              Transactions
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}