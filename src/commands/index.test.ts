import { describe, expect, it } from 'bun:test';
import { CommandRegistry } from './index.js';

describe('CommandRegistry', () => {
	it('parses config command with key and value', () => {
		const registry = new CommandRegistry();
		const parsed = registry.parseInput('/config temperature 0.4');

		expect(parsed).not.toBeNull();
		expect(parsed?.command.name).toBe('config');
		expect(parsed?.args).toEqual({ key: 'temperature', value: '0.4' });
	});

	it('parses config command with key only', () => {
		const registry = new CommandRegistry();
		const parsed = registry.parseInput('/config model');

		expect(parsed).not.toBeNull();
		expect(parsed?.args).toEqual({ key: 'model', value: undefined });
	});

	it('returns null for unknown command', () => {
		const registry = new CommandRegistry();
		expect(registry.parseInput('/unknown something')).toBeNull();
	});
});
