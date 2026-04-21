import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Anthropic } from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages';
import * as yaml from 'yaml';
import type { Tool } from './Tool.js';

type ReoMessage = {
	role: 'user' | 'assistant';
	content: string | unknown[];
};

type ReoContentBlock =
	| { type: 'text'; text: string }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
	| { type: string; [key: string]: unknown };

type ReoUsage = {
	input_tokens?: number;
	output_tokens?: number;
};

export interface ReoConfig {
	apiKey?: string;
	model: string;
	maxTokens: number;
	temperature: number;
	tools: ToolConfig[];
}

export interface ToolConfig {
	name: string;
	enabled: boolean;
}

export interface QueryOptions {
	systemPrompt?: string;
	maxTokens?: number;
	temperature?: number;
	tools?: Tool[];
	stream?: boolean;
}

export interface ToolCallResult {
	tool: string;
	input: Record<string, unknown>;
	output: string | Error;
	success: boolean;
}

export interface UsageStats {
	inputTokens: number;
	outputTokens: number;
	apiCalls: number;
}

export class QueryEngine extends EventEmitter {
	private client: Anthropic;
	private config: ReoConfig;
	private messageHistory: ReoMessage[] = [];
	private toolCallHistory: ToolCallResult[] = [];
	private usageStats: UsageStats = {
		inputTokens: 0,
		outputTokens: 0,
		apiCalls: 0,
	};
	private maxIterations = 100;
	private currentIteration = 0;

	constructor(config: Partial<ReoConfig> = {}) {
		super();
		this.config = this.loadConfig(config);
		this.client = new Anthropic({
			apiKey: this.config.apiKey || process.env.ANTHROPIC_API_KEY,
		});
	}

	private loadConfig(overrides: Partial<ReoConfig>): ReoConfig {
		const defaultConfig: ReoConfig = {
			model: 'claude-sonnet-4-20250514',
			maxTokens: 8192,
			temperature: 0.7,
			tools: [],
		};

		const configPath = path.join(process.env.HOME || '', '.config', 'reo-agent', 'config.yaml');
		let fileConfig: Partial<ReoConfig> = {};

		if (fs.existsSync(configPath)) {
			try {
				const fileContent = fs.readFileSync(configPath, 'utf-8');
				fileConfig = yaml.parse(fileContent) || {};
			} catch (e) {
				console.error('Failed to load config:', e);
			}
		}

		return { ...defaultConfig, ...fileConfig, ...overrides };
	}

	async query(userMessage: string, options: QueryOptions = {}): Promise<string> {
		this.messageHistory.push({
			role: 'user',
			content: userMessage,
		});

		const systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
		const tools = options.tools || [];

		this.currentIteration = 0;
		let response = await this.executeRound(systemPrompt, tools, options);

		while (this.shouldContinue(response, tools)) {
			this.currentIteration++;
			if (this.currentIteration >= this.maxIterations) {
				throw new Error('Max tool call iterations reached');
			}

			const toolResults = await this.executeToolCalls(response, tools);
			this.messageHistory.push({
				role: 'user',
				content: toolResults,
			});

			response = await this.executeRound(systemPrompt, tools, options);
		}

		const finalContent = this.extractTextContent(response);
		this.messageHistory.push({
			role: 'assistant',
			content: finalContent,
		});

		return finalContent;
	}

	private getDefaultSystemPrompt(): string {
		return `You are Reo, an AI coding assistant that helps developers with programming tasks.

You have access to tools for reading files, writing files, executing bash commands, and searching code.
Use these tools efficiently to complete tasks.

When using tools:
- Be specific about file paths and what you want to accomplish
- Explain what you're doing before running potentially destructive commands
- Always verify your changes work correctly

You are helpful, concise, and focused on writing correct, maintainable code.`;
	}

	private async executeRound(
		systemPrompt: string,
		tools: Tool[],
		options: QueryOptions,
	): Promise<ReoContentBlock[]> {
		const toolSchemas = tools.map((t) => t.getSchema());
		const messages = this.messageHistory.map((m) => ({
			role: m.role,
			content: m.content,
		}));

		const response = await this.client.messages.create({
			model: this.config.model,
			max_tokens: options.maxTokens || this.config.maxTokens,
			temperature: options.temperature ?? this.config.temperature,
			system: systemPrompt,
			tools: toolSchemas,
			messages: messages as unknown as MessageParam[],
		});

		const responseWithUsage = response as typeof response & { usage?: ReoUsage };
		this.recordUsage(responseWithUsage.usage);

		return response.content as ReoContentBlock[];
	}

