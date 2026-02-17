import { expect, test } from '@playwright/test';

test('layout toggles between split and single on desktop', async ({ page }) => {
  await page.goto('/');

  const initialLayout = await page.locator('body').getAttribute('data-layout');

  await page.click('#menu-btn');
  await page.click('#menu-split');

  const nextLayout = await page.locator('body').getAttribute('data-layout');

  expect(initialLayout).not.toBe(nextLayout);
  await expect(page.locator('body')).toHaveAttribute('data-layout', /split|single/);
});

test('mobile layout contract maps state to canonical attributes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?cm6=true');

  await expect(page.locator('body')).toHaveAttribute('data-layout', 'mobile');
  await expect(page.locator('body')).toHaveAttribute('data-mobile-pane', 'editor');
  await expect(page.locator('.editor-pane')).toBeVisible();
  await expect(page.locator('.preview-pane')).toBeHidden();

  await page.click('#menu-btn');
  await page.click('#menu-split');

  await expect(page.locator('body')).toHaveAttribute('data-layout', 'mobile');
  await expect(page.locator('body')).toHaveAttribute('data-mobile-pane', 'preview');
  await expect(page.locator('.editor-pane')).toBeHidden();
  await expect(page.locator('.preview-pane')).toBeVisible();

  await page.click('#menu-btn');
  await page.click('#menu-split');

  await expect(page.locator('body')).toHaveAttribute('data-mobile-pane', 'editor');
  await expect(page.locator('.editor-pane')).toBeVisible();
  await expect(page.locator('.preview-pane')).toBeHidden();
});

test('topbar remains pinned while panes scroll and hides in focus mode', async ({ page }) => {
  await page.goto('/?cm6=true&scroll=true');

  await page.evaluate(async () => {
    const lines = Array.from({ length: 320 }, (_, index) => `line ${String(index + 1)}`).join('\n');
    const app = window as unknown as {
      typim?: {
        whenReady?: () => Promise<{
          editor: {
            setValue(value: string): void;
          };
        }>;
      };
    };

    const diagnostics = await app.typim?.whenReady?.();
    diagnostics?.editor.setValue(lines);
  });

  const initialTop = await page.locator('.topbar').evaluate(element => {
    return Math.round(element.getBoundingClientRect().top);
  });

  await page.locator('#editor').hover();
  await page.mouse.wheel(0, 1400);
  await page.locator('#preview').hover();
  await page.mouse.wheel(0, 1400);

  const afterScrollTop = await page.locator('.topbar').evaluate(element => {
    return Math.round(element.getBoundingClientRect().top);
  });

  expect(initialTop).toBe(0);
  expect(afterScrollTop).toBe(0);

  await page.click('.cm-content');
  await page.keyboard.press('Control+Shift+F');
  await expect(page.locator('.topbar')).toBeHidden();
  await page.keyboard.press('Control+Escape');
  await expect(page.locator('.topbar')).toBeVisible();
});
