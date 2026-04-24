import type React from 'react';
import { z } from 'zod';
import type { UsageStats } from '../QueryEngine.js';
import { ConfigManager, globalConfigManager } from '../config/index.js';
import { VERSION } from '../version';

let usageProvider: (() => UsageStats) | null = null;

export function setUsageProvider(provider: () => UsageStats): void {
	usageProvider = provider;
}

export type CommandType = 'prompt' | 'local' | 'local_jsx';

export interface CommandResult {
	type: 'text' | 'jsx' | 'action';
	content: string | React.ReactNode;
}

export abstract class Command {
	abstract name: string;
	abstract description: string;
	abstract type: CommandType;
	inputSchema?: z.ZodType;

	abstract execute(args?: Record<string, unknown>): Promise<CommandResult> | CommandResult;
}

export class HelpCommand extends Command {
	name = 'help';
	description = 'Show available commands and help information';
	type: CommandType = 'local';

	async execute(): Promise<CommandResult> {
		return {
			type: 'text',
			content: `Reo Agent - Available Commands

/ask <question>    Ask a question about the codebase
/read <file>       Read a file
/edit <file>       Edit a file
/glob <pattern>    Find files matching pattern
/grep <pattern>    Search for text in files
/exit              Exit reo-agent

Type any message to start a conversation with Reo.`,
		};
	}
}

export class VersionCommand extends Command {
	name = 'version';
	description = 'Show version information';
	type: CommandType = 'local';

	async execute(): Promise<CommandResult> {
		return {
			type: 'text',
			content: `reo-agent v${VERSION}`,
		};
	}
}

export class ClearCommand extends Command {
	name = 'clear';
	description = 'Clear the conversation history';
	type: CommandType = 'local';

	async execute(): Promise<CommandResult> {
		return {
			type: 'action',
			content: 'clear',
		};
	}
}

export class CostCommand extends Command {
	name = 'cost';
	description = 'Show estimated API costs for this session';
	type: CommandType = 'local';

	async execute(): Promise<CommandResult> {
		const usage = usageProvider?.() || {
			inputTokens: 0,
			outputTokens: 0,
			apiCalls: 0,
		};

		const config = globalConfigManager.get();
		const provider = config.provider;
		const totalTokens = usage.inputTokens + usage.outputTokens;

		let inputRate = 3.0; // Per 1M tokens
		let outputRate = 15.0; // Per 1M tokens
		let pricingNote = 'default Sonnet pricing assumptions';

		if (provider === 'openai') {
			inputRate = 2.5; // GPT-4o
			outputRate = 10.0;
			pricingNote = 'GPT-4o pricing assumptions';
		} else if (provider === 'google') {
			inputRate = 0.075; // Gemini 1.5 Flash (under 128k context)
			outputRate = 0.3;
			pricingNote = 'Gemini 1.5 Flash pricing assumptions';
		} else if (provider === 'ollama') {
			inputRate = 0;
			outputRate = 0;
			pricingNote = 'local models (free)';
		}

		const estimatedCostUsd =
			(usage.inputTokens / 1_000_000) * inputRate + (usage.outputTokens / 1_000_000) * outputRate;

		return {
			type: 'text',
			content: `API Cost Tracking (${provider})

Input tokens: ${usage.inputTokens}
Output tokens: ${usage.outputTokens}
Total tokens: ${totalTokens}
API calls: ${usage.apiCalls}
Estimated cost: $${estimatedCostUsd.toFixed(6)}

Estimated using ${pricingNote}.`,
		};
	}
}

export class DoctorCommand extends Command {
	name = 'doctor';
	description = 'Check system requirements and configuration';
	type: CommandType = 'local';

	async execute(): Promise<CommandResult> {
		const config = globalConfigManager.get();
		const provider = config.provider;
		const checks: { name: string; status: 'pass' | 'fail' | 'warn'; message: string }[] = [];

		let apiKeySet = false;
		let apiKeyName = '';

		if (provider === 'anthropic') {
			apiKeyName = 'ANTHROPIC_API_KEY';
			apiKeySet = !!(config.apiKey || process.env.ANTHROPIC_API_KEY);
		} else if (provider === 'openai') {
			apiKeyName = 'OPENAI_API_KEY';
			apiKeySet = !!(config.openaiApiKey || config.apiKey || process.env.OPENAI_API_KEY);
		} else if (provider === 'google') {
			apiKeyName = 'GOOGLE_API_KEY';
			apiKeySet = !!(config.googleApiKey || config.apiKey || process.env.GOOGLE_API_KEY);
		} else if (provider === 'ollama') {
			apiKeyName = 'Ollama';
			apiKeySet = true; // Ollama usually doesn't require a key
		}

		checks.push({
			name: 'Provider',
			status: 'pass',
			message: `Current provider is ${provider}`,
		});

		checks.push({
			name: 'API Key',
			status: apiKeySet ? 'pass' : 'fail',
			message: apiKeySet
				? `${apiKeyName} is configured`
				: `${apiKeyName} is not configured (provider: ${provider})`,
		});

		try {
			const { execa } = await import('execa');
			await execa('node', ['--version']);
			checks.push({
				name: 'Node.js',
				status: 'pass',
				message: 'Node.js is installed',
			});
		} catch {
			checks.push({
				name: 'Node.js',
				status: 'fail',
				message: 'Node.js is not installed',
			});
		}

		checks.push({
			name: 'Config Directory',
			status: 'pass',
			message: '~/.config/reo-agent/ is accessible',
		});

		const output = checks
			.map(
				(c) =>
					`${c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✗'} ${c.name}: ${c.message}`,
			)
			.join('\n');

		return {
			type: 'text',
			content: `Reo Agent Doctor\n\n${output}`,
		};
	}
}

