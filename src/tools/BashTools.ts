import { execa } from 'execa';
import { z } from 'zod';
import { Tool } from '../Tool.js';

export class BashTool extends Tool {
	name = 'bash';
	description =
		'Execute a bash command in the terminal. Use for running scripts, build commands, git operations, etc.';

	inputSchema = z.object({
		command: z.string().describe('The bash command to execute'),
		timeout: z.number().optional().describe('Timeout in milliseconds (default: 60000)'),
		cwd: z.string().optional().describe('Working directory for the command'),
		env: z.record(z.string()).optional().describe('Environment variables'),
	});

	async execute(input: Record<string, unknown>): Promise<string> {
		const { command, timeout, cwd, env } = input;
		const timeoutMs = (timeout as number) || 60000;

		try {
			const result = await execa('bash', ['-c', command as string], {
				timeout: timeoutMs,
				cwd: (cwd as string) || process.cwd(),
				env: { ...process.env, ...(env as Record<string, string>) },
				reject: false,
				all: true,
			});

			let output = '';

			if (result.stdout) {
				output += result.stdout;
			}

			if (result.stderr && result.stderr !== result.stdout) {
				if (output) output += '\n';
				output += `STDERR:\n${result.stderr}`;
			}

			if (result.exitCode !== 0) {
				if (output) output += '\n\n';
				output += `Exit code: ${result.exitCode}`;
			}

			return output || 'Command completed with no output';
		} catch (e: unknown) {
			if (
				typeof e === 'object' &&
				e !== null &&
				'timedOut' in e &&
				Boolean((e as { timedOut?: unknown }).timedOut)
			) {
				throw new Error(`Command timed out after ${timeoutMs}ms`);
			}
			throw new Error(`Command failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
}

export class WebFetchTool extends Tool {
	name = 'web_fetch';
	description = 'Fetch content from a URL on the web.';

	inputSchema = z.object({
		url: z.string().url().describe('The URL to fetch'),
		prompt: z.string().optional().describe('What to extract from the page'),
	});

	async execute(input: Record<string, unknown>): Promise<string> {
		const { url, prompt } = input;

		try {
			const response = await fetch(url as string);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const text = await response.text();

			if (prompt) {
				return `Fetched from ${url}:\n\n${text.slice(0, 10000)}`;
			}

			return text.slice(0, 5000) + (text.length > 5000 ? '\n\n[Content truncated]' : '');
		} catch (e) {
			throw new Error(`Failed to fetch URL: ${this.formatError(e)}`);
		}
	}
}
