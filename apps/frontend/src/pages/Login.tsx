import { generateCodeVerifier, generateCodeChallenge, generateState } from '../auth/pkce';
import { buildForgotPasswordUrl } from '../auth/tokens';

async function startLogin() {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  sessionStorage.setItem('oauth_state', state);
  sessionStorage.setItem('oauth_code_verifier', codeVerifier);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  window.location.href = `https://${domain}/oauth2/authorize?${params}`;
}

export function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div
        className="w-full max-w-sm rounded-2xl shadow-xl p-8 text-center"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', border: '1px solid var(--border-color)' }}
      >
        <div className="mb-8">
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center text-2xl font-bold text-white"
            style={{ backgroundColor: 'var(--accent-blue)' }}
          >
            B
          </div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Budget App
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Family budget tracker
          </p>
        </div>

        <button
          onClick={startLogin}
          className="w-full py-3 px-4 rounded-lg text-white font-semibold text-lg transition-colors duration-200 hover:opacity-90"
          style={{ backgroundColor: 'var(--accent-blue)' }}
        >
          Accedi
        </button>

        <div className="mt-6">
          <a
            href={buildForgotPasswordUrl()}
            className="text-sm hover:underline"
            style={{ color: 'var(--accent-blue)' }}
          >
            Reset password
          </a>
        </div>
      </div>
    </div>
  );
}
