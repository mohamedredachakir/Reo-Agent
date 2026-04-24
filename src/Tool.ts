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
		input_schema: any;
	} {
		return {
			name: this.name,
			description: this.description,
			input_schema: this.zodToJSONSchema(this.inputSchema) as any,
		};
	}

	private zodToJSONSchema(schema: z.ZodTypeAny): unknown {
		if (schema instanceof z.ZodObject) {
			const properties: any = {};
			const required: string[] = [];
			const shape = schema.shape;

			for (const key in shape) {
				properties[key] = this.zodToJSONSchema(shape[key]);
				if (!(shape[key] instanceof z.ZodOptional)) {
					required.push(key);
				}
			}

			return {
				type: 'object',
				properties,
				required: required.length > 0 ? required : undefined,
			};
		}

		if (schema instanceof z.ZodString) return { type: 'string' };
		if (schema instanceof z.ZodNumber) return { type: 'number' };
		if (schema instanceof z.ZodBoolean) return { type: 'boolean' };
		if (schema instanceof z.ZodArray) {
			return {
				type: 'array',
				items: this.zodToJSONSchema(schema.element),
			};
		}
		if (schema instanceof z.ZodOptional) {
			return this.zodToJSONSchema(schema._def.innerType);
		}
		if (schema instanceof z.ZodEnum) {
			return { type: 'string', enum: schema._def.values };
		}

		return { type: 'string' }; // Fallback
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
