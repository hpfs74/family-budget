import { generateCodeVerifier, generateCodeChallenge, generateState } from '../pkce';

// Polyfill crypto for Node.js test environment
if (typeof globalThis.crypto === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { webcrypto } = require('crypto');
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto });
}

describe('PKCE helpers', () => {
  describe('generateCodeVerifier', () => {
    it('returns a string of the requested length', () => {
      const verifier = generateCodeVerifier(64);
      expect(verifier).toHaveLength(64);
    });

    it('defaults to 64 characters', () => {
      const verifier = generateCodeVerifier();
      expect(verifier).toHaveLength(64);
    });

    it('generates different values each time', () => {
      const a = generateCodeVerifier();
      const b = generateCodeVerifier();
      expect(a).not.toBe(b);
    });

    it('contains only URL-safe characters', () => {
      const verifier = generateCodeVerifier(128);
      expect(verifier).toMatch(/^[A-Za-z0-9\-._~]+$/);
    });
  });

  describe('generateCodeChallenge', () => {
    it('returns a base64url-encoded string without padding', async () => {
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
      expect(challenge).not.toContain('=');
    });

    it('produces a 43-character hash for SHA-256', async () => {
      const challenge = await generateCodeChallenge('test-verifier');
      // SHA-256 = 32 bytes → ceil(32 * 4/3) = 43 base64url chars (no padding)
      expect(challenge).toHaveLength(43);
    });

    it('is deterministic for the same input', async () => {
      const a = await generateCodeChallenge('same-verifier');
      const b = await generateCodeChallenge('same-verifier');
      expect(a).toBe(b);
    });

    it('produces different challenges for different verifiers', async () => {
      const a = await generateCodeChallenge('verifier-1');
      const b = await generateCodeChallenge('verifier-2');
      expect(a).not.toBe(b);
    });
  });

  describe('generateState', () => {
    it('returns a 32-character string', () => {
      const state = generateState();
      expect(state).toHaveLength(32);
    });

    it('generates unique values', () => {
      const states = new Set(Array.from({ length: 10 }, () => generateState()));
      expect(states.size).toBe(10);
    });
  });
});
