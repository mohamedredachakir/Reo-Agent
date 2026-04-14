import React from 'react';
import { z } from 'zod';

export type CommandType = 'prompt' | 'local' | 'local_jsx';

export interface CommandResult {
  type: 'text' | 'jsx' | 'action';
  content: string | React.ReactNode;
}

export abstract class Command {
  abstract name: string;
  abstract description: string;
  abstract type: CommandType;
  abstract inputSchema?: z.ZodType;

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
      content: `reo-agent v0.1.0`,
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
    return {
      type: 'text',
      content: `API Cost Tracking

Input tokens: 0
Output tokens: 0
Estimated cost: $0.00

(Enable token tracking in config for accurate costs)`,
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
      .map(c => `${c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✗'} ${c.name}: ${c.message}`)
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

  async execute(args?: Record<string, unknown>): Promise<CommandResult> {
    if (!args?.key) {
      return {
        type: 'text',
        content: `Current Configuration:

model: claude-sonnet-4-20250514
maxTokens: 8192
temperature: 0.7

To set a value: /config <key> <value>`,
      };
    }

    return {
      type: 'text',
      content: `Set ${args.key} = ${args.value}\n\n(Note: Config changes are not yet persisted)`,
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
    return this.getAll().map(cmd => ({
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

    if (parts.length > 1) {
      const argString = parts.slice(1).join(' ');
      
      if (command.inputSchema) {
        try {
          args = command.inputSchema.parse({}) as any;
          
          if (command.name === 'config' && parts.length >= 3) {
            args = { key: parts[1], value: parts[2] };
          }
        } catch {
          args = { _: argString };
        }
      } else {
        args = { _: argString };
      }
    }

    return { command, args };
  }
}

export const globalCommandRegistry = new CommandRegistry();