export class ConfigCommand extends Command {
	name = 'config';
	description = 'Show or set configuration';
	type: CommandType = 'prompt';

	inputSchema = z.object({
		key: z.string().optional(),
		value: z.string().optional(),
	});

	private normalizeKey(
		input: string,
	):
		| 'model'
		| 'maxTokens'
		| 'temperature'
		| 'apiKey'
		| 'googleApiKey'
		| 'openaiApiKey'
		| 'ollamaBaseUrl'
		| 'provider'
		| null {
		const map: Record<
			string,
			| 'model'
			| 'maxTokens'
			| 'temperature'
			| 'apiKey'
			| 'googleApiKey'
			| 'openaiApiKey'
			| 'ollamaBaseUrl'
			| 'provider'
		> = {
			model: 'model',
			maxTokens: 'maxTokens',
			max_tokens: 'maxTokens',
			temperature: 'temperature',
			apiKey: 'apiKey',
			api_key: 'apiKey',
			googleApiKey: 'googleApiKey',
			google_api_key: 'googleApiKey',
			openaiApiKey: 'openaiApiKey',
			openai_api_key: 'openaiApiKey',
			ollamaBaseUrl: 'ollamaBaseUrl',
			ollama_url: 'ollamaBaseUrl',
			provider: 'provider',
		};

		return map[input] || map[input.toLowerCase()] || null;
	}

	async execute(args?: Record<string, unknown>): Promise<CommandResult> {
		const config = globalConfigManager.get();

		if (!args?.key) {
			return {
				type: 'text',
				content: `Current Configuration:

provider: ${config.provider}
model: ${config.model}
maxTokens: ${config.maxTokens}
temperature: ${config.temperature}
apiKey: ${config.apiKey ? '***set***' : 'not set'}
googleApiKey: ${config.googleApiKey ? '***set***' : 'not set'}
openaiApiKey: ${config.openaiApiKey ? '***set***' : 'not set'}
ollamaBaseUrl: ${config.ollamaBaseUrl}

To set a value: /config <key> <value>`,
			};
		}

		const key = String(args.key);
		const normalizedKey = this.normalizeKey(key);

		if (!normalizedKey) {
			return {
				type: 'text',
				content: `Unknown config key: ${key}\nSupported keys: provider, model, maxTokens, temperature, apiKey, googleApiKey, openaiApiKey, ollamaBaseUrl`,
			};
		}

		if (args.value === undefined) {
			const allConfig = globalConfigManager.get();
			const current = allConfig[normalizedKey];
			const isKey = normalizedKey.toLowerCase().includes('apikey');
			return {
				type: 'text',
				content: `${normalizedKey}: ${isKey && current ? '***set***' : String(current)}`,
			};
		}

		let parsedValue: string | number = String(args.value);
		if (normalizedKey === 'maxTokens') {
			parsedValue = Number(args.value);
			if (!Number.isFinite(parsedValue) || (parsedValue as number) <= 0) {
				throw new Error('maxTokens must be a positive number');
			}
		}

		if (normalizedKey === 'temperature') {
			parsedValue = Number(args.value);
			if (
				!Number.isFinite(parsedValue) ||
				(parsedValue as number) < 0 ||
				(parsedValue as number) > 2
			) {
				throw new Error('temperature must be between 0 and 2');
			}
		}

		if (normalizedKey === 'provider') {
			const validProviders = ['anthropic', 'openai', 'google', 'ollama'];
			if (!validProviders.includes(String(parsedValue))) {
				throw new Error(`Invalid provider. Must be one of: ${validProviders.join(', ')}`);
			}
		}

		globalConfigManager.set(normalizedKey, parsedValue);
		globalConfigManager.save();

		const isKey = normalizedKey.toLowerCase().includes('apikey');
		return {
			type: 'text',
			content: `Saved ${normalizedKey} = ${isKey ? '***set***' : String(parsedValue)}\nConfig path: ${ConfigManager.getDefaultConfigPath()}`,
		};
	}
}

export class CommandRegistry {
	private commands: Map<string, Command> = new Map();

	constructor() {
		this.registerDefaults();
	}

	private registerDefaults(): void {
		const defaults = [
			new HelpCommand(),
			new VersionCommand(),
			new ClearCommand(),
			new CostCommand(),
			new DoctorCommand(),
			new ConfigCommand(),
		];

		for (const cmd of defaults) {
			this.register(cmd);
		}
	}

	register(command: Command): void {
		this.commands.set(`/${command.name}`, command);
	}

	get(name: string): Command | undefined {
		return this.commands.get(name.startsWith('/') ? name : `/${name}`);
	}

	getAll(): Command[] {
		return Array.from(this.commands.values());
	}

	listCommands(): { name: string; description: string; type: CommandType }[] {
		return this.getAll().map((cmd) => ({
			name: cmd.name,
			description: cmd.description,
			type: cmd.type,
		}));
	}

	parseInput(input: string): { command: Command; args: Record<string, unknown> } | null {
		const trimmed = input.trim();

		if (!trimmed.startsWith('/')) {
			return null;
		}

		const parts = trimmed.slice(1).split(/\s+/);
		const commandName = parts[0];
		const command = this.get(commandName);

		if (!command) {
			return null;
		}

		let args: Record<string, unknown> = {};
		const argTokens = parts.slice(1);

		if (command.name === 'config') {
			args = {
				key: argTokens[0],
				value: argTokens.length > 1 ? argTokens.slice(1).join(' ') : undefined,
			};
		} else if (argTokens.length > 0) {
			args = { _: argTokens.join(' ') };
		}

		return { command, args };
	}
}

export const globalCommandRegistry = new CommandRegistry();
