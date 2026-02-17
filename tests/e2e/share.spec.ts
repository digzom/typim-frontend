import { expect, test } from '@playwright/test';

test('share modal opens from menu', async ({ page }) => {
  await page.goto('/?cm6=true');

  await page.click('#menu-btn');
  await page.click('#menu-share');

  await expect(page.locator('#share-modal')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#share-create')).toBeVisible();
});

test('share create sends expected payload and shows URL', async ({ page }) => {
  let createPayload: Record<string, unknown> | null = null;

  await page.route('**/api/share', async route => {
    createPayload = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'share-1',
        url: 'https://example.test/s/share-1',
        shareType: 'static',
        privacy: 'secret',
      }),
    });
  });

  await page.goto('/?cm6=true');
  await page.click('#menu-btn');
  await page.click('#menu-share');
  await page.click('#share-create');

  await expect(page.locator('#share-url')).toHaveValue('https://example.test/s/share-1');
  expect(createPayload).toMatchObject({
    title: 'Untitled',
    shareType: 'static',
    privacy: 'secret',
  });
});

test('share update sends edit token header for live shares', async ({ page }) => {
  let updateHeaders: Record<string, string> | null = null;

  await page.route('**/api/share', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'share-1',
        url: 'https://example.test/s/live-1',
        shareType: 'live',
        privacy: 'secret',
        editToken: 'edit-token',
      }),
    });
  });

  await page.route('**/api/share/share-1', async route => {
    updateHeaders = route.request().headers();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'share-1',
        url: 'https://example.test/s/live-1-updated',
        shareType: 'live',
        privacy: 'secret',
      }),
    });
  });

  await page.goto('/?cm6=true');
  await page.click('#menu-btn');
  await page.click('#menu-share');

  await page.selectOption('#share-type', 'live');
  await page.click('#share-create');
  await expect(page.locator('#share-update')).toBeEnabled();

  await page.click('#share-update');
  await expect(page.locator('#share-url')).toHaveValue('https://example.test/s/live-1-updated');
  expect(updateHeaders?.['x-share-edit-token']).toBe('edit-token');
});
