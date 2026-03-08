import { Page, Locator } from '@playwright/test';

export class NavigationPage {
  readonly page: Page;
  readonly appTitle: Locator;
  readonly dashboardLink: Locator;
  readonly accountsLink: Locator;
  readonly categoriesLink: Locator;
  readonly budgetLink: Locator;
  readonly transactionsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.appTitle = page.getByRole('link', { name: /Budget App/i });
    this.dashboardLink = page.getByRole('link', { name: /Dashboard/i });
    this.accountsLink = page.getByRole('link', { name: /Bank Accounts/i });
    this.categoriesLink = page.getByRole('link', { name: /Categories/i });
    this.budgetLink = page.getByRole('link', { name: /Budget/i });
    this.transactionsLink = page.getByRole('link', { name: /Transactions/i });
  }

  async goto() {
    await this.page.goto('/');
  }
}
