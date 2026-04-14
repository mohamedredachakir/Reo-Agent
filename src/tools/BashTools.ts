import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { execa } from 'execa';
import { Tool } from '../Tool.js';

export class BashTool extends Tool {
  name = 'bash';
  description = 'Execute a bash command in the terminal. Use for running scripts, build commands, git operations, etc.';

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
        cwd: cwd as string || process.cwd(),
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
    } catch (e: any) {
      if (e.timedOut) {
        throw new Error(`Command timed out after ${timeoutMs}ms`);
      }
      throw new Error(`Command failed: ${e.message}`);
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

export class GrepTool extends Tool {
  name = 'grep';
  description = 'Search for text patterns in files using ripgrep.';

  inputSchema = z.object({
    pattern: z.string().describe('The regex pattern to search for'),
    path: z.string().optional().describe('Path to search in'),
    include: z.string().optional().describe('File pattern to match (e.g., "*.ts")'),
    case_sensitive: z.boolean().optional().default(false),
    context: z.number().optional().describe('Lines of context around matches'),
  });

  async execute(input: Record<string, unknown>): Promise<string> {
    const { pattern, path: searchPath, include, case_sensitive, context } = input;

    const args: string[] = ['--hidden'];

    if (include) {
      args.push('--glob', include as string);
    }

    if (!case_sensitive) {
      args.push('--ignore-case');
    }

    if (context) {
      args.push(`-${context}`);
    }

    args.push(pattern as string);
    args.push(searchPath as string || '.');

    try {
      const result = await execa('rg', args, { reject: false });
      return result.stdout || 'No matches found';
    } catch (e: any) {
      if (e.exitCode === 1) {
        return 'No matches found';
      }
      throw new Error(`Grep failed: ${e.message}`);
    }
  }
}

export class GlobTool extends Tool {
  name = 'glob';
  description = 'Find files matching a glob pattern.';

  inputSchema = z.object({
    pattern: z.string().describe('Glob pattern (e.g., "**/*.ts")'),
    base_dir: z.string().optional().describe('Base directory to search in'),
  });

  async execute(input: Record<string, unknown>): Promise<string> {
    const { pattern, base_dir } = input;
    const { glob } = await import('glob');

    const files = await glob(pattern as string, {
      cwd: (base_dir as string) || process.cwd(),
      absolute: true,
    });

    return files.length > 0 ? files.join('\n') : 'No files found';
  }
}

export class GlobImplementation {
  async glob(pattern: string, options: { cwd?: string; absolute?: boolean } = {}): Promise<string[]> {
    const { glob } = await import('glob');
    return glob(pattern, {
      cwd: options.cwd || process.cwd(),
      absolute: options.absolute || false,
    });
  }
}
