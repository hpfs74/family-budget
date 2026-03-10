import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { storeTokens } from './tokens';

export function Callback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const storedState = sessionStorage.getItem('oauth_state');

    if (!code) {
      setError('No authorization code received');
      return;
    }

    if (state !== storedState) {
      setError('Invalid state parameter — possible CSRF attack');
      return;
    }

    const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
    if (!codeVerifier) {
      setError('Missing PKCE code verifier');
      return;
    }

    const domain = import.meta.env.VITE_COGNITO_DOMAIN;
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    fetch(`https://${domain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
        return res.json();
      })
      .then((tokens) => {
        storeTokens(tokens);
        sessionStorage.removeItem('oauth_state');
        sessionStorage.removeItem('oauth_code_verifier');
        navigate('/', { replace: true });
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Authentication Error</h1>
          <p className="text-gray-600 mb-4" style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <a href="/login" className="text-blue-600 hover:underline">Back to login</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p style={{ color: 'var(--text-secondary)' }}>Authenticating...</p>
      </div>
    </div>
  );
}
