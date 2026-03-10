import { getValidIdToken, clearTokens } from './tokens';

/**
 * Wrapper around fetch that injects the Authorization header
 * and handles 401 responses by redirecting to login.
 */
export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const token = await getValidIdToken();

  if (!token) {
    clearTokens();
    window.location.href = '/login';
    return new Response(null, { status: 401 });
  }

  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    clearTokens();
    window.location.href = '/login';
  }

  return response;
}
