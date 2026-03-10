/** Generate a cryptographically random string of `length` characters. */
function randomString(length: number): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => charset[v % charset.length]).join('');
}

/** Generate a PKCE code verifier (43-128 chars). */
export function generateCodeVerifier(length = 64): string {
  return randomString(length);
}

/** Derive the S256 code challenge from a verifier. */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

/** Generate a random state parameter for CSRF protection. */
export function generateState(): string {
  return randomString(32);
}

/** Base64-URL encode an ArrayBuffer (no padding). */
function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
