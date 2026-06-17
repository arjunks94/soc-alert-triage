import { describe, it, expect } from 'vitest';
import { severityColors, statusColors } from '../theme';

describe('theme', () => {
  it('defines severity colors', () => {
    expect(severityColors.CRITICAL).toBe('#ef4444');
    expect(severityColors.HIGH).toBe('#f97316');
  });

  it('defines status colors', () => {
    expect(statusColors.NEW).toBeDefined();
    expect(statusColors.CLOSED).toBeDefined();
  });
});
