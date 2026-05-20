import { describe, it, expect } from 'vitest';
import { connect } from './client.js';

describe('connect()', () => {
  it('returns error state for an unreachable host', async () => {
    const result = await connect(
      'postgresql://user:pass@localhost:19999/nodb',
    );
    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.message).toBeTruthy();
    }
  }, 10000);
});
