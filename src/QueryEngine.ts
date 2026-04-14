import { Anthropic } from '@anthropic-ai/sdk';
import { Message, ToolUseBlock, ContentBlock } from '@anthropic-ai/sdk';
import { Tool } from './Tool.js';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as yaml from 'yaml';
import * as path from 'path';
import { z } from 'zod';

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

export class QueryEngine extends EventEmitter {
  private client: Anthropic;
  private config: ReoConfig;
  private messageHistory: Message[] = [];
  private toolCallHistory: ToolCallResult[] = [];
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
    let response = await this.executeRound(
      systemPrompt,
      tools,
      options
    );

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
    options: QueryOptions
  ): Promise<ContentBlock[]> {
    const toolSchemas = tools.map(t => t.getSchema());
    const messages = this.messageHistory.map(m => ({
      role: m.role,
      content: m.content,
    }));

    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: options.maxTokens || this.config.maxTokens,
      temperature: options.temperature ?? this.config.temperature,
      system: systemPrompt,
      tools: toolSchemas,
      messages: messages as any,
    });

    return response.content as ContentBlock[];
  }

  private shouldContinue(response: ContentBlock[], tools: Tool[]): boolean {
    return response.some(block => block.type === 'tool_use');
  }

  private async executeToolCalls(
    response: ContentBlock[],
    tools: Tool[]
  ): Promise<ContentBlock[]> {
    const results: ContentBlock[] = [];

    for (const block of response) {
      if (block.type === 'tool_use') {
        const toolUse = block as ToolUseBlock;
        const tool = tools.find(t => t.name === toolUse.name);

        if (!tool) {
          results.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: `Error: Unknown tool "${toolUse.name}"`,
          });
          continue;
        }

        try {
          this.emit('toolCallStart', { tool: toolUse.name, input: toolUse.input });
          const output = await tool.execute(toolUse.input as Record<string, unknown>);
          this.emit('toolCallEnd', { tool: toolUse.name, output });

          this.toolCallHistory.push({
            tool: toolUse.name,
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
          this.emit('toolCallError', { tool: toolUse.name, error: errorMessage });

          this.toolCallHistory.push({
            tool: toolUse.name,
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

  private extractTextContent(response: ContentBlock[]): string {
    return response
      .filter(block => block.type === 'text')
      .map(block => (block as any).text)
      .join('\n');
  }

  getHistory(): { messages: Message[]; toolCalls: ToolCallResult[] } {
    return {
      messages: this.messageHistory,
      toolCalls: this.toolCallHistory,
    };
  }

  clearHistory(): void {
    this.messageHistory = [];
    this.toolCallHistory = [];
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
      tools: tools.map(t => t.getSchema()),
      messages: this.messageHistory.map(m => ({
        role: m.role,
        content: m.content,
      })) as any,
    });

    let fullResponse = '';

    for await (const event of stream) {
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
  }
}

export function createQueryEngine(config?: Partial<ReoConfig>): QueryEngine {
  return new QueryEngine(config);
}
