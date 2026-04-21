import { describe, expect, it } from 'bun:test';
import { createQueryEngine } from './QueryEngine.js';

describe('QueryEngine', () => {
	it('starts with empty history and zero usage', () => {
		const engine = createQueryEngine({ apiKey: 'test-key' });
		const history = engine.getHistory();
		const usage = engine.getUsageStats();

		expect(history.messages).toEqual([]);
		expect(history.toolCalls).toEqual([]);
		expect(usage).toEqual({ inputTokens: 0, outputTokens: 0, apiCalls: 0 });
	});

	it('resets history and usage counters with clearHistory', () => {
		const engine = createQueryEngine({ apiKey: 'test-key' });
		engine.clearHistory();

		expect(engine.getHistory()).toEqual({ messages: [], toolCalls: [] });
		expect(engine.getUsageStats()).toEqual({ inputTokens: 0, outputTokens: 0, apiCalls: 0 });
	});
});
