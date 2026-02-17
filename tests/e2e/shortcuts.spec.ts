import { expect, test, type Page } from '@playwright/test';

async function editorText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const content = document.querySelector('.cm-content');
    return content?.textContent ?? '';
  });
}

async function dispatchCtrlW(page: Page, selector: string): Promise<void> {
  await page.evaluate((targetSelector: string) => {
    const target = document.querySelector(targetSelector);
    if (!target) {
      return;
    }

    const event = new KeyboardEvent('keydown', {
      key: 'w',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    target.dispatchEvent(event);
  }, selector);
}

test('theme and modal shortcuts work', async ({ page }) => {
  await page.goto('/?cm6=true&livemd=true');
  await page.click('.cm-content');

  const initialTheme = await page.locator('body').getAttribute('data-theme');
  await page.keyboard.press('Control+Shift+D');
  const updatedTheme = await page.locator('body').getAttribute('data-theme');
  expect(updatedTheme).not.toBe(initialTheme);

  await page.evaluate(() => {
    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: '/',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
  });
  await expect(page.locator('#shortcuts-modal')).toHaveAttribute('aria-hidden', 'false');
});

test('shortcuts guide hotkeys open from editor and non-editor focus', async ({ page }) => {
  await page.goto('/?cm6=true&livemd=true');

  await page.click('.cm-content');
  await page.keyboard.press('Control+/');
  await expect(page.locator('#shortcuts-modal')).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.press('Escape');

  await page.click('.cm-content');
  await page.keyboard.press('F1');
  await expect(page.locator('#shortcuts-modal')).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.press('Escape');

  await page.click('#doc-title');
  await page.keyboard.press('Control+/');
  await expect(page.locator('#shortcuts-modal')).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.press('Escape');

  await page.click('#doc-title');
  await page.keyboard.press('F1');
  await expect(page.locator('#shortcuts-modal')).toHaveAttribute('aria-hidden', 'false');

  const themeBeforeBlockedKey = await page.locator('body').getAttribute('data-theme');
  const blockedModalKey = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: 'D',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const dispatchResult = document.dispatchEvent(event);

    return {
      defaultPrevented: event.defaultPrevented,
      dispatchResult,
    };
  });
  const themeAfterBlockedKey = await page.locator('body').getAttribute('data-theme');

  expect(blockedModalKey.defaultPrevented).toBe(true);
  expect(blockedModalKey.dispatchResult).toBe(false);
  expect(themeAfterBlockedKey).toBe(themeBeforeBlockedKey);

  await page.keyboard.press('F1');
  await expect(page.locator('#shortcuts-modal')).toHaveAttribute('aria-hidden', 'false');
  await page.keyboard.press('Escape');
});

test('Ctrl+W shortcut guard matrix', async ({ page }) => {
  await page.goto('/?cm6=true&livemd=true');

  await page.click('.cm-content');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('alpha beta');
  const beforeIntercept = await editorText(page);

  await dispatchCtrlW(page, '.cm-content');
  const afterIntercept = await editorText(page);
  expect(afterIntercept.length).toBeLessThan(beforeIntercept.length);

  await page.click('.cm-content');
  await page.keyboard.type(' gamma');
  const beforeVimGuard = await editorText(page);
  await page.keyboard.press('Control+Shift+V');
  await dispatchCtrlW(page, '.cm-content');
  const afterVimGuard = await editorText(page);
  expect(afterVimGuard).toBe(beforeVimGuard);

  await page.keyboard.press('Control+Shift+V');
  await page.keyboard.press('Control+/');
  const beforeModalGuard = await editorText(page);
  await dispatchCtrlW(page, '.cm-content');
  const afterModalGuard = await editorText(page);
  expect(afterModalGuard).toBe(beforeModalGuard);
  await page.keyboard.press('Escape');

  const beforeTitleGuard = await editorText(page);
  await page.fill('#doc-title', 'Title guard target');
  await dispatchCtrlW(page, '#doc-title');
  const afterTitleGuard = await editorText(page);
  expect(afterTitleGuard).toBe(beforeTitleGuard);
});
