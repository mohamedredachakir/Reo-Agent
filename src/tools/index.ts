import type { Tool } from '../Tool.js';
import { BashTool, WebFetchTool } from './BashTools.js';
import { FileEditTool, FileReadTool, FileWriteTool, GlobTool, GrepTool } from './FileTools.js';

export class ToolRegistry {
	private tools: Map<string, Tool> = new Map();
	private defaultTools: Tool[] = [
		new FileReadTool(),
		new FileWriteTool(),
		new FileEditTool(),
		new BashTool(),
		new GlobTool(),
		new GrepTool(),
		new WebFetchTool(),
	];

	constructor() {
		this.registerDefaults();
	}

	private registerDefaults(): void {
		for (const tool of this.defaultTools) {
			this.register(tool);
		}
	}

	register(tool: Tool): void {
		this.tools.set(tool.name, tool);
	}

	unregister(name: string): boolean {
		return this.tools.delete(name);
	}

	get(name: string): Tool | undefined {
		return this.tools.get(name);
	}

	getAll(): Tool[] {
		return Array.from(this.tools.values());
	}

	getByNames(names: string[]): Tool[] {
		return names
			.map((name) => this.tools.get(name))
			.filter((tool): tool is Tool => tool !== undefined);
	}

	listTools(): { name: string; description: string }[] {
		return this.getAll().map((tool) => ({
			name: tool.name,
			description: tool.description,
		}));
	}

	isRegistered(name: string): boolean {
		return this.tools.has(name);
	}
}

export const globalToolRegistry = new ToolRegistry();
