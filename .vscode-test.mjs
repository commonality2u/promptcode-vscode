import { defineConfig } from '@vscode/test-cli' with { type: "module" };

export default defineConfig({
	files: 'out/test/**/*.test.js',
});
