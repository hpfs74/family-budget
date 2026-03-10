const TOKEN_KEYS = {
  idToken: 'budget_id_token',
  accessToken: 'budget_access_token',
  refreshToken: 'budget_refresh_token',
  expiresAt: 'budget_token_expires_at',
} as const;

export interface TokenSet {
  id_token: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

/** Persist tokens to localStorage. */
export function storeTokens(tokens: TokenSet): void {
  localStorage.setItem(TOKEN_KEYS.idToken, tokens.id_token);
  localStorage.setItem(TOKEN_KEYS.accessToken, tokens.access_token);
  if (tokens.refresh_token) {
    localStorage.setItem(TOKEN_KEYS.refreshToken, tokens.refresh_token);
  }
  const expiresAt = Date.now() + tokens.expires_in * 1000;
  localStorage.setItem(TOKEN_KEYS.expiresAt, String(expiresAt));
}

/** Remove all stored tokens. */
export function clearTokens(): void {
  Object.values(TOKEN_KEYS).forEach((key) => localStorage.removeItem(key));
}

/** Check whether the stored tokens are still valid (with 60s buffer). */
export function isAuthenticated(): boolean {
  const expiresAt = localStorage.getItem(TOKEN_KEYS.expiresAt);
  const idToken = localStorage.getItem(TOKEN_KEYS.idToken);
  if (!expiresAt || !idToken) return false;
  return Date.now() < Number(expiresAt) - 60_000;
}

/** Return the current ID token, or null if expired/missing. */
export function getIdToken(): string | null {
  if (!isAuthenticated()) return null;
  return localStorage.getItem(TOKEN_KEYS.idToken);
}

/** Return the stored refresh token. */
function getRefreshToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.refreshToken);
}

/** Build the Cognito domain from env vars. */
function getCognitoDomain(): string {
  return import.meta.env.VITE_COGNITO_DOMAIN;
}

function getClientId(): string {
  return import.meta.env.VITE_COGNITO_CLIENT_ID;
}

/** Exchange a refresh token for a new token set. Returns true on success. */
export async function refreshTokens(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const domain = getCognitoDomain();
    const clientId = getClientId();

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: refreshToken,
    });

    const response = await fetch(`https://${domain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) return false;

    const data = await response.json();
    storeTokens({ ...data, refresh_token: refreshToken });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get a valid ID token, refreshing if needed.
 * Returns null if no valid token can be obtained.
 */
export async function getValidIdToken(): Promise<string | null> {
  const token = getIdToken();
  if (token) return token;

  const refreshed = await refreshTokens();
  if (refreshed) return getIdToken();

  return null;
}

/** Build the Cognito logout URL. */
export function buildLogoutUrl(): string {
  const domain = getCognitoDomain();
  const clientId = getClientId();
  const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI;

  const params = new URLSearchParams({
    client_id: clientId,
    logout_uri: logoutUri,
  });

  return `https://${domain}/logout?${params}`;
}

/** Build the Cognito forgot-password URL. */
export function buildForgotPasswordUrl(): string {
  const domain = getCognitoDomain();
  const clientId = getClientId();
  const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI;

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
  });

  return `https://${domain}/forgotPassword?${params}`;
}
