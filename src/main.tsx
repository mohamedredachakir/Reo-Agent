#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings';
import { createQueryEngine } from './QueryEngine.js';
import { globalCommandRegistry } from './commands/index.js';
import { setUsageProvider } from './commands/index.js';
import { globalToolRegistry } from './tools/index.js';
import { VERSION } from './version';

const program = new Command();

program
	.name('reo')
	.description('Reo Agent - AI-powered terminal coding assistant')
	.version(VERSION);

program
	.option('-m, --message <message>', 'Initial message to send to Reo')
	.option('--no-stream', 'Disable streaming responses')
	.option(
		'--provider <provider>',
		'Provider to use (anthropic, openai, google, ollama)',
		'anthropic',
	)
	.option('--model <model>', 'Model to use')
	.option('--ollama-url <url>', 'Ollama base URL', 'http://localhost:11434')
	.option('--max-tokens <number>', 'Maximum tokens in response')
	.option('--temperature <number>', 'Sampling temperature')
	.action(async (options) => {
		await interactiveMode(options as any);
	});

interface CliOptions {
	message?: string;
	stream?: boolean;
	provider?: 'anthropic' | 'openai' | 'google' | 'ollama';
	model?: string;
	ollamaUrl?: string;
	maxTokens?: string;
	temperature?: string;
}

async function interactiveMode(options: CliOptions) {
	const initialMessage = options.message;
	const readline = await import('node:readline');

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const maxTokens = options.maxTokens ? Number(options.maxTokens) : undefined;
	const temperature = options.temperature ? Number(options.temperature) : undefined;

	if (options.maxTokens && (!Number.isFinite(maxTokens) || (maxTokens as number) <= 0)) {
		console.error('\n\x1b[31mError: --max-tokens must be a positive number\x1b[0m\n');
		rl.close();
		process.exitCode = 1;
		return;
	}

	if (
		options.temperature &&
		(!Number.isFinite(temperature) || (temperature as number) < 0 || (temperature as number) > 2)
	) {
		console.error('\n\x1b[31mError: --temperature must be between 0 and 2\x1b[0m\n');
		rl.close();
		process.exitCode = 1;
		return;
	}

	const engine = createQueryEngine({
		provider: options.provider,
		model: options.model,
		ollamaBaseUrl: options.ollamaUrl,
		maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
		temperature: Number.isFinite(temperature) ? temperature : undefined,
	});

	setUsageProvider(() => engine.getUsageStats());

	const prompt = () =>
		new Promise<string>((resolve) => {
			rl.question('\n\x1b[36myou\x1b[0m: ', (answer) => {
				resolve(answer);
			});
		});

	console.log(`
 ╔═════════════════════════════════════════════════════════════════════════════╗
 ║                                                                             ║
 ║   ██████╗ ███████╗ ██████╗      █████╗  ██████╗ ███████╗███╗   ██╗████████╗ ║
 ║   ██╔══██╗██╔════╝██╔═══██╗    ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝ ║
 ║   ██████╔╝█████╗  ██║   ██║    ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║    ║
 ║   ██╔══██╗██╔════╝██║   ██║    ██╔══██║██║   ██║██╔════╝██║╚██╗██║   ██║    ║
 ║   ██║  ██║███████╗╚██████╔╝    ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║    ║
 ║   ╚═╝  ╚═╝╚══════╝ ╚═════╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝    ║
 ║                                                                             ║
 ╠═════════════════════════════════════════════════════════════════════════════╣
 ║                                                                             ║
 ║   > VERSION : v${VERSION}                                                   ║
 ║   > ENGINE  : AI-POWERED TERMINAL CODING ASSISTANT                          ║
 ║   > STATUS  : SYSTEM READY / NEURAL LINK ACTIVE                             ║
 ║                                                                             ║
 ╚═════════════════════════════════════════════════════════════════════════════╝
`);
	console.log('\x1b[32mreo\x1b[0m: Hello! I am Reo, your AI coding assistant.');
	console.log('       Type /help for commands, or just ask me anything.\n');

	let input = initialMessage;

	while (true) {
		if (!input) {
			input = await prompt();
		}

		if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
			console.log('\n\x1b[32mreo\x1b[0m: Goodbye!\n');
			break;
		}

		if (input.trim() === '') {
			input = '';
			continue;
		}

		if (input.startsWith('/')) {
			const parsed = globalCommandRegistry.parseInput(input);
			if (parsed) {
				try {
					const result = await parsed.command.execute(parsed.args);
					if (result.type === 'text') {
						console.log(`\n\x1b[35m${result.content}\x1b[0m\n`);
					} else if (result.type === 'action' && result.content === 'clear') {
						console.log('\n\x1b[2J\x1b[H');
						console.log('\x1b[32mreo\x1b[0m: Conversation cleared.\n');
					}
				} catch (error) {
					console.error(
						`\n\x1b[31mError: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m\n`,
					);
				}
				input = '';
				continue;
			}

			console.log(`\n\x1b[31mUnknown command: ${input}\x1b[0m\n`);
			input = '';
			continue;
		}

		try {
			process.stdout.write('\n\x1b[32mreo\x1b[0m: ');

			const tools = globalToolRegistry.getAll();

			if (options.stream === false) {
				const response = await engine.query(input, {
					tools,
					maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
					temperature: Number.isFinite(temperature) ? temperature : undefined,
				});
				process.stdout.write(response);
			} else {
				for await (const chunk of engine.streamQuery(input, {
					tools,
					maxTokens: Number.isFinite(maxTokens) ? maxTokens : undefined,
					temperature: Number.isFinite(temperature) ? temperature : undefined,
				})) {
					process.stdout.write(chunk);
				}
			}

			console.log('\n');
		} catch (error) {
			console.error(
				`\n\x1b[31mError: ${error instanceof Error ? error.message : 'Unknown error'}\x1b[0m\n`,
			);
		}

		input = '';
	}

	rl.close();
}

program.parse();
