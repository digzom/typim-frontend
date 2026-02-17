import { expect, test } from '@playwright/test';

async function assertModeBootsAndRenders(
  url: string,
  page: import('@playwright/test').Page
): Promise<void> {
  const consoleErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await page.goto(url);
  await expect(page.locator('#editor')).toBeVisible();

  await page.click('#editor');
  await page.keyboard.type('Mode check');
  await expect(page.locator('#preview')).toContainText('Mode check');

  expect(consoleErrors).toEqual([]);
}

test('cm6 mode initializes with no console errors', async ({ page }) => {
  await assertModeBootsAndRenders('/?cm6=true', page);
});

test('cm5 fallback mode initializes with no console errors', async ({ page }) => {
  await assertModeBootsAndRenders('/?cm6=false', page);
});
