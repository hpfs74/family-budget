import axios, { AxiosInstance } from 'axios';

const baseURL = process.env['API_BASE_URL'];
if (!baseURL) throw new Error('API_BASE_URL env var is required');

/** Obtain a Cognito id_token via USER_PASSWORD_AUTH for E2E testing */
async function getCognitoToken(): Promise<string | null> {
  const userPoolClientId = process.env['COGNITO_CLIENT_ID'];
  const e2eUser = process.env['E2E_COGNITO_USER'];
  const e2ePass = process.env['E2E_COGNITO_PASS'];
  const region = process.env['AWS_REGION'] ?? 'eu-south-1';
  if (!userPoolClientId || !e2eUser || !e2ePass) return null;
  const res = await axios.post(
    `https://cognito-idp.${region}.amazonaws.com/`,
    {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: userPoolClientId,
      AuthParameters: { USERNAME: e2eUser, PASSWORD: e2ePass },
    },
    { headers: { 'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth', 'Content-Type': 'application/x-amz-json-1.1' } }
  );
  return res.data?.AuthenticationResult?.IdToken ?? null;
}

let idToken: string | null = null;

const api: AxiosInstance = axios.create({
  baseURL: baseURL.replace(/\/$/, ''), // strip trailing slash
  timeout: 10_000,
});

// Inject auth token before each test suite
beforeAll(async () => {
  idToken = await getCognitoToken();
  if (idToken) {
    api.defaults.headers.common['Authorization'] = `Bearer ${idToken}`;
  }
});

let createdAccountId: string;
let createdCategoryId: string;
let createdBudgetId: string;

describe('Accounts API', () => {
  it('creates an account', async () => {
    const res = await api.post('/accounts', {
      accountName: 'E2E Test Account',
      accountNumber: 'GB00TEST0001',
      bankName: 'E2E Bank',
      accountType: 'CHECKING',
      currency: 'EUR',
      balance: 1000,
    });
    expect(res.status).toBe(201);
    expect(res.data.accountId).toBeDefined();
    createdAccountId = res.data.accountId;
  });

  it('lists accounts and includes the created one', async () => {
    const res = await api.get('/accounts');
    expect(res.status).toBe(200);
    const accounts: { accountId: string }[] = res.data.accounts ?? res.data;
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.some((a) => a.accountId === createdAccountId)).toBe(true);
  });

  it('gets the account by id', async () => {
    const res = await api.get(`/accounts/${createdAccountId}`);
    expect(res.status).toBe(200);
    expect(res.data.accountName).toBe('E2E Test Account');
  });

  it('updates the account', async () => {
    const res = await api.put(`/accounts/${createdAccountId}`, { accountName: 'Updated E2E Account' });
    expect(res.status).toBe(200);
  });

  it('deletes the account', async () => {
    const res = await api.delete(`/accounts/${createdAccountId}`);
    expect(res.status).toBe(204);
  });
});

describe('Categories API', () => {
  it('creates a category', async () => {
    const res = await api.post('/categories', { name: 'E2E Category', color: '#ff0000' });
    expect(res.status).toBe(201);
    expect(res.data.categoryId).toBeDefined();
    createdCategoryId = res.data.categoryId;
  });

  it('lists categories and includes the created one', async () => {
    const res = await api.get('/categories');
    expect(res.status).toBe(200);
    const categories: { categoryId: string }[] = res.data.categories ?? res.data;
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.some((c) => c.categoryId === createdCategoryId)).toBe(true);
  });

  it('gets the category by id', async () => {
    const res = await api.get(`/categories/${createdCategoryId}`);
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('E2E Category');
  });

  it('updates the category', async () => {
    const res = await api.put(`/categories/${createdCategoryId}`, { name: 'Updated E2E Category' });
    expect(res.status).toBe(200);
  });

  it('deletes the category', async () => {
    const res = await api.delete(`/categories/${createdCategoryId}`);
    expect(res.status).toBe(204);
  });
});

describe('Budget API', () => {
  let budgetCategoryId: string;

  beforeAll(async () => {
    const res = await api.post('/categories', { name: 'Budget E2E Category', color: '#0000ff' });
    budgetCategoryId = res.data.categoryId;
  });

  afterAll(async () => {
    await api.delete(`/categories/${budgetCategoryId}`);
  });

  it('creates a budget', async () => {
    const res = await api.post('/budget', {
      name: 'E2E Budget',
      categoryId: budgetCategoryId,
      amount: 500,
      currency: 'EUR',
      type: 'monthly',
      startMonth: '2026-01',
      endMonth: '2026-12',
      year: 2026,
    });
    expect(res.status).toBe(201);
    expect(res.data.budgetId).toBeDefined();
    createdBudgetId = res.data.budgetId;
  });

  it('lists budgets and includes the created one', async () => {
    const res = await api.get('/budget');
    expect(res.status).toBe(200);
    const items: { budgetId: string }[] = res.data.items ?? res.data.budgets ?? res.data;
    expect(Array.isArray(items)).toBe(true);
    expect(items.some((b) => b.budgetId === createdBudgetId)).toBe(true);
  });

  it('gets the budget by id', async () => {
    const res = await api.get(`/budget/${createdBudgetId}`);
    expect(res.status).toBe(200);
    expect(res.data.name).toBe('E2E Budget');
  });

  it('updates the budget', async () => {
    const res = await api.put(`/budget/${createdBudgetId}`, { name: 'Updated E2E Budget' });
    expect(res.status).toBe(200);
  });

  it('deletes the budget', async () => {
    const res = await api.delete(`/budget/${createdBudgetId}`);
    expect(res.status).toBe(204);
  });
});

describe('Transactions API', () => {
  let txAccountId: string;
  let createdTransactionId: string;

  beforeAll(async () => {
    const res = await api.post('/accounts', {
      accountName: 'E2E Tx Account',
      accountNumber: 'GB00TEST0002',
      bankName: 'E2E Bank',
      accountType: 'CHECKING',
      currency: 'EUR',
      balance: 500,
    });
    txAccountId = res.data.accountId;
  });

  afterAll(async () => {
    await api.delete(`/accounts/${txAccountId}`);
  });

  it('creates a transaction', async () => {
    const res = await api.post('/transactions', {
      account: txAccountId,
      amount: -50,
      description: 'E2E Test Transaction',
      date: '2026-03-08',
      currency: 'EUR',
      type: 'expense',
    });
    expect(res.status).toBe(201);
    expect(res.data.transactionId).toBeDefined();
    createdTransactionId = res.data.transactionId;
  });

  it('lists transactions for the account', async () => {
    const res = await api.get(`/transactions?account=${txAccountId}`);
    expect(res.status).toBe(200);
    const transactions: { transactionId: string }[] = res.data.transactions ?? res.data;
    expect(Array.isArray(transactions)).toBe(true);
    expect(transactions.some((t) => t.transactionId === createdTransactionId)).toBe(true);
  });

  it('gets the transaction by id', async () => {
    const res = await api.get(`/transactions/${createdTransactionId}?account=${txAccountId}`);
    expect(res.status).toBe(200);
    expect(res.data.description).toBe('E2E Test Transaction');
  });

  it('deletes the transaction', async () => {
    const res = await api.delete(`/transactions/${createdTransactionId}?account=${txAccountId}`);
    expect(res.status).toBe(204);
  });
});
