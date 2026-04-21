import { describe, expect, it } from 'bun:test';
import { ToolRegistry } from './index.js';

describe('ToolRegistry', () => {
	it('registers expected default tools without duplicates', () => {
		const registry = new ToolRegistry();
		const tools = registry.getAll();
		const names = tools.map((tool) => tool.name);

		expect(names).toEqual(['read', 'write', 'edit', 'bash', 'glob', 'grep', 'web_fetch']);
		expect(new Set(names).size).toBe(names.length);
	});

	it('can lookup tools by name with or without helper methods', () => {
		const registry = new ToolRegistry();

		expect(registry.isRegistered('read')).toBe(true);
		expect(registry.get('bash')?.name).toBe('bash');
		expect(registry.getByNames(['read', 'grep']).map((t) => t.name)).toEqual(['read', 'grep']);
	});
});
