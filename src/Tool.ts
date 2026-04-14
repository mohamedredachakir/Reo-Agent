import { z } from 'zod';
import { Tool as AnthropicTool } from '@anthropic-ai/sdk';

export interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

export abstract class Tool {
  abstract name: string;
  abstract description: string;
  abstract inputSchema: z.ZodType | z.ZodObject<any>;

  abstract execute(input: Record<string, unknown>): Promise<string>;

  getSchema(): AnthropicTool {
    const schema = this.inputSchema;
    const shape = 'shape' in schema ? schema.shape : {};
    return {
      name: this.name,
      description: this.description,
      input_schema: shape,
    } as AnthropicTool;
  }

  protected formatOutput(output: unknown): string {
    if (typeof output === 'string') return output;
    return JSON.stringify(output, null, 2);
  }

  protected formatError(error: unknown): string {
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

export { z };
