import { Routes, Route } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import { DateTime } from '../components/DateTime';
import { BankAccounts } from '../components/BankAccounts';
import { Transactions } from '../components/Transactions';

export function App() {
  const appStyle = {
    minHeight: '100vh',
    backgroundColor: '#f8fafc'
  };

  return (
    <div style={appStyle}>
      <Navigation />
      <Routes>
        <Route path="/" element={<DateTime />} />
        <Route path="/accounts" element={<BankAccounts />} />
        <Route path="/transactions" element={<Transactions />} />
      </Routes>
    </div>
  );
}

export default App;
