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

		const totalTokens = usage.inputTokens + usage.outputTokens;
		const estimatedCostUsd =
			(usage.inputTokens / 1_000_000) * 3 + (usage.outputTokens / 1_000_000) * 15;

		return {
			type: 'text',
			content: `API Cost Tracking

Input tokens: ${usage.inputTokens}
Output tokens: ${usage.outputTokens}
Total tokens: ${totalTokens}
API calls: ${usage.apiCalls}
Estimated cost: $${estimatedCostUsd.toFixed(6)}

Estimated using default Sonnet pricing assumptions.`,
		};
	}
}

export class DoctorCommand extends Command {
	name = 'doctor';
	description = 'Check system requirements and configuration';
	type: CommandType = 'local';

	async execute(): Promise<CommandResult> {
		const checks: { name: string; status: 'pass' | 'fail' | 'warn'; message: string }[] = [];

		checks.push({
			name: 'API Key',
			status: process.env.ANTHROPIC_API_KEY ? 'pass' : 'fail',
			message: process.env.ANTHROPIC_API_KEY
				? 'ANTHROPIC_API_KEY is set'
				: 'ANTHROPIC_API_KEY not found in environment',
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

	private normalizeKey(input: string): 'model' | 'maxTokens' | 'temperature' | 'apiKey' | null {
		const map: Record<string, 'model' | 'maxTokens' | 'temperature' | 'apiKey'> = {
			model: 'model',
			maxTokens: 'maxTokens',
			max_tokens: 'maxTokens',
			temperature: 'temperature',
			apiKey: 'apiKey',
			api_key: 'apiKey',
		};

		return map[input] || null;
	}

	async execute(args?: Record<string, unknown>): Promise<CommandResult> {
		const config = globalConfigManager.get();

		if (!args?.key) {
			return {
				type: 'text',
				content: `Current Configuration:

model: ${config.model}
maxTokens: ${config.maxTokens}
temperature: ${config.temperature}
apiKey: ${config.apiKey ? '***set***' : 'not set'}

To set a value: /config <key> <value>`,
			};
		}

		const key = String(args.key);
		const normalizedKey = this.normalizeKey(key);

		if (!normalizedKey) {
			return {
				type: 'text',
				content: `Unknown config key: ${key}\nSupported keys: model, maxTokens, temperature, apiKey`,
			};
		}

		if (args.value === undefined) {
			const allConfig = globalConfigManager.get();
			const current = allConfig[normalizedKey];
			return {
				type: 'text',
				content: `${normalizedKey}: ${normalizedKey === 'apiKey' && current ? '***set***' : String(current)}`,
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

		switch (normalizedKey) {
			case 'model':
				globalConfigManager.set('model', String(parsedValue));
				break;
			case 'apiKey':
				globalConfigManager.set('apiKey', String(parsedValue));
				break;
			case 'maxTokens':
				globalConfigManager.set('maxTokens', Number(parsedValue));
				break;
			case 'temperature':
				globalConfigManager.set('temperature', Number(parsedValue));
				break;
		}

		globalConfigManager.save();

		return {
			type: 'text',
			content: `Saved ${normalizedKey} = ${normalizedKey === 'apiKey' ? '***set***' : String(parsedValue)}\nConfig path: ${ConfigManager.getDefaultConfigPath()}`,
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
