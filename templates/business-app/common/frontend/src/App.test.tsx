import { describe, expect, it } from 'vitest';
import { bridgeVersion } from './App.js';

describe('remote contract', () => {
  it('declares bridge protocol', () => expect(bridgeVersion).toMatch(/^1\./));
});
