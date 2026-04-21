import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'yaml';
import { z } from 'zod';

export const ConfigSchema = z.object({
	provider: z.enum(['anthropic', 'openai', 'google', 'ollama']).default('anthropic'),
	apiKey: z.string().optional(), // Default for Anthropic or generic
	openaiApiKey: z.string().optional(),
	googleApiKey: z.string().optional(),
	ollamaBaseUrl: z.string().default('http://localhost:11434'),
	model: z.string().default('claude-sonnet-4-20250514'),
	maxTokens: z.number().default(8192),
	temperature: z.number().min(0).max(2).default(0.7),
	enabledTools: z.array(z.string()).optional(),
	disabledTools: z.array(z.string()).optional(),
	aliases: z.record(z.string()).optional(),
	hooks: z
		.object({
			preQuery: z.string().optional(),
			postQuery: z.string().optional(),
			onToolCall: z.string().optional(),
		})
		.optional(),
	logging: z
		.object({
			level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
			file: z.string().optional(),
		})
		.optional(),
});

export type Config = z.infer<typeof ConfigSchema>;

export class ConfigManager {
	private configPath: string;
	private config: Config;

	constructor() {
		const configDir = path.join(process.env.HOME || '', '.config', 'reo-agent');
		this.configPath = path.join(configDir, 'config.yaml');
		this.config = this.loadConfig();
	}

	private getConfigDir(): string {
		return path.dirname(this.configPath);
	}

	private loadConfig(): Config {
		if (!fs.existsSync(this.configPath)) {
			this.ensureConfigDir();
			return this.getDefaultConfig();
		}

		try {
			const content = fs.readFileSync(this.configPath, 'utf-8');
			const parsed = yaml.parse(content);
			return ConfigSchema.parse(parsed);
		} catch (error) {
			console.error('Failed to load config, using defaults:', error);
			return this.getDefaultConfig();
		}
	}

	private getDefaultConfig(): Config {
		return {
			provider: 'anthropic',
			ollamaBaseUrl: 'http://localhost:11434',
			model: 'claude-sonnet-4-20250514',
			maxTokens: 8192,
			temperature: 0.7,
		};
	}

	private ensureConfigDir(): void {
		const dir = this.getConfigDir();
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
	}

	get(): Config;
	get<K extends keyof Config>(key: K): Config[K];
	get<K extends keyof Config>(key?: K): Config | Config[K] {
		if (key === undefined) {
			return { ...this.config };
		}
		return this.config[key];
	}

	set<K extends keyof Config>(key: K, value: Config[K]): void {
		this.config[key] = value;
	}

	save(): void {
		this.ensureConfigDir();
		const content = yaml.stringify(this.config);
		fs.writeFileSync(this.configPath, content, 'utf-8');
	}

	reset(): void {
		this.config = this.getDefaultConfig();
		this.save();
	}

	static getDefaultConfigPath(): string {
		return path.join(process.env.HOME || '', '.config', 'reo-agent', 'config.yaml');
	}

	static createDefaultConfig(): void {
		const manager = new ConfigManager();
		manager.save();
	}
}

export const globalConfigManager = new ConfigManager();