	private recordUsage(usage?: ReoUsage): void {
		if (!usage) {
			return;
		}

		const inputTokens = Number(usage.input_tokens || 0);
		const outputTokens = Number(usage.output_tokens || 0);

		this.usageStats.inputTokens += Number.isFinite(inputTokens) ? inputTokens : 0;
		this.usageStats.outputTokens += Number.isFinite(outputTokens) ? outputTokens : 0;
		this.usageStats.apiCalls += 1;
	}

	private shouldContinue(response: ReoContentBlock[], tools: Tool[]): boolean {
		return response.some((block) => block.type === 'tool_use');
	}

	private async executeToolCalls(
		response: ReoContentBlock[],
		tools: Tool[],
	): Promise<ReoContentBlock[]> {
		const results: ReoContentBlock[] = [];

		for (const block of response) {
			if (block.type === 'tool_use') {
				const toolUse = block;
				const toolName = String(toolUse.name);
				const tool = tools.find((t) => t.name === toolName);

				if (!tool) {
					results.push({
						type: 'tool_result',
						tool_use_id: toolUse.id,
						content: `Error: Unknown tool "${toolUse.name}"`,
					});
					continue;
				}

				try {
					this.emit('toolCallStart', { tool: toolName, input: toolUse.input });
					const output = await tool.execute(toolUse.input as Record<string, unknown>);
					this.emit('toolCallEnd', { tool: toolName, output });

					this.toolCallHistory.push({
						tool: toolName,
						input: toolUse.input as Record<string, unknown>,
						output,
						success: true,
					});

					results.push({
						type: 'tool_result',
						tool_use_id: toolUse.id,
						content: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
					});
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : String(error);
					this.emit('toolCallError', { tool: toolName, error: errorMessage });

					this.toolCallHistory.push({
						tool: toolName,
						input: toolUse.input as Record<string, unknown>,
						output: new Error(errorMessage),
						success: false,
					});

					results.push({
						type: 'tool_result',
						tool_use_id: toolUse.id,
						content: `Error: ${errorMessage}`,
					});
				}
			} else if (block.type === 'text') {
				this.emit('text', block.text);
			}
		}

		return results;
	}

	private extractTextContent(response: ReoContentBlock[]): string {
		return response
			.filter((block) => block.type === 'text')
			.map((block) => (block as { type: 'text'; text: string }).text)
			.join('\n');
	}

	getHistory(): { messages: ReoMessage[]; toolCalls: ToolCallResult[] } {
		return {
			messages: this.messageHistory,
			toolCalls: this.toolCallHistory,
		};
	}

	getUsageStats(): UsageStats {
		return { ...this.usageStats };
	}

	clearHistory(): void {
		this.messageHistory = [];
		this.toolCallHistory = [];
		this.usageStats = {
			inputTokens: 0,
			outputTokens: 0,
			apiCalls: 0,
		};
	}

	async *streamQuery(userMessage: string, options: QueryOptions = {}): AsyncGenerator<string> {
		this.messageHistory.push({
			role: 'user',
			content: userMessage,
		});

		const systemPrompt = options.systemPrompt || this.getDefaultSystemPrompt();
		const tools = options.tools || [];

		this.currentIteration = 0;

		const stream = await this.client.messages.stream({
			model: this.config.model,
			max_tokens: options.maxTokens || this.config.maxTokens,
			temperature: options.temperature ?? this.config.temperature,
			system: systemPrompt,
			tools: tools.map((t) => t.getSchema()),
			messages: this.messageHistory.map((m) => ({
				role: m.role,
				content: m.content,
			})) as unknown as MessageParam[],
		});

		let fullResponse = '';
		let latestInputTokens = 0;
		let latestOutputTokens = 0;

		for await (const event of stream) {
			const eventWithUsage = event as typeof event & { usage?: ReoUsage };
			if (eventWithUsage.usage?.input_tokens) {
				latestInputTokens = Number(eventWithUsage.usage.input_tokens) || latestInputTokens;
			}
			if (eventWithUsage.usage?.output_tokens) {
				latestOutputTokens = Number(eventWithUsage.usage.output_tokens) || latestOutputTokens;
			}

			if (event.type === 'content_block_delta') {
				if (event.delta.type === 'text_delta') {
					fullResponse += event.delta.text;
					yield event.delta.text;
				} else if (event.delta.type === 'input_json_delta') {
					yield event.delta.partial_json;
				}
			}
		}

		this.messageHistory.push({
			role: 'assistant',
			content: fullResponse,
		});

		if (latestInputTokens > 0 || latestOutputTokens > 0) {
			this.usageStats.inputTokens += latestInputTokens;
			this.usageStats.outputTokens += latestOutputTokens;
			this.usageStats.apiCalls += 1;
		}
	}
}

export function createQueryEngine(config?: Partial<ReoConfig>): QueryEngine {
	return new QueryEngine(config);
}
