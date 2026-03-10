import { useState, useMemo, FormEvent } from 'react';
import { usePageTitle } from '../hooks/usePageTitle';
import { getIdToken, getAccessToken, decodeToken } from '../auth/tokens';

export function Profile() {
  usePageTitle('Profilo');

  const userInfo = useMemo(() => {
    const token = getIdToken();
    if (!token) return null;
    const payload = decodeToken(token);
    return {
      email: payload.email as string | undefined,
      name: (payload.name ?? payload.given_name) as string | undefined,
      sub: payload.sub as string | undefined,
    };
  }, []);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setStatus(null);

    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Le password non coincidono.' });
      return;
    }

    const accessToken = getAccessToken();
    if (!accessToken) {
      setStatus({ type: 'error', message: 'Sessione scaduta. Effettua nuovamente il login.' });
      return;
    }

    setLoading(true);
    try {
      const region = import.meta.env.VITE_COGNITO_REGION ?? 'eu-south-1';
      const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.ChangePassword',
        },
        body: JSON.stringify({
          AccessToken: accessToken,
          PreviousPassword: currentPassword,
          ProposedPassword: newPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        const msg = data.message || data.__type || 'Errore durante il cambio password.';
        setStatus({ type: 'error', message: msg });
        return;
      }

      setStatus({ type: 'success', message: 'Password aggiornata con successo.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setStatus({ type: 'error', message: 'Errore di rete. Riprova più tardi.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>
        Profilo
      </h1>

      {/* User Info Card */}
      <div
        className="p-6 rounded-lg shadow-sm border mb-8"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
        }}
      >
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          Informazioni utente
        </h2>
        <dl className="space-y-3">
          {userInfo?.name && (
            <div>
              <dt className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Nome</dt>
              <dd className="text-lg" style={{ color: 'var(--text-primary)' }}>{userInfo.name}</dd>
            </div>
          )}
          {userInfo?.email && (
            <div>
              <dt className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Email</dt>
              <dd className="text-lg" style={{ color: 'var(--text-primary)' }}>{userInfo.email}</dd>
            </div>
          )}
          {userInfo?.sub && (
            <div>
              <dt className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>ID utente</dt>
              <dd className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>{userInfo.sub}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Change Password Card */}
      <div
        className="p-6 rounded-lg shadow-sm border"
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
        }}
      >
        <h2 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
          Cambia password
        </h2>

        {status && (
          <div
            className={`mb-4 rounded-lg p-4 border ${
              status.type === 'success'
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <p
              className={`text-sm font-medium ${
                status.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {status.message}
            </p>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-primary)' }}
            >
              Password attuale
            </label>
            <input
              id="currentPassword"
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-primary)' }}
            >
              Nuova password
            </label>
            <input
              id="newPassword"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-primary)' }}
            >
              Conferma nuova password
            </label>
            <input
              id="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              style={{
                backgroundColor: 'var(--bg-primary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Aggiornamento...' : 'Cambia password'}
          </button>
        </form>
      </div>
    </div>
  );
}
