import { Routes, Route } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import { Dashboard } from '../components/Dashboard';
import { BankAccounts } from '../components/BankAccounts';
import { Categories } from '../components/Categories';
import { Transactions } from '../components/Transactions';

export function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/accounts" element={<BankAccounts />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/transactions" element={<Transactions />} />
      </Routes>
    </div>
  );
}

export default App;
