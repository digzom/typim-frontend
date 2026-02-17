import { expect, test } from '@playwright/test';

test('open file loads markdown content into preview', async ({ page }) => {
  await page.goto('/?cm6=true');

  await page.setInputFiles('#file-input', {
    name: 'note.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Opened from disk\n\ncontent line'),
  });

  await expect(page.locator('#preview')).toContainText('Opened from disk');
  await expect(page.locator('#preview')).toContainText('content line');
});

test('save shortcut produces markdown download', async ({ page }) => {
  await page.goto('/?cm6=true');

  await page.click('#editor');
  await page.keyboard.type('save-file-check');

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.keyboard.press('Control+S'),
  ]);

  expect(download.suggestedFilename()).toMatch(/\.md$/);
});
