import { Routes, Route } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { Dashboard } from '../components/Dashboard';
import { BankAccounts } from '../components/BankAccounts';
import { Categories } from '../components/Categories';
import { Transactions } from '../components/Transactions';
import { Budget } from '../components/Budget';
import { Login } from '../pages/Login';
import { Callback } from '../auth/callback';

export function App() {
  return (
    <div className="min-h-screen">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/callback" element={<Callback />} />
        <Route
          path="*"
          element={
            <ProtectedRoute>
              <Navigation />
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/accounts" element={<BankAccounts />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/budget" element={<Budget />} />
                <Route path="/transactions" element={<Transactions />} />
              </Routes>
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
