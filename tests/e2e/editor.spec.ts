import { expect, test } from '@playwright/test';

test('editor initializes and accepts typing', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('#editor')).toBeVisible();
  await expect(page.locator('#doc-title')).toBeVisible();

  await page.click('#editor');
  await page.keyboard.type('Hello from Playwright');

  await expect(page.locator('#preview')).toContainText('Hello from Playwright');
});

test('scrolloff keeps cursor context without page growth', async ({ page }) => {
  await page.goto('/?cm6=true');
  await page.click('.cm-content');

  await page.evaluate(async () => {
    const lines = Array.from({ length: 280 }, (_, index) => `line ${String(index + 1)}`).join('\n');
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

  const baseline = await page.evaluate(() => ({
    body: document.body.scrollHeight,
    document: document.documentElement.scrollHeight,
  }));

  const readCursorViewportState = async () => {
    return page.evaluate(async () => {
      const app = window as unknown as {
        typim?: {
          whenReady?: () => Promise<{
            editor: {
              getView?: () => {
                state: { selection: { main: { head: number } } };
                coordsAtPos: (pos: number) => DOMRect | null;
                scrollDOM: HTMLElement;
              } | null;
            };
          }>;
        };
      };

      const diagnostics = await app.typim?.whenReady?.();
      const view = diagnostics?.editor.getView?.();
      if (!view) {
        return null;
      }

      const caret = view.coordsAtPos(view.state.selection.main.head);
      const scrollerRect = view.scrollDOM.getBoundingClientRect();
      const scrollTop = view.scrollDOM.scrollTop;
      const maxScrollTop = Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight);

      return {
        cursorVisible: caret
          ? caret.top >= scrollerRect.top - 1 && caret.bottom <= scrollerRect.bottom + 1
          : false,
        scrollTop,
        maxScrollTop,
      };
    });
  };

  await page.click('.cm-content');
  await page.keyboard.press('End');
  for (let i = 0; i < 12; i += 1) {
    await page.mouse.wheel(0, 250);
    await page.keyboard.press('ArrowDown');
  }

  const midState = await readCursorViewportState();
  expect(midState).not.toBeNull();
  expect(midState?.cursorVisible).toBe(true);
  expect(midState?.scrollTop ?? 0).toBeGreaterThanOrEqual(0);
  expect(midState?.scrollTop ?? 0).toBeLessThanOrEqual(midState?.maxScrollTop ?? 0);

  await page.keyboard.press('Home');
  for (let i = 0; i < 8; i += 1) {
    await page.mouse.wheel(0, -300);
    await page.keyboard.press('ArrowUp');
  }

  const topBoundaryState = await readCursorViewportState();
  expect(topBoundaryState).not.toBeNull();
  expect(topBoundaryState?.cursorVisible).toBe(true);
  expect(topBoundaryState?.scrollTop).toBe(0);

  await page.keyboard.press('End');
  for (let i = 0; i < 8; i += 1) {
    await page.mouse.wheel(0, 300);
    await page.keyboard.press('ArrowDown');
  }

  const bottomBoundaryState = await readCursorViewportState();
  expect(bottomBoundaryState).not.toBeNull();
  expect(bottomBoundaryState?.cursorVisible).toBe(true);
  expect(bottomBoundaryState?.scrollTop ?? 0).toBeLessThanOrEqual(
    bottomBoundaryState?.maxScrollTop ?? 0
  );

  const after = await page.evaluate(() => ({
    body: document.body.scrollHeight,
    document: document.documentElement.scrollHeight,
  }));

  expect(after.body).toBe(baseline.body);
  expect(after.document).toBe(baseline.document);
});

test('diagnostics editor guard throws before ready and resolves after whenReady', async ({
  page,
}) => {
  await page.addInitScript(() => {
    type TypimDiagnosticsProbe = {
      assigned: boolean;
      preReadyAccess: 'throw' | 'no-throw' | 'unobserved';
      preReadyMessage: string | null;
    };

    const probe: TypimDiagnosticsProbe = {
      assigned: false,
      preReadyAccess: 'unobserved',
      preReadyMessage: null,
    };

    let typimValue: unknown;

    Object.defineProperty(window, '__typimDiagnosticsProbe', {
      value: probe,
      configurable: true,
      enumerable: false,
      writable: false,
    });

    Object.defineProperty(window, 'typim', {
      configurable: true,
      enumerable: true,
      get() {
        return typimValue;
      },
      set(value) {
        typimValue = value;

        if (probe.assigned) {
          return;
        }

        probe.assigned = true;

        try {
          void (value as { editor: unknown }).editor;
          probe.preReadyAccess = 'no-throw';
        } catch (error) {
          probe.preReadyAccess = 'throw';
          probe.preReadyMessage = error instanceof Error ? error.message : String(error);
        }
      },
    });
  });

  await page.goto('/?cm6=true');

  const result = await page.evaluate(async () => {
    const app = window as unknown as {
      typim?: {
        ready: boolean;
        initStatus: 'initializing' | 'ready';
        whenReady?: () => Promise<{
          ready: boolean;
          initStatus: 'initializing' | 'ready';
          editor: {
            setValue(value: string): void;
            getValue(): string;
          };
        }>;
      };
      __typimDiagnosticsProbe?: {
        assigned: boolean;
        preReadyAccess: 'throw' | 'no-throw' | 'unobserved';
        preReadyMessage: string | null;
      };
    };

    if (!app.typim?.whenReady) {
      return {
        hasDiagnostics: false,
      };
    }

    const diagnostics = await app.typim.whenReady();
    diagnostics.editor.setValue('ready-contract');

    return {
      hasDiagnostics: true,
      preReadyAssigned: app.__typimDiagnosticsProbe?.assigned ?? false,
      preReadyAccess: app.__typimDiagnosticsProbe?.preReadyAccess ?? 'unobserved',
      preReadyMessage: app.__typimDiagnosticsProbe?.preReadyMessage ?? null,
      ready: diagnostics.ready,
      initStatus: diagnostics.initStatus,
      content: diagnostics.editor.getValue(),
    };
  });

  expect(result).toEqual({
    hasDiagnostics: true,
    preReadyAssigned: true,
    preReadyAccess: 'throw',
    preReadyMessage: 'Typim diagnostics are not ready. Await window.typim.whenReady() first.',
    ready: true,
    initStatus: 'ready',
    content: 'ready-contract',
  });
});
