import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

test('INV-001: save output remains valid markdown from editor content', async ({ page }) => {
  await page.goto('/?cm6=true&livemd=false&fence=true&scroll=true');

  const sourceMarkdown = [
    '# inv-001-check',
    '- list item with **strong** and _emphasis_',
    '> quote with `code` and ~~strike~~',
    '[label](https://example.test/path)',
    '```ts',
    'const n = 1;',
    '```',
  ].join('\n');

  await page.evaluate(async content => {
    const app = window as unknown as {
      typim?: {
        whenReady?: () => Promise<{
          editor: {
            setValue: (value: string) => void;
          };
        }>;
      };
    };

    const diagnostics = await app.typim?.whenReady?.();
    diagnostics?.editor.setValue(content);
  }, sourceMarkdown);

  const editorSource = await page.evaluate(async () => {
    const app = window as unknown as {
      typim?: {
        whenReady?: () => Promise<{
          editor: {
            getValue: () => string;
          };
        }>;
      };
    };

    const diagnostics = await app.typim?.whenReady?.();
    return diagnostics?.editor.getValue() ?? '';
  });

  expect(editorSource).toBe(sourceMarkdown);

  await page.click('#menu-btn');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#menu-save')]);

  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();

  const fileBytes = await readFile(downloadPath as string);
  const sourceBytes = Buffer.from(new TextEncoder().encode(editorSource));

  expect(fileBytes.equals(sourceBytes)).toBe(true);
});

test('INV-003: primary keyboard shortcuts trigger actions', async ({ page }) => {
  await page.goto('/?cm6=true&livemd=true');
  await page.click('.cm-content');

  const beforeLayout = await page.locator('body').getAttribute('data-layout');
  await page.keyboard.press('Control+\\');
  const afterLayout = await page.locator('body').getAttribute('data-layout');
  expect(afterLayout).not.toBe(beforeLayout);

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

  await page.keyboard.press('Escape');
  await page.click('.cm-content');
  await page.keyboard.press('Control+A');
  await page.keyboard.type('one two');

  const beforeCtrlW = await page.evaluate(() => {
    return document.querySelector('.cm-content')?.textContent ?? '';
  });

  await page.evaluate(() => {
    const target = document.querySelector('.cm-content');
    if (!target) {
      return;
    }

    target.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'w',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
  });

  const afterCtrlW = await page.evaluate(() => {
    return document.querySelector('.cm-content')?.textContent ?? '';
  });
  expect(afterCtrlW.length).toBeLessThan(beforeCtrlW.length);
});

test('INV-004: mobile viewport has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?cm6=true');

  await expect(page.locator('body')).toHaveAttribute('data-layout', 'mobile');
  await expect(page.locator('body')).toHaveAttribute('data-mobile-pane', 'editor');

  const hasHorizontalOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });

  expect(hasHorizontalOverflow).toBe(false);
});

test('INV-005: share modal keeps focus inside dialog on tab', async ({ page }) => {
  await page.goto('/?cm6=true');
  await page.click('#menu-btn');
  await page.click('#menu-share');

  await page.keyboard.press('Tab');
  const activeInsideModal = await page.evaluate(() => {
    const modal = document.getElementById('share-modal');
    return Boolean(modal && document.activeElement && modal.contains(document.activeElement));
  });

  expect(activeInsideModal).toBe(true);
});

test('INV-006: live share update includes edit token header', async ({ page }) => {
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window);
    const appWindow = window as unknown as {
      __inv006Token?: string | null;
    };

    appWindow.__inv006Token = null;

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const isRequestObject = typeof input !== 'string' && !(input instanceof URL);
      const method = (init?.method || (isRequestObject ? input.method : 'GET')).toUpperCase();
      const url = isRequestObject ? input.url : input.toString();
      const pathname = new URL(url, window.location.origin).pathname;

      if (method === 'POST' && /\/api\/share\/?$/.test(pathname)) {
        return new Response(
          JSON.stringify({
            id: 'share-1',
            url: 'https://example.test/s/live-1',
            shareType: 'live',
            privacy: 'secret',
            editToken: 'edit-token',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      if (method === 'PUT' && /\/api\/share\/share-1\/?$/.test(pathname)) {
        const headers = new Headers(init?.headers || (isRequestObject ? input.headers : undefined));
        appWindow.__inv006Token = headers.get('X-Share-Edit-Token');

        return new Response(
          JSON.stringify({
            id: 'share-1',
            url: 'https://example.test/s/live-1-updated',
            shareType: 'live',
            privacy: 'secret',
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return originalFetch(input, init);
    };
  });

  await page.goto('/?cm6=true');
  await page.click('#menu-btn');
  await page.click('#menu-share');
  await page.selectOption('#share-type', 'live');
  await page.click('#share-create');
  await expect(page.locator('#share-url')).toHaveValue('https://example.test/s/live-1');
  await expect(page.locator('#share-update')).toBeEnabled();
  await page.click('#share-update');

  const updateHeaderToken = await page.evaluate(() => {
    const appWindow = window as unknown as {
      __inv006Token?: string | null;
    };

    return appWindow.__inv006Token ?? null;
  });

  expect(updateHeaderToken).toBe('edit-token');
});

test('INV-007: large document render remains responsive', async ({ page }) => {
  await page.goto('/?cm6=true&livemd=true');

  const inlineLine = 'line **bold** _em_ `code` [l](u) ~~x~~';
  const largeContent = `# Perf\n\n${`${inlineLine}\n`.repeat(3000)}END`;
  const start = Date.now();

  await page.evaluate(async content => {
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
    diagnostics?.editor.setValue(content);
  }, largeContent);

  await expect(page.locator('#preview')).toContainText('END');
  expect(Date.now() - start).toBeLessThan(2000);
});

test('INV-002: storage does not include share token keys after startup', async ({ page }) => {
  await page.goto('/?cm6=true');

  const hasTokenKey = await page.evaluate(() => {
    return Object.keys(localStorage).some(key => /token/i.test(key));
  });

  expect(hasTokenKey).toBe(false);
});
