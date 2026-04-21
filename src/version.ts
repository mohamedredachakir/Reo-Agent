import * as fs from 'node:fs';
import * as path from 'node:path';

function readPackageVersion(): string {
	try {
		const packageJsonPath = path.join(import.meta.dir, '../package.json');
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
			version?: string;
		};
		return packageJson.version || '0.0.0';
	} catch {
		return '0.0.0';
	}
}

export const VERSION = readPackageVersion();
