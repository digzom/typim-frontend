import { expect, test } from '@playwright/test';

test('theme toggles via menu', async ({ page }) => {
  await page.goto('/');

  const initialTheme = await page.locator('body').getAttribute('data-theme');

  await page.click('#menu-btn');
  await page.click('#menu-theme');

  const nextTheme = await page.locator('body').getAttribute('data-theme');

  expect(initialTheme).not.toBe(nextTheme);
});
