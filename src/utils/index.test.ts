import { describe, expect, it } from 'bun:test';
import { formatBytes, pluralize, truncate } from './index.js';

describe('utils', () => {
	it('truncates long strings with ellipsis', () => {
		expect(truncate('abcdefghij', 6)).toBe('abc...');
	});

	it('formats bytes in a human-readable format', () => {
		expect(formatBytes(1024)).toBe('1 KB');
	});

	it('pluralizes words correctly', () => {
		expect(pluralize(1, 'file')).toBe('1 file');
		expect(pluralize(2, 'file')).toBe('2 files');
	});
});
