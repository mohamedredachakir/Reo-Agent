import { describe, expect, it } from 'bun:test';
import { VERSION } from './version.js';

describe('VERSION', () => {
	it('exposes a non-empty semantic-looking string', () => {
		expect(typeof VERSION).toBe('string');
		expect(VERSION.length).toBeGreaterThan(0);
		expect(VERSION).toMatch(/^\d+\.\d+\.\d+/);
	});
});
