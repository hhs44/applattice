import { describe, expect, it } from 'vitest';
import { bridgeVersion } from './App.js';

describe('Todo remote application', () => {
  it('exports the platform bridge version', () => {
    expect(bridgeVersion).toBe('1.0.0');
  });
});
