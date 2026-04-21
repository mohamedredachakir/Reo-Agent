import { z } from 'zod';

export interface ToolResult {
	success: boolean;
	output?: string;
	error?: string;
}

export abstract class Tool {
	abstract name: string;
	abstract description: string;
	abstract inputSchema: z.ZodType | z.ZodObject<Record<string, z.ZodTypeAny>>;

	abstract execute(input: Record<string, unknown>): Promise<string>;

	getSchema(): {
		name: string;
		description: string;
		input_schema: {
			type: 'object';
			properties: Record<string, unknown>;
		};
	} {
		const schema = this.inputSchema;
		const shape = 'shape' in schema ? schema.shape : {};
		return {
			name: this.name,
			description: this.description,
			input_schema: {
				type: 'object',
				properties: shape,
			},
		};
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
