#!/usr/bin/env node

import { Command } from '@commander-js/extra-typings';
import * as fs from 'fs';
import * as path from 'path';
import { createQueryEngine } from './QueryEngine.js';
import { globalToolRegistry } from './tools/index.js';
import { globalCommandRegistry } from './commands/index.js';

const packageJson = JSON.parse(fs.readFileSync(path.join(import.meta.dir, '../package.json'), 'utf-8'));

const program = new Command();

program
  .name('reo')
  .description('Reo Agent - AI-powered terminal coding assistant')
  .version(packageJson.version);

program
  .option('-m, --message <message>', 'Initial message to send to Reo')
  .option('--no-stream', 'Disable streaming responses')
  .option('--model <model>', 'Model to use')
  .option('--max-tokens <number>', 'Maximum tokens in response')
  .option('--temperature <number>', 'Sampling temperature')
  .action(async (options) => {
    await interactiveMode(options.message);
  });

async function interactiveMode(initialMessage?: string) {
  const readline = await import('readline');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const engine = createQueryEngine();

  const prompt = () => new Promise<string>((resolve) => {
    rl.question('\n\033[36myou\033[0m: ', (answer) => {
      resolve(answer);
    });
  });

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                      Reo Agent v${packageJson.version}                        ║
║           AI-powered terminal coding assistant                ║
╚══════════════════════════════════════════════════════════════╝
`);
  console.log('\033[32mreo\033[0m: Hello! I am Reo, your AI coding assistant.');
  console.log('       Type /help for commands, or just ask me anything.\n');

  let input = initialMessage;

  while (true) {
    if (!input) {
      input = await prompt();
    }

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log('\n\033[32mreo\033[0m: Goodbye!\n');
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
            console.log(`\n\033[35m${result.content}\033[0m\n`);
          } else if (result.type === 'action' && result.content === 'clear') {
            console.log('\n\033[2J\033[H');
            console.log('\033[32mreo\033[0m: Conversation cleared.\n');
          }
        } catch (error) {
          console.error(`\n\033[31mError: ${error instanceof Error ? error.message : 'Unknown error'}\033[0m\n`);
        }
        input = '';
        continue;
      } else {
        console.log(`\n\033[31mUnknown command: ${input}\033[0m\n`);
        input = '';
        continue;
      }
    }

    try {
      process.stdout.write('\n\033[32mreo\033[0m: ');
      
      const tools = globalToolRegistry.getAll();
      
      for await (const chunk of engine.streamQuery(input, { tools })) {
        process.stdout.write(chunk);
      }
      
      console.log('\n');
    } catch (error) {
      console.error(`\n\033[31mError: ${error instanceof Error ? error.message : 'Unknown error'}\033[0m\n`);
    }

    input = '';
  }

  rl.close();
}

program.parse();
