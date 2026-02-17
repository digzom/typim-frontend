import { describe, expect, it } from 'vitest';
import { CM6EditorEngine } from '../../../../src/editor/cm6';

describe('CM6EditorEngine', () => {
  it('initializes and reads/writes content', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const engine = new CM6EditorEngine();
    engine.initialize(container, '# Hello');

    expect(engine.getValue()).toContain('# Hello');

    engine.setValue('## Updated');
    expect(engine.getValue()).toContain('## Updated');

    engine.destroy();
    container.remove();
  });

  it('updates cursor position', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const engine = new CM6EditorEngine();
    engine.initialize(container, 'line one\nline two');

    engine.setCursor({ line: 1, ch: 4 });
    const cursor = engine.getCursor();

    expect(cursor.line).toBe(1);
    expect(cursor.ch).toBe(4);

    engine.destroy();
    container.remove();
  });
});
