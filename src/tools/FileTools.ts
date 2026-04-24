import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { Tool } from '../Tool.js';

export class FileReadTool extends Tool {
	name = 'read';
	description =
		'Read the contents of a file from the file system. Use this to view code, configs, or any text file.';

	inputSchema = z.object({
		file_path: z.string().describe('The absolute path to the file to read'),
		limit: z.number().optional().describe('Maximum number of lines to read'),
		offset: z.number().optional().describe('Line number to start reading from (1-indexed)'),
	});

	async execute(input: Record<string, unknown>): Promise<string> {
		const filePath = input.file_path as string;

		if (!fs.existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		const stats = fs.statSync(filePath);
		if (stats.isDirectory()) {
			throw new Error(`Path is a directory, not a file: ${filePath}`);
		}

		let content: string;
		try {
			content = fs.readFileSync(filePath, 'utf-8');
		} catch (e) {
			throw new Error(`Failed to read file: ${this.formatError(e)}`);
		}

		const lines = content.split('\n');
		const offset = (input.offset as number) || 1;
		const limit = input.limit as number;

		if (offset > 1 || limit) {
			const startLine = Math.max(0, offset - 1);
			const endLine = limit ? startLine + limit : lines.length;
			const selectedLines = lines.slice(startLine, endLine);

			return selectedLines.map((line, i) => `${startLine + i + 1}: ${line}`).join('\n');
		}

		return content;
	}
}

export class FileWriteTool extends Tool {
	name = 'write';
	description =
		'Write content to a file, creating it if it does not exist or overwriting if it does.';

	inputSchema = z.object({
		file_path: z.string().describe('The absolute path to the file to write'),
		content: z.string().describe('The content to write to the file'),
	});

	async execute(input: Record<string, unknown>): Promise<string> {
		const filePath = input.file_path as string;
		const content = input.content as string;

		const dir = path.dirname(filePath);
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}

		try {
			fs.writeFileSync(filePath, content, 'utf-8');
			return `Successfully wrote to ${filePath}`;
		} catch (e) {
			throw new Error(`Failed to write file: ${this.formatError(e)}`);
		}
	}
}

export class FileEditTool extends Tool {
	name = 'edit';
	description =
		'Edit a file by replacing specific content. Use this to make targeted changes to files.';

	inputSchema = z.object({
		file_path: z.string().describe('The absolute path to the file to edit'),
		old_string: z
			.string()
			.describe('The exact string to replace. Must match the content in the file exactly.'),
		new_string: z.string().describe('The replacement string'),
	});

