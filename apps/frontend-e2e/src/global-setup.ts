import { chromium, FullConfig } from '@playwright/test';
import https from 'https';

async function getCognitoToken(): Promise<{ idToken: string; accessToken: string } | null> {
  const clientId = process.env['COGNITO_CLIENT_ID'];
  const username = process.env['E2E_COGNITO_USER'];
  const password = process.env['E2E_COGNITO_PASS'];
  const region = process.env['AWS_REGION'] ?? 'eu-south-1';
  if (!clientId || !username || !password) return null;

  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    });
    const req = https.request(
      {
        hostname: `cognito-idp.${region}.amazonaws.com`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const result = parsed?.AuthenticationResult;
            if (result?.IdToken) {
              resolve({ idToken: result.IdToken, accessToken: result.AccessToken });
            } else {
              console.error('Cognito auth failed:', data);
              resolve(null);
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? 'http://localhost:4200';
  const tokens = await getCognitoToken();
  if (!tokens) {
    console.warn('⚠️  No Cognito credentials found — tests will run unauthenticated');
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to app so we're on the right origin for localStorage
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});

  // Inject tokens into localStorage (keys must match TOKEN_KEYS in auth/tokens.ts)
  await page.evaluate(({ idToken, accessToken }) => {
    localStorage.setItem('budget_id_token', idToken);
    localStorage.setItem('budget_access_token', accessToken);
    // Set expiry 1 hour from now (in ms) so isAuthenticated() returns true
    localStorage.setItem('budget_token_expires_at', String(Date.now() + 3600 * 1000));
  }, tokens);

  // Save storage state (cookies + localStorage) for reuse in all tests
  await context.storageState({ path: 'playwright-auth.json' });
  await browser.close();

  console.log('✅ Playwright auth state saved');
}

export default globalSetup;
