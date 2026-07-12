import { describe, it, expect } from 'vitest';
import { GET } from './route';

describe('Integration: health endpoint', () => {
  it('should return ok status', async () => {
    const response = await GET();
    const data = await response.json();
    expect(data.status).toBe('ok');
  });
});
