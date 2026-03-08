import { test, expect } from '@playwright/test';
import { NavigationPage } from './pages/navigation.page';

test.describe('Navigation', () => {
  test('shows app title in nav bar', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await expect(nav.appTitle).toBeVisible();
  });

  test('navigates to Bank Accounts page', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await nav.accountsLink.click();
    await expect(page).toHaveURL(/\/accounts/);
  });

  test('navigates to Categories page', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await nav.categoriesLink.click();
    await expect(page).toHaveURL(/\/categories/);
  });

  test('navigates to Budget page', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await nav.budgetLink.click();
    await expect(page).toHaveURL(/\/budget/);
  });

  test('navigates to Transactions page', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await nav.transactionsLink.click();
    await expect(page).toHaveURL(/\/transactions/);
  });

  test('app title navigates back to dashboard', async ({ page }) => {
    const nav = new NavigationPage(page);
    await nav.goto();
    await nav.accountsLink.click();
    await nav.appTitle.click();
    await expect(page).toHaveURL('/');
  });
});
