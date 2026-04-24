import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Anthropic } from '@anthropic-ai/sdk';
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages/messages';
import { OpenAI } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
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
	provider: 'anthropic' | 'openai' | 'google' | 'ollama';
	apiKey?: string;
	openaiApiKey?: string;
	googleApiKey?: string;
	ollamaBaseUrl?: string;
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
	private anthropicClient?: Anthropic;
	private openaiClient?: OpenAI;
	private googleClient?: GoogleGenerativeAI;
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
		this.initializeClients();
	}

	private initializeClients() {
		const { provider, apiKey, openaiApiKey, googleApiKey, ollamaBaseUrl } = this.config;

		if (provider === 'anthropic') {
			this.anthropicClient = new Anthropic({
				apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
			});
		} else if (provider === 'openai') {
			this.openaiClient = new OpenAI({
				apiKey: openaiApiKey || process.env.OPENAI_API_KEY || apiKey,
			});
		} else if (provider === 'google') {
			this.googleClient = new GoogleGenerativeAI(
				googleApiKey || process.env.GOOGLE_API_KEY || apiKey || '',
			);
		} else if (provider === 'ollama') {
			this.openaiClient = new OpenAI({
				baseURL: `${ollamaBaseUrl}/v1`,
				apiKey: 'ollama', // Ollama doesn't need a real key but OpenAI client requires one
			});
		}
	}

	private loadConfig(overrides: Partial<ReoConfig>): ReoConfig {
		const defaultConfig: ReoConfig = {
			provider: 'anthropic',
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

		const config = { ...defaultConfig, ...fileConfig, ...overrides };

		// Set default model based on provider if not explicitly set in fileConfig or overrides
		if (!fileConfig.model && !overrides.model) {
			if (config.provider === 'openai') config.model = 'gpt-4o';
			else if (config.provider === 'google') config.model = 'gemini-1.5-flash';
			else if (config.provider === 'ollama') config.model = 'llama3';
		}

		return config;
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
			this.messageHistory.push({
				role: 'assistant',
				content: response,
			});

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

		this.messageHistory.push({
			role: 'assistant',
			content: response,
		});

		return this.extractTextContent(response);
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
		const provider = this.config.provider;

		if (provider === 'anthropic') {
			return this.executeAnthropicRound(systemPrompt, tools, options);
		} else if (provider === 'openai' || provider === 'ollama') {
			return this.executeOpenAIRound(systemPrompt, tools, options);
		} else if (provider === 'google') {
			return this.executeGoogleRound(systemPrompt, tools, options);
		}

		throw new Error(`Unsupported provider: ${provider}`);
	}

	private async executeAnthropicRound(
		systemPrompt: string,
		tools: Tool[],
		options: QueryOptions,
	): Promise<ReoContentBlock[]> {
		if (!this.anthropicClient) throw new Error('Anthropic client not initialized');

		const toolSchemas = tools.map((t) => t.getSchema());
		const messages = this.messageHistory.map((m) => ({
			role: m.role,
			content: m.content,
		}));

		const response = await this.anthropicClient.messages.create({
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

	private async executeOpenAIRound(
		systemPrompt: string,
		tools: Tool[],
		options: QueryOptions,
	): Promise<ReoContentBlock[]> {
		if (!this.openaiClient) throw new Error('OpenAI client not initialized');

		const toolSchemas = tools.map((t) => ({
			type: 'function',
			function: {
				name: t.name,
				description: t.description,
				parameters: t.getSchema().input_schema,
			},
		}));

		const messages: any[] = [{ role: 'system', content: systemPrompt }];

		for (const m of this.messageHistory) {
			if (m.role === 'assistant') {
				// Search for tool calls in the content
				const contentBlocks = Array.isArray(m.content) ? m.content : [{ type: 'text', text: m.content }];
				const text = contentBlocks
					.filter((b: any) => b.type === 'text')
					.map((b: any) => b.text)
					.join('\n');
				const tool_calls = contentBlocks
					.filter((b: any) => b.type === 'tool_use')
					.map((b: any) => ({
						id: b.id,
						type: 'function',
						function: {
							name: b.name,
							arguments: JSON.stringify(b.input),
						},
					}));

				messages.push({
					role: 'assistant',
					content: text || null,
					tool_calls: tool_calls.length > 0 ? tool_calls : undefined,
				});
			} else if (m.role === 'user') {
				if (Array.isArray(m.content)) {
					const toolResults = m.content.filter((c: any) => c.type === 'tool_result');
					if (toolResults.length > 0) {
						for (const result of toolResults) {
							messages.push({
								role: 'tool',
								tool_call_id: (result as any).tool_use_id,
								content: (result as any).content,
							});
						}
					} else {
						const text = m.content
							.filter((c: any) => c.type === 'text')
							.map((c: any) => c.text)
							.join('\n');
						messages.push({ role: 'user', content: text });
					}
				} else {
					messages.push({ role: 'user', content: m.content });
				}
			}
		}

		const response = await this.openaiClient.chat.completions.create({
			model: this.config.model,
			max_tokens: options.maxTokens || this.config.maxTokens,
			temperature: options.temperature ?? this.config.temperature,
			messages,
			tools: toolSchemas.length > 0 ? (toolSchemas as any) : undefined,
		});

		this.recordUsage({
			input_tokens: response.usage?.prompt_tokens,
			output_tokens: response.usage?.completion_tokens,
		});

		const message = response.choices[0].message;
		const content: ReoContentBlock[] = [];

		if (message.content) {
			content.push({ type: 'text', text: message.content });
		}

		if (message.tool_calls) {
			for (const call of message.tool_calls) {
				if (call.type === 'function') {
					content.push({
						type: 'tool_use',
						id: call.id,
						name: call.function.name,
						input: JSON.parse(call.function.arguments),
					});
				}
			}
		}

		return content;
	}

	private async executeGoogleRound(
		systemPrompt: string,
		tools: Tool[],
		options: QueryOptions,
	): Promise<ReoContentBlock[]> {
		if (!this.googleClient) throw new Error('Google client not initialized');

		const model = this.googleClient.getGenerativeModel({
			model: this.config.model,
			systemInstruction: systemPrompt,
		});

		const toolSchemas =
			tools.length > 0
				? [
						{
							functionDeclarations: tools.map((t) => ({
								name: t.name,
								description: t.description,
								parameters: t.getSchema().input_schema,
							})),
						},
					]
				: undefined;

		const history = [];
		for (let i = 0; i < this.messageHistory.length - 1; i++) {
			const m = this.messageHistory[i];
			const role = m.role === 'user' ? 'user' : 'model';
			const parts: any[] = [];

			if (Array.isArray(m.content)) {
				for (const block of m.content as any[]) {
					if (block.type === 'text') {
						parts.push({ text: block.text });
					} else if (block.type === 'tool_use') {
						parts.push({
							functionCall: {
								name: block.name,
								args: block.input,
							},
						});
					} else if (block.type === 'tool_result') {
						parts.push({
							functionResponse: {
								name: block.name || '',
								response: { content: block.content },
							},
						});
					}
				}
			} else {
				parts.push({ text: m.content });
			}
			history.push({ role, parts });
		}

		const chat = model.startChat({
			history,
			tools: toolSchemas as any,
		});

		const lastMessageContent = this.messageHistory[this.messageHistory.length - 1].content;
		let lastMessage: any;

		if (Array.isArray(lastMessageContent)) {
			lastMessage = lastMessageContent.map((block: any) => {
				if (block.type === 'text') {
					return { text: block.text };
				}
				if (block.type === 'tool_result') {
					return {
						functionResponse: {
							name: block.name || '',
							response: { content: block.content },
						},
					};
				}
				return { text: JSON.stringify(block) };
			});
		} else {
			lastMessage = lastMessageContent;
		}

		const result = await chat.sendMessage(lastMessage);
		const response = result.response;

		const content: ReoContentBlock[] = [];
		let text = '';
		try {
			text = response.text();
		} catch (e) {
			console.error('Error getting text from Google response:', e);
			text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
		}

		if (text) {
			content.push({ type: 'text', text });
		}

		const functionCalls = response.candidates?.[0]?.content?.parts?.filter((p) => p.functionCall);
		if (functionCalls) {
			for (const part of functionCalls) {
				if (part.functionCall) {
					content.push({
						type: 'tool_use',
						id: `call_${Date.now()}_${Math.random()}`,
						name: part.functionCall.name,
						input: part.functionCall.args as any,
					});
				}
			}
		}

		return content;
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
						name: toolName,
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
						name: toolName,
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
		const provider = this.config.provider;

		if (provider === 'anthropic') {
			yield* this.streamAnthropic(systemPrompt, tools, options);
		} else if (provider === 'openai' || provider === 'ollama') {
			yield* this.streamOpenAI(systemPrompt, tools, options);
		} else if (provider === 'google') {
			yield* this.streamGoogle(systemPrompt, tools, options);
		} else {
			// Fallback to non-streaming for others
			const response = await this.executeRound(systemPrompt, tools, options);
			const text = this.extractTextContent(response);
			this.messageHistory.push({
				role: 'assistant',
				content: response,
			});
			yield text;
		}
	}

	private async *streamGoogle(
		systemPrompt: string,
		tools: Tool[],
		options: QueryOptions,
	): AsyncGenerator<string> {
		if (!this.googleClient) throw new Error('Google client not initialized');

		const model = this.googleClient.getGenerativeModel({
			model: this.config.model,
			systemInstruction: systemPrompt,
		});

		const toolSchemas =
			tools.length > 0
				? [
						{
							functionDeclarations: tools.map((t) => ({
								name: t.name,
								description: t.description,
								parameters: t.getSchema().input_schema,
							})),
						},
					]
				: undefined;

		const history = [];
		for (let i = 0; i < this.messageHistory.length - 1; i++) {
			const m = this.messageHistory[i];
			const role = m.role === 'user' ? 'user' : 'model';
			const parts: any[] = [];

			if (Array.isArray(m.content)) {
				for (const block of m.content as any[]) {
					if (block.type === 'text') {
						parts.push({ text: block.text });
					} else if (block.type === 'tool_use') {
						parts.push({
							functionCall: {
								name: block.name,
								args: block.input,
							},
						});
					} else if (block.type === 'tool_result') {
						parts.push({
							functionResponse: {
								name: block.name || '',
								response: { content: block.content },
							},
						});
					}
				}
			} else {
				parts.push({ text: m.content });
			}
			history.push({ role, parts });
		}

		const chat = model.startChat({
			history,
			tools: toolSchemas as any,
		});

		const lastMessageContent = this.messageHistory[this.messageHistory.length - 1].content;
		let lastMessage: any;

		if (Array.isArray(lastMessageContent)) {
			lastMessage = lastMessageContent.map((block: any) => {
				if (block.type === 'text') {
					return { text: block.text };
				}
				if (block.type === 'tool_result') {
					return {
						functionResponse: {
							name: block.name || '',
							response: { content: block.content },
						},
					};
				}
				return { text: JSON.stringify(block) };
			});
		} else {
			lastMessage = lastMessageContent;
		}

		const result = await chat.sendMessageStream(lastMessage);

		let fullResponse = '';
		for await (const chunk of result.stream) {
			const text = chunk.text();
			if (text) {
				fullResponse += text;
				yield text;
			}
		}

		this.messageHistory.push({
			role: 'assistant',
			content: [{ type: 'text', text: fullResponse }],
		});

		this.usageStats.apiCalls += 1;
	}

	private async *streamAnthropic(
		systemPrompt: string,
		tools: Tool[],
		options: QueryOptions,
	): AsyncGenerator<string> {
		if (!this.anthropicClient) throw new Error('Anthropic client not initialized');

		const stream = await this.anthropicClient.messages.stream({
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
			const eventWithUsage = event as any;
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

	private async *streamOpenAI(
		systemPrompt: string,
		tools: Tool[],
		options: QueryOptions,
	): AsyncGenerator<string> {
		if (!this.openaiClient) throw new Error('OpenAI client not initialized');

		const messages: any[] = [
			{ role: 'system', content: systemPrompt },
			...this.messageHistory.map((m) => ({
				role: m.role,
				content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
			})),
		];

		const stream = await this.openaiClient.chat.completions.create({
			model: this.config.model,
			max_tokens: options.maxTokens || this.config.maxTokens,
			temperature: options.temperature ?? this.config.temperature,
			messages,
			stream: true,
		});

		let fullResponse = '';
		for await (const chunk of stream) {
			const content = chunk.choices[0]?.delta?.content || '';
			if (content) {
				fullResponse += content;
				yield content;
			}
		}

		this.messageHistory.push({
			role: 'assistant',
			content: fullResponse,
		});

		this.usageStats.apiCalls += 1;
	}
}

export function createQueryEngine(config?: Partial<ReoConfig>): QueryEngine {
	return new QueryEngine(config);
}