	async execute(input: Record<string, unknown>): Promise<string> {
		const filePath = input.file_path as string;
		const oldString = input.old_string as string;
		const newString = input.new_string as string;

		if (!fs.existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`);
		}

		let content: string;
		try {
			content = fs.readFileSync(filePath, 'utf-8');
		} catch (e) {
			throw new Error(`Failed to read file: ${this.formatError(e)}`);
		}

		if (!content.includes(oldString)) {
			throw new Error(
				`Could not find the specified string in the file.\n\nFile: ${filePath}\n\nSearched for:\n${oldString}`,
			);
		}

		const newContent = content.replace(oldString, newString);

		if (newContent === content) {
			throw new Error('Edit made no changes');
		}

		try {
			fs.writeFileSync(filePath, newContent, 'utf-8');
			return `Successfully edited ${filePath}`;
		} catch (e) {
			throw new Error(`Failed to write file: ${this.formatError(e)}`);
		}
	}
}

export class GlobTool extends Tool {
	name = 'glob';
	description =
		'Find files matching a glob pattern. Useful for locating files when you do not know the exact path.';

	inputSchema = z.object({
		pattern: z.string().describe('The glob pattern to match (e.g., "**/*.ts", "src/**/*.js")'),
		base_dir: z
			.string()
			.optional()
			.describe('The directory to search in (defaults to current directory)'),
	});

	async execute(input: Record<string, unknown>): Promise<string> {
		const { pattern, base_dir } = input;
		const { glob } = await import('glob');

		const rootDir = (base_dir as string) || process.cwd();

		try {
			const files = await glob(pattern as string, {
				cwd: rootDir,
				absolute: true,
			});

			if (files.length === 0) {
				return `No files found matching pattern: ${pattern}`;
			}

			return files.join('\n');
		} catch (e) {
			throw new Error(`Glob failed: ${this.formatError(e)}`);
		}
	}
}

export class GrepTool extends Tool {
	name = 'grep';
	description = 'Search for text patterns in files using ripgrep.';

	inputSchema = z.object({
		pattern: z.string().describe('The regex pattern to search for'),
		path: z.string().optional().describe('Path to search in (defaults to current directory)'),
		include: z
			.string()
			.optional()
			.describe('Glob pattern for files to search (e.g., "*.ts", "*.js")'),
		context: z.number().optional().describe('Number of context lines to show around matches'),
		before_context: z.number().optional().describe('Number of lines to show before matches'),
		after_context: z.number().optional().describe('Number of lines to show after matches'),
		case_sensitive: z.boolean().optional().default(false),
		invert: z.boolean().optional().default(false),
	});

	async execute(input: Record<string, unknown>): Promise<string> {
		const {
			pattern,
			path: searchPath,
			include,
			context,
			before_context,
			after_context,
			case_sensitive,
			invert,
		} = input;

		const args = ['--hidden', '--color=never'];

		if (include) {
			args.push('--glob', include as string);
		}

		if (case_sensitive) {
			args.push('--case-sensitive');
		}

		if (invert) {
			args.push('--invert-match');
		}

		if (context) {
			args.push(`-${context}`);
		} else {
			if (before_context) {
				args.push(`--before-context=${before_context}`);
			}
			if (after_context) {
				args.push(`--after-context=${after_context}`);
			}
		}

		args.push(pattern as string);
		args.push((searchPath as string) || '.');

		try {
			const { execa } = await import('execa');
			const result = await execa('rg', args, { reject: false });
			if (result.exitCode === 1) {
				return 'No matches found';
			}
			return result.stdout || 'No matches found';
		} catch (e) {
			throw new Error(`Grep failed: ${e instanceof Error ? e.message : String(e)}`);
		}
	}
}

export class ListDirectoryTool extends Tool {
	name = 'list_dir';
	description = 'List the contents of a directory.';

	inputSchema = z.object({
		path: z.string().optional().describe('The directory to list (defaults to current directory)'),
	});

	async execute(input: Record<string, unknown>): Promise<string> {
		const dirPath = (input.path as string) || process.cwd();

		if (!fs.existsSync(dirPath)) {
			throw new Error(`Directory not found: ${dirPath}`);
		}

		if (!fs.statSync(dirPath).isDirectory()) {
			throw new Error(`Path is not a directory: ${dirPath}`);
		}

		try {
			const files = fs.readdirSync(dirPath);
			const details = files.map((file) => {
				const fullPath = path.join(dirPath, file);
				const isDir = fs.statSync(fullPath).isDirectory();
				return `${isDir ? '[DIR] ' : '      '}${file}`;
			});

			return details.length > 0 ? details.join('\n') : 'Directory is empty';
		} catch (e) {
			throw new Error(`Failed to list directory: ${this.formatError(e)}`);
		}
	}
}

export class DeleteFileTool extends Tool {
	name = 'delete_file';
	description = 'Delete a file or directory.';

	inputSchema = z.object({
		path: z.string().describe('The path to the file or directory to delete'),
		recursive: z.boolean().optional().default(false).describe('Whether to delete recursively'),
	});

	async execute(input: Record<string, unknown>): Promise<string> {
		const targetPath = input.path as string;
		const recursive = !!input.recursive;

		if (!fs.existsSync(targetPath)) {
			throw new Error(`Path not found: ${targetPath}`);
		}

		try {
			fs.rmSync(targetPath, { recursive, force: true });
			return `Successfully deleted ${targetPath}`;
		} catch (e) {
			throw new Error(`Failed to delete: ${this.formatError(e)}`);
		}
	}
}

export class MoveFileTool extends Tool {
	name = 'move_file';
	description = 'Move or rename a file or directory.';

	inputSchema = z.object({
		source: z.string().describe('The current path of the file or directory'),
		destination: z.string().describe('The new path for the file or directory'),
	});

	async execute(input: Record<string, unknown>): Promise<string> {
		const source = input.source as string;
		const destination = input.destination as string;

		if (!fs.existsSync(source)) {
			throw new Error(`Source not found: ${source}`);
		}

		try {
			const destDir = path.dirname(destination);
			if (!fs.existsSync(destDir)) {
				fs.mkdirSync(destDir, { recursive: true });
			}
			fs.renameSync(source, destination);
			return `Successfully moved ${source} to ${destination}`;
		} catch (e) {
			throw new Error(`Failed to move: ${this.formatError(e)}`);
		}
	}
}
