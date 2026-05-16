import { describe, it, expect } from 'vitest';
import { COPILOT_MODELS } from '../src/types.js';

describe('COPILOT_MODELS', () => {
  it('has 5 models', () => {
    expect(COPILOT_MODELS).toHaveLength(5);
  });

  it('has correct model IDs', () => {
    const ids = COPILOT_MODELS.map((m) => m.id);
    expect(ids).toContain('gpt-4-copilot');
    expect(ids).toContain('gpt-4o-copilot');
    expect(ids).toContain('claude-3.5-sonnet-copilot');
    expect(ids).toContain('o1-copilot');
    expect(ids).toContain('o1-mini-copilot');
  });

  it('all models have streaming capability', () => {
    for (const model of COPILOT_MODELS) {
      expect(model.capabilities.streaming).toBe(true);
    }
  });
});
