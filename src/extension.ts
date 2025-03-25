/* PromptCode - Copyright (C) 2025. All Rights Reserved. */

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FileExplorerProvider, checkedItems, FileItem } from './fileExplorer';
import { copyToClipboard } from './promptGenerator';
import { PromptCodeWebViewProvider } from './webviewProvider';
import { countTokensInFile, countTokensWithCache, clearTokenCache, initializeTokenCounter } from './tokenCounter';
import { countTokens } from 'gpt-tokenizer/encoding/o200k_base';
import * as path from 'path';
import * as fs from 'fs';
import { IgnoreHelper } from './ignoreHelper';
import * as os from 'os';
import { DEFAULT_IGNORE_PATTERNS } from './constants';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('PromptCode extension activated');

	// Initialize token counter with global storage path
	if (context.globalStorageUri) {
		initializeTokenCounter(context.globalStorageUri.fsPath);
	} else {
		// Fallback to extension path if globalStorageUri is not available
		const storagePath = path.join(context.extensionPath, '.cache');
		initializeTokenCounter(storagePath);
		console.log(`Using fallback storage path: ${storagePath}`);
	}

	// Initialize output channel
	const outputChannel = vscode.window.createOutputChannel('PromptCode');
	outputChannel.show(true);

	// Get the workspace folder
	const workspaceRoot = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
		? vscode.workspace.workspaceFolders[0].uri.fsPath
		: undefined;

	// Create the file explorer provider
	const fileExplorerProvider = new FileExplorerProvider();
	const ignoreHelper = new IgnoreHelper();
	
	// Register the tree data provider
	const treeView = vscode.window.createTreeView('promptcodeExplorer', {
		treeDataProvider: fileExplorerProvider,
		showCollapseAll: true,
		canSelectMany: false,
		manageCheckboxStateManually: true
	} as vscode.TreeViewOptions<FileItem>);
	
	// Set the tree view instance in the provider
	fileExplorerProvider.setTreeView(treeView);
	
	// Handle checkbox toggling
	treeView.onDidChangeCheckboxState(event => {
		event.items.forEach(([item, state]) => {
			if (item instanceof FileItem) {
				fileExplorerProvider.handleCheckboxToggle(item, state);
			}
		});
	});

	// Listen for configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('promptcode.respectGitignore')) {
				// Refresh the ignore helper when the respectGitignore setting changes
				fileExplorerProvider.refreshIgnoreHelper();
			}
		})
	);

	// Create the PromptCode webview provider
	const promptCodeProvider = new PromptCodeWebViewProvider(context.extensionUri, context);
	
	// Show WebView when tree view becomes visible, hide it when not visible
	treeView.onDidChangeVisibility(e => {
		if (e.visible) {
			promptCodeProvider.showWebView();
			// Request selected files update when view becomes visible
			setTimeout(() => {
				vscode.commands.executeCommand('promptcode.getSelectedFiles');
			}, 100);
		} else {
			// Just hide the webview instead of closing it
			// No action needed - VS Code handles hiding automatically
		}
	});
	
	// Register a command to show the PromptCode webview
	const showPromptCodeViewCommand = vscode.commands.registerCommand('promptcode.showPromptCodeView', () => {
		promptCodeProvider.showWebView();
	});
	
	// Register the command to filter files based on search term
	const filterFilesCommand = vscode.commands.registerCommand('promptcode.filterFiles', async (searchTerm: string) => {
		await fileExplorerProvider.setSearchTerm(searchTerm);
	});
	
	// Register the command to show when the view container is activated
	context.subscriptions.push(showPromptCodeViewCommand);
	
	// If tree view is already visible on activation, show the webview
	if (treeView.visible) {
		promptCodeProvider.showWebView();
	}

	// Register select all command
	const selectAllCommand = vscode.commands.registerCommand('promptcode.selectAll', () => {
		fileExplorerProvider.selectAll();
	});

	// Register deselect all command
	const deselectAllCommand = vscode.commands.registerCommand('promptcode.deselectAll', () => {
		fileExplorerProvider.deselectAll();
	});

	// Register expand all command
	const expandAllCommand = vscode.commands.registerCommand('promptcode.expandAll', () => {
		console.log('expandAll command triggered in extension.ts');
		fileExplorerProvider.expandAll().then(() => {
			console.log('expandAll completed');
		}).catch(err => {
			console.error('Error in expandAll:', err);
			vscode.window.showErrorMessage(`Failed to expand all: ${err.message}`);
		});
	});

	// Register collapse all command
	const collapseAllCommand = vscode.commands.registerCommand('promptcode.collapseAll', () => {
		console.log('collapseAll command triggered in extension.ts');
		fileExplorerProvider.collapseAll().then(() => {
			console.log('collapseAll completed');
		}).catch(err => {
			console.error('Error in collapseAll:', err);
			vscode.window.showErrorMessage(`Failed to collapse all: ${err.message}`);
		});
	});

	// Register show file selector command
	const showFileSelectorCommand = vscode.commands.registerCommand('promptcode.showFileSelector', () => {
		// Focus the tree view
		vscode.commands.executeCommand('promptcodeExplorer.focus');
	});

	// Register generate prompt command
	const generatePromptCommand = vscode.commands.registerCommand('promptcode.generatePrompt', async () => {
		// Generate the prompt text
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Generating Prompt',
			cancellable: false
		}, async (progress) => {
			progress.report({ increment: 0 });
			
			try {
				const selectedFiles = await getSelectedFilesWithContent();
				const instructions = context.workspaceState.get('promptcode.instructions', '');
				// Get includeOptions from workspace state - throw if not found
				const savedOptions = context.workspaceState.get('promptcode.includeOptions');
				
				// Validate includeOptions
				if (!isValidIncludeOptions(savedOptions)) {
					throw new Error('Invalid includeOptions found. Please visit the Generate Prompt tab first to set your preferences.');
				}
				
				const promptText = await generatePrompt(selectedFiles, instructions, savedOptions);
				
				// Create a new document to show the prompt
				const document = await vscode.workspace.openTextDocument({
					content: promptText,
					language: 'markdown' 
				});
				
				// Show the document
				await vscode.window.showTextDocument(document);
				
				// Show success message with copy option
				const copyAction = 'Copy to Clipboard';
				vscode.window.showInformationMessage(
					'Prompt generated successfully!', 
					copyAction
				).then(selection => {
					if (selection === copyAction) {
						copyToClipboard(promptText).then(() => {
							vscode.window.showInformationMessage('Prompt copied to clipboard');
						});
					}
				});
				
				progress.report({ increment: 100 });
			} catch (error) {
				vscode.window.showErrorMessage(`Error generating prompt: ${(error as Error).message || String(error)}`);
			}
			
			return Promise.resolve();
		});
	});

	// Register generate prompt preview command
	const generatePromptPreviewCommand = vscode.commands.registerCommand('promptcode.generatePromptPreview', async (params) => {
		try {
			const selectedFiles = await getSelectedFilesWithContent();
			const instructions = context.workspaceState.get('promptcode.instructions', '');
			
			// Require includeOptions from tab3 to be present - no fallbacks
			if (!params?.includeOptions) {
				throw new Error('Missing includeOptions from Generate Prompt tab');
			}
			const includeOptions = params.includeOptions;
			
			// Store the last used includeOptions in workspace state to use across all commands
			context.workspaceState.update('promptcode.includeOptions', includeOptions);
			
			// Generate preview with options
			const promptText = await generatePrompt(selectedFiles, instructions, includeOptions);
			
			// Send preview back to webview
			if (promptCodeProvider._panel) {
				promptCodeProvider._panel.webview.postMessage({
					command: 'promptPreviewGenerated',
					preview: promptText,
					tokenCount: countTokens(promptText),
					action: params?.action || 'none'
				});
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Error generating prompt preview: ${(error as Error).message || String(error)}`);
		}
	});

	// Register copy to clipboard command
	const copyToClipboardCommand = vscode.commands.registerCommand('promptcode.copyToClipboard', async () => {
		const editor = vscode.window.activeTextEditor;
		if (editor) {
			const document = editor.document;
			const text = document.getText();
			await copyToClipboard(text);
			vscode.window.showInformationMessage('Content copied to clipboard');
		} else {
			vscode.window.showWarningMessage('No active text editor to copy from');
		}
	});

	// Register copy prompt to clipboard command
	const copyPromptDirectlyCommand = vscode.commands.registerCommand('promptcode.copyPromptDirectly', async () => {
		// Generate the prompt text and copy to clipboard
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: 'Generating and Copying Prompt',
			cancellable: false
		}, async (progress) => {
			progress.report({ increment: 0 });
			
			try {
				const selectedFiles = await getSelectedFilesWithContent();
				const instructions = context.workspaceState.get('promptcode.instructions', '');
				// Get includeOptions from workspace state - throw if not found
				const savedOptions = context.workspaceState.get('promptcode.includeOptions');
				
				// Validate includeOptions
				if (!isValidIncludeOptions(savedOptions)) {
					throw new Error('Invalid includeOptions found. Please visit the Generate Prompt tab first to set your preferences.');
				}
				
				const promptText = await generatePrompt(selectedFiles, instructions, savedOptions);
				
				// Copy to clipboard directly
				await copyToClipboard(promptText);
				
				// Show success message
				vscode.window.showInformationMessage('Prompt copied to clipboard successfully!');
				
				progress.report({ increment: 100 });
			} catch (error) {
				vscode.window.showErrorMessage(`Error generating prompt: ${(error as Error).message || String(error)}`);
			}
			
			return Promise.resolve();
		});
	});

	// Register apply merge command
	const applyMergeCommand = vscode.commands.registerCommand('promptcode.applyMerge', async (content) => {
		outputChannel.appendLine('Apply & Review requested for model output');
		// The parsing and display is handled in the webview
	});

	// Register replace code command
	const replaceCodeCommand = vscode.commands.registerCommand('promptcode.replaceCode', async (message) => {
		try {
			const { filePath, fileOperation, fileCode, workspaceName, workspaceRoot } = message;
			
			// Find the workspace folder for this file
			let targetWorkspaceFolder: vscode.WorkspaceFolder | undefined;
			
			if (workspaceName && workspaceRoot) {
				// Try to find the workspace folder by name and root path
				targetWorkspaceFolder = vscode.workspace.workspaceFolders?.find(folder => 
					folder.name === workspaceName && folder.uri.fsPath === workspaceRoot
				);
			}
			
			if (!targetWorkspaceFolder) {
				// Fallback to finding the workspace folder by file path
				const uri = vscode.Uri.file(path.join(workspaceRoot || '', filePath));
				targetWorkspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
			}
			
			if (!targetWorkspaceFolder) {
				throw new Error(`Could not find workspace folder for file: ${filePath}`);
			}
			
			// Construct the full file path
			const fullPath = path.join(targetWorkspaceFolder.uri.fsPath, filePath);
			
			// Handle different file operations
			switch (fileOperation.toUpperCase()) {
				case 'CREATE':
					// Create the directory if it doesn't exist
					await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
					// Create the file with the new content
					await fs.promises.writeFile(fullPath, fileCode);
					break;
					
				case 'UPDATE':
					// Update the file with the new content
					await fs.promises.writeFile(fullPath, fileCode);
					break;
					
				case 'DELETE':
					// Delete the file
					await fs.promises.unlink(fullPath);
					break;
					
				default:
					throw new Error(`Unsupported file operation: ${fileOperation}`);
			}
			
			// Notify the webview that the code was replaced successfully
			if (promptCodeProvider._panel) {
				// Use workspace name and file path for display
				const displayPath = workspaceName ? `${workspaceName}: ${filePath}` : filePath;
				
				console.log('Sending codeReplaced message:', {
					command: 'codeReplaced',
					filePath,
					displayPath,
					fileOperation,
					success: true
				});
				
				promptCodeProvider._panel.webview.postMessage({
					command: 'codeReplaced',
					filePath,
					displayPath,
					fileOperation,
					success: true
				});
				
				// Show a user-friendly message
				const operationMsg = fileOperation.toUpperCase() === 'CREATE' ? 'created' :
					fileOperation.toUpperCase() === 'DELETE' ? 'deleted' : 'updated';
				vscode.window.showInformationMessage(`Successfully ${operationMsg} ${displayPath}`);
			}
		} catch (error) {
			const errorMessage = `Failed to apply code changes: ${error instanceof Error ? error.message : String(error)}`;
			outputChannel.appendLine(errorMessage);
			vscode.window.showErrorMessage(errorMessage);
			
			// Notify the webview that the operation failed
			if (promptCodeProvider._panel) {
				console.log('Sending codeReplaced error message:', {
					command: 'codeReplaced',
					filePath: message.filePath,
					displayPath: message.filePath,
					fileOperation: message.fileOperation,
					success: false
				});
				
				promptCodeProvider._panel.webview.postMessage({
					command: 'codeReplaced',
					filePath: message.filePath,
					displayPath: message.filePath,
					fileOperation: message.fileOperation,
					success: false
				});
			}
		}
	});

	// Register save ignore config command (now only saves the respectGitignore setting)
	const saveIgnoreConfigCommand = vscode.commands.registerCommand('promptcode.saveIgnoreConfig', async (ignorePatterns: string | undefined, respectGitignore: boolean) => {
		console.log('Saving ignore configuration', { respectGitignore, ignorePatterns });
		
		// Save the respectGitignore setting
		const configTarget = vscode.workspace.workspaceFolders 
			? vscode.ConfigurationTarget.Workspace 
			: vscode.ConfigurationTarget.Global;
		
		const config = vscode.workspace.getConfiguration('promptcode');
		const oldValue = config.get('respectGitignore');
		console.log('Current respectGitignore setting:', oldValue);
		
		await config.update('respectGitignore', respectGitignore, configTarget);
		console.log('Updated respectGitignore setting to:', respectGitignore);
		
		// Immediately read back the value to confirm it was saved
		const newValue = vscode.workspace.getConfiguration('promptcode').get('respectGitignore');
		console.log('Read back respectGitignore value:', newValue);
		
		// Send an update back to the webview to ensure it's in sync
		if (promptCodeProvider._panel) {
			promptCodeProvider._panel.webview.postMessage({
				command: 'updateIgnoreConfig',
				respectGitignore: newValue,
				ignorePatterns: ignorePatterns || ''
			});
		}
	});

	// Register save prompts config command
	const savePromptsConfigCommand = vscode.commands.registerCommand('promptcode.savePromptsConfig', async (promptFolders: string, includeBuiltInTemplates: boolean) => {
		console.log('Saving prompts configuration', { includeBuiltInTemplates });
		
		// Save the includeBuiltInTemplates setting
		const configTarget = vscode.workspace.workspaceFolders 
			? vscode.ConfigurationTarget.Workspace 
			: vscode.ConfigurationTarget.Global;
		
		const config = vscode.workspace.getConfiguration('promptcode');
		await config.update('includeBuiltInTemplates', includeBuiltInTemplates, configTarget);
		
		// Save the promptFolders
		await config.update('promptFolders', promptFolders.split('\n').map(folder => folder.trim()).filter(folder => folder), configTarget);
		
		// Show success message
		vscode.window.showInformationMessage('Successfully saved prompts configuration');
	});

	// Load ignore configuration
	const loadIgnoreConfigCommand = vscode.commands.registerCommand('promptcode.loadIgnoreConfig', async () => {
		console.log('Loading ignore configuration');
		
		// Load respectGitignore from settings
		const config = vscode.workspace.getConfiguration('promptcode');
		const respectGitignore = config.get('respectGitignore', true);
		console.log('Loaded respectGitignore setting:', respectGitignore);
		
		// Try to load .promptcode_ignore if it exists
		let ignorePatterns = '';
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders && workspaceFolders.length > 0) {
			const workspaceRoot = workspaceFolders[0].uri.fsPath;
			const ignoreFilePath = path.join(workspaceRoot, '.promptcode_ignore');
			
			try {
				if (fs.existsSync(ignoreFilePath)) {
					ignorePatterns = fs.readFileSync(ignoreFilePath, 'utf8');
					console.log(`Loaded .promptcode_ignore file from ${ignoreFilePath}`);
				} else {
					// Provide default ignore patterns
					ignorePatterns = DEFAULT_IGNORE_PATTERNS;
				}
			} catch (err) {
				console.error('Error loading .promptcode_ignore file:', err);
			}
		}
		
		// Send back to webview
		if (promptCodeProvider._panel) {
			promptCodeProvider._panel.webview.postMessage({
				command: 'updateIgnoreConfig',
				respectGitignore,
				ignorePatterns
			});
		}
	});

	// Load prompts configuration
	const loadPromptsConfigCommand = vscode.commands.registerCommand('promptcode.loadPromptsConfig', async () => {
		console.log('Loading prompts configuration');
		
		// Load settings from configuration
		const config = vscode.workspace.getConfiguration('promptcode');
		const includeBuiltInTemplates = config.get('includeBuiltInTemplates', true);
		const promptFoldersArray = config.get('promptFolders', [
			'.promptcode/prompts',
			'.cursor/rules',
			'.github/copilot-instructions.md',
			'.zed/',
			'.windsurfrules',
			'.clinerules',
			'.ai-rules/',
			'ai-docs/'
		]);
		
		// Convert array to string with newlines
		const promptFolders = promptFoldersArray.join('\n');
		
		// Send back to webview
		if (promptCodeProvider._panel) {
			promptCodeProvider._panel.webview.postMessage({
				command: 'loadPromptsConfig',
				includeBuiltInTemplates,
				promptFolders
			});
		}
	});

	// Register get selected files command
	const getSelectedFilesCommand = vscode.commands.registerCommand('promptcode.getSelectedFiles', async () => {
		// Exit early if no panel exists to receive the updates
		if (!promptCodeProvider._panel) {
			console.log('No webview panel available to send selected files to');
			return;
		}

		// Ensure empty state is handled properly when no workspace is open
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			console.log('No workspace folders open, sending empty selection state');
			promptCodeProvider._panel.webview.postMessage({
				command: 'updateSelectedFiles',
				selectedFiles: [],
				totalTokens: 0
			});
			return;
		}

		try {
			console.log('Getting selected files to update webview');
			
			// Get all checked items
			const selectedFilePaths = Array.from(checkedItems.entries())
				.filter(([_, isChecked]) => isChecked)
				.map(([filePath, _]) => filePath)
				// Filter to only include files (not directories)
				.filter(filePath => {
					try {
						return fs.statSync(filePath).isFile();
					} catch (error) {
						console.log(`Error checking file ${filePath}:`, error);
						return false;
					}
				})
				// Add filter to exclude files that should be ignored based on current ignore rules
				.filter(filePath => {
					// If ignoreHelper doesn't exist yet, include all files
					if (!fileExplorerProvider.getIgnoreHelper()) {
						return true;
					}
					// Check if the file should be ignored
					const shouldBeIgnored = fileExplorerProvider.getIgnoreHelper()?.shouldIgnore(filePath) || false;
					if (shouldBeIgnored) {
						console.log(`Filtering out now-ignored file from selected files: ${filePath}`);
						// Also update the selection state since we're filtering it out
						checkedItems.set(filePath, false);
					}
					return !shouldBeIgnored;
				});

			console.log(`Found ${selectedFilePaths.length} selected files to show in webview`);

			// Calculate token counts for each file using cache and add workspace info
			const selectedFilesWithTokens = await Promise.all(
				selectedFilePaths.map(async (absolutePath) => {
					// Find which workspace folder this file belongs to
					let workspaceFolderName = '';
					let workspaceFolderRootPath = '';
					let relativePath = absolutePath;

					for (const folder of vscode.workspace.workspaceFolders!) {
						const folderPath = folder.uri.fsPath;
						if (absolutePath.startsWith(folderPath)) {
							workspaceFolderName = folder.name;
							workspaceFolderRootPath = folderPath;
							relativePath = path.relative(folderPath, absolutePath);
							break;
						}
					}

					const tokenCount = await countTokensWithCache(absolutePath);
					
					return {
						path: relativePath,
						absolutePath,
						workspaceFolderName,
						workspaceFolderRootPath,
						tokenCount
					};
				})
			);

			// Calculate total tokens
			const totalTokens = selectedFilesWithTokens.reduce((sum, file) => sum + file.tokenCount, 0);

			// Send the selected files with token counts back to the webview
			if (promptCodeProvider._panel) {
				promptCodeProvider._panel.webview.postMessage({
					command: 'updateSelectedFiles',
					selectedFiles: selectedFilesWithTokens,
					totalTokens: totalTokens
				});
			}
		} catch (error) {
			console.error('Error getting selected files:', error);
		}
	});

	// Register deselect file command
	const deselectFileCommand = vscode.commands.registerCommand('promptcode.deselectFile', async (relativeFilePath: string, workspaceFolderRootPath?: string) => {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			return;
		}

		try {
			let absoluteFilePath: string = '';
			
			if (workspaceFolderRootPath && fs.existsSync(workspaceFolderRootPath)) {
				// If workspace folder root path is provided and exists, use it
				absoluteFilePath = path.join(workspaceFolderRootPath, relativeFilePath);
			} else {
				// Try each workspace folder until we find one that works
				let fileFound = false;
				
				for (const folder of vscode.workspace.workspaceFolders) {
					const testPath = path.join(folder.uri.fsPath, relativeFilePath);
					try {
						await fs.promises.access(testPath, fs.constants.F_OK);
						absoluteFilePath = testPath;
						fileFound = true;
						break;
					} catch {
						// File doesn't exist in this workspace folder, try next one
						continue;
					}
				}
				
				if (!fileFound) {
					// Fallback to the first workspace folder if not found
					absoluteFilePath = path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, relativeFilePath);
					console.log(`File not found in any workspace folder, using fallback: ${absoluteFilePath}`);
				}
			}
			
			// Uncheck the file in the checkedItems map
			if (absoluteFilePath && checkedItems.has(absoluteFilePath)) {
				checkedItems.set(absoluteFilePath, false);
				
				// Update parent directories' checkbox states
				await fileExplorerProvider.updateParentStates(absoluteFilePath);
				
				// Refresh the tree view
				fileExplorerProvider.refresh();
				
				// Update the selected files list in the webview
				vscode.commands.executeCommand('promptcode.getSelectedFiles');
			} else {
				console.log(`File not in checked items: ${absoluteFilePath}`);
			}
		} catch (error) {
			console.error(`Error deselecting file: ${relativeFilePath}`, error);
		}
	});

	// Register remove directory command
	const removeDirectoryCommand = vscode.commands.registerCommand('promptcode.removeDirectory', async (dirPath: string, workspaceFolderName?: string) => {
		if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
			return;
		}

		try {
			console.log(`Removing files from directory: ${dirPath} in workspace folder: ${workspaceFolderName || 'all'}`);
			
			// Find matching workspace folder root path if workspace folder name is provided
			let targetWorkspaceFolderRootPath: string | undefined;
			if (workspaceFolderName) {
				const workspaceFolder = vscode.workspace.workspaceFolders.find(folder => folder.name === workspaceFolderName);
				if (workspaceFolder) {
					targetWorkspaceFolderRootPath = workspaceFolder.uri.fsPath;
				}
			}
			
			// Get all checked items
			const checkedFilePaths = Array.from(checkedItems.entries())
				.filter(([_, isChecked]) => isChecked)
				.map(([filePath, _]) => filePath);
			
			// Function to check if a file is in the specified directory
			const isFileInDirectory = (filePath: string, dirPath: string, workspaceFolderRootPath?: string): boolean => {
				// Handle root directory case
				if (dirPath === '.') {
					// Get relative path to workspace folder root
					if (workspaceFolderRootPath && filePath.startsWith(workspaceFolderRootPath)) {
						const relativePath = path.relative(workspaceFolderRootPath, filePath);
						// Check if the file is directly in the root (no path separator)
						return !relativePath.includes(path.sep);
					}
					return false;
				}
				
				// Handle subdirectory case
				for (const folder of vscode.workspace.workspaceFolders!) {
					if (!workspaceFolderRootPath || folder.uri.fsPath === workspaceFolderRootPath) {
						const fullDirPath = path.join(folder.uri.fsPath, dirPath);
						if (filePath.startsWith(fullDirPath + path.sep)) {
							return true;
						}
					}
				}
				return false;
			};
			
			// Find all checked files in the specified directory
			let filesToDeselect = checkedFilePaths.filter(filePath => 
				isFileInDirectory(filePath, dirPath, targetWorkspaceFolderRootPath)
			);
			
			console.log(`Found ${filesToDeselect.length} files to deselect in directory: ${dirPath}`);
			
			// Deselect each file
			for (const filePath of filesToDeselect) {
				checkedItems.set(filePath, false);
				await fileExplorerProvider.updateParentStates(filePath);
			}
			
			// Refresh the tree view
			fileExplorerProvider.refresh();
			
			// Update the selected files list in the webview
			vscode.commands.executeCommand('promptcode.getSelectedFiles');
		} catch (error) {
			console.error(`Error removing directory: ${dirPath}`, error);
		}
	});

	// Register copy file path command
	const copyFilePathCommand = vscode.commands.registerCommand('promptcode.copyFilePath', (fileItem: FileItem) => {
		if (fileItem && fileItem.fullPath) {
			vscode.env.clipboard.writeText(fileItem.fullPath);
			const type = fileItem.isDirectory ? 'folder' : 'file';
			vscode.window.showInformationMessage(`Copied ${type} absolute path to clipboard: ${fileItem.fullPath}`);
		}
	});

	// Register copy relative file path command
	const copyRelativeFilePathCommand = vscode.commands.registerCommand('promptcode.copyRelativeFilePath', (fileItem: FileItem) => {
		if (fileItem && fileItem.fullPath && workspaceRoot) {
			const relativePath = path.relative(workspaceRoot, fileItem.fullPath);
			vscode.env.clipboard.writeText(relativePath);
			const type = fileItem.isDirectory ? 'folder' : 'file';
			vscode.window.showInformationMessage(`Copied ${type} relative path to clipboard: ${relativePath}`);
		}
	});

	// Register clear token cache command
	const clearTokenCacheCommand = vscode.commands.registerCommand('promptcode.clearTokenCache', () => {
		clearTokenCache();
		fileExplorerProvider.refresh();
		vscode.window.showInformationMessage('Token cache cleared successfully');
	});

	// Register complete file explorer refresh command
	const refreshFileExplorerCommand = vscode.commands.registerCommand('promptcode.refreshFileExplorer', async () => {
		console.log('Performing file explorer refresh');
		await fileExplorerProvider.refreshIgnoreHelper();
		fileExplorerProvider.refresh();
		vscode.commands.executeCommand('promptcode.getSelectedFiles');
		vscode.window.showInformationMessage('File explorer refreshed successfully');
	});

	// Register open file in editor command
	const openFileInEditorCommand = vscode.commands.registerCommand('promptcode.openFileInEditor', (fileItemOrPath: FileItem | string, workspaceFolderRootPath?: string) => {
		try {
			let fileUri: vscode.Uri | undefined;
			
			if (typeof fileItemOrPath === 'string') {
				// If a string path is provided (from WebView)
				const filePath = fileItemOrPath;
				
				// Check if it's an absolute path
				if (path.isAbsolute(filePath)) {
					fileUri = vscode.Uri.file(filePath);
				} else {
					// It's a relative path, check if workspaceFolderRootPath is provided
					if (workspaceFolderRootPath && fs.existsSync(workspaceFolderRootPath)) {
						fileUri = vscode.Uri.file(path.join(workspaceFolderRootPath, filePath));
					} else {
						// Try to find the file in one of the workspace folders
						let found = false;
						
						for (const folder of vscode.workspace.workspaceFolders || []) {
							const fullPath = path.join(folder.uri.fsPath, filePath);
							if (fs.existsSync(fullPath)) {
								fileUri = vscode.Uri.file(fullPath);
								found = true;
								break;
							}
						}
						
						if (!found) {
							throw new Error(`Could not find file ${filePath} in any workspace folder`);
						}
					}
				}
			} else {
				// If a FileItem is provided (from TreeView)
				fileUri = vscode.Uri.file(fileItemOrPath.fullPath);
			}
			
			// Open the document
			if (fileUri) {
				vscode.window.showTextDocument(fileUri)
					.then(
						editor => console.log(`Successfully opened ${fileUri.fsPath}`),
						error => {
							console.error(`Failed to open document: ${error}`);
							vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
						}
					);
			} else {
				throw new Error('Failed to resolve file URI');
			}
		} catch (error) {
			console.error('Error opening file in editor:', error);
			vscode.window.showErrorMessage(`Error opening file: ${error instanceof Error ? error.message : String(error)}`);
		}
	});

	// Register show new content command
	const showNewContentCommand = vscode.commands.registerCommand('promptcode.showNewContent', async (message) => {
		try {
			const { filePath, fileCode, fileOperation, workspacePath, workspaceName } = message;
			if (!filePath || !fileCode) {
				throw new Error('Missing required parameters');
			}
			
			// Create a temporary file for viewing
			// Use the same extension as the original file
			const fileExtension = path.extname(filePath);
			const fileBasename = path.basename(filePath, fileExtension);
			const tempFilename = `${fileBasename}.new${fileExtension}`;
			const tempDir = path.join(os.tmpdir(), 'promptcode-preview');
			
			// Create the temp directory if it doesn't exist
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}
			
			const tempFilePath = path.join(tempDir, tempFilename);
			
			// Write the content to the temp file
			fs.writeFileSync(tempFilePath, fileCode);
			
			// Determine workspace information for display
			let displayPath = filePath;
			if (workspaceName) {
				displayPath = `[${workspaceName}]: ${filePath}`;
			}
			
			// Open the temp file in the editor
			const document = await vscode.workspace.openTextDocument(vscode.Uri.file(tempFilePath));
			await vscode.window.showTextDocument(document);
			
			// Show a message to inform the user this is a preview
			vscode.window.showInformationMessage(`This is a preview of the new content for ${displayPath} (${fileOperation})`);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Failed to show new content: ${errorMessage}`);
		}
	});

	// Register show diff command
	const showDiffCommand = vscode.commands.registerCommand('promptcode.showDiff', async (message) => {
		try {
			const { filePath, fileCode, fileOperation, workspaceName, workspaceRoot } = message;
			
			// For DELETE operations, we only need the filePath and fileOperation
			if (fileOperation && fileOperation.toUpperCase() === 'DELETE') {
				if (!filePath) {
					throw new Error('Missing filePath parameter');
				}
			} else {
				// For other operations, we need all parameters
				if (!filePath || !fileCode) {
					throw new Error('Missing required parameters');
				}
			}
			
			// Find the workspace folder for this file
			let targetWorkspaceFolder: vscode.WorkspaceFolder | undefined;
			
			if (workspaceName && workspaceRoot) {
				// Try to find the workspace folder by name and root path
				targetWorkspaceFolder = vscode.workspace.workspaceFolders?.find(folder => 
					folder.name === workspaceName && folder.uri.fsPath === workspaceRoot
				);
			}
			
			if (!targetWorkspaceFolder) {
				// Fallback to finding the workspace folder by file path
				const uri = vscode.Uri.file(path.join(workspaceRoot || '', filePath));
				targetWorkspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
			}
			
			if (!targetWorkspaceFolder) {
				throw new Error(`Could not find workspace folder for file: ${filePath}`);
			}
			
			// Construct the full file path
			const fullPath = path.join(targetWorkspaceFolder.uri.fsPath, filePath);
			
			// Create a temporary file for the new content
			const fileExtension = path.extname(filePath);
			const fileBasename = path.basename(filePath, fileExtension);
			const tempFilename = `${fileBasename}.new${fileExtension}`;
			const tempDir = path.join(os.tmpdir(), 'promptcode-diff');
			
			// Create the temp directory if it doesn't exist
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}
			
			const tempFilePath = path.join(tempDir, tempFilename);
			
			// Create empty file path for CREATE and DELETE operations
			const emptyFilePath = path.join(tempDir, `${fileBasename}.empty${fileExtension}`);
			
			// Write the new content to the temp file (if provided)
			if (fileCode) {
				fs.writeFileSync(tempFilePath, fileCode);
			}
			
			// Create empty file if needed for CREATE or DELETE operations
			fs.writeFileSync(emptyFilePath, '');
			
			// Default to UPDATE if no operation specified
			const operation = fileOperation?.toUpperCase() || 'UPDATE';
			
			// Different handling based on operation type
			if (operation === 'CREATE') {
				// For CREATE, use empty file as original
				await vscode.commands.executeCommand('vscode.diff',
					vscode.Uri.file(emptyFilePath),             // empty file (left)
					vscode.Uri.file(tempFilePath),              // new content (right)
					`${path.basename(filePath)} (Will be created)`,      // title
					{ preview: true }                           // open in preview mode
				);
			} else if (operation === 'DELETE') {
				// For DELETE, check if the original file exists
				if (!fs.existsSync(fullPath)) {
					vscode.window.showWarningMessage(`Could not find file to delete: ${filePath}. Using empty file for diff.`);
					await vscode.commands.executeCommand('vscode.diff',
						vscode.Uri.file(emptyFilePath),             // empty file (left)
						vscode.Uri.file(emptyFilePath),             // empty file (right)
						`${path.basename(filePath)} (Will be deleted)`,      // title
						{ preview: true }                           // open in preview mode
					);
				} else {
					// Original file (left) vs empty file (right)
					await vscode.commands.executeCommand('vscode.diff',
						vscode.Uri.file(fullPath),                 // original file (left)
						vscode.Uri.file(emptyFilePath),             // empty file (right)
						`${path.basename(filePath)} (Will be deleted)`,      // title
						{ preview: true }                           // open in preview mode
					);
				}
			} else {
				// For UPDATE, check if the original file exists
				if (!fs.existsSync(fullPath)) {
					vscode.window.showWarningMessage(`Could not find file to update: ${filePath}. Showing diff as if creating a new file.`);
					await vscode.commands.executeCommand('vscode.diff',
						vscode.Uri.file(emptyFilePath),             // empty file (left)
						vscode.Uri.file(tempFilePath),              // modified file (right)
						`${path.basename(filePath)} (Original ↔ Modified)`,  // title
						{ preview: true }                           // open in preview mode
					);
				} else {
					// Original file (left) vs modified file (right)
					await vscode.commands.executeCommand('vscode.diff',
						vscode.Uri.file(fullPath),                 // original file (left)
						vscode.Uri.file(tempFilePath),              // modified file (right)
						`${path.basename(filePath)} (Original ↔ Modified)`,  // title
						{ preview: true }                           // open in preview mode
					);
				}
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Failed to show diff: ${errorMessage}`);
		}
	});

	// Register debug refresh selected files command
	const debugRefreshSelectedFilesCommand = vscode.commands.registerCommand('promptcode.debugRefreshSelectedFiles', () => {
		getSelectedFilesWithContent().then(files => {
			console.log('Currently selected files:', files.map(file => file.path));
		});
	});

	// Register all commands
	context.subscriptions.push(
		showPromptCodeViewCommand,
		filterFilesCommand,
		selectAllCommand,
		deselectAllCommand,
		expandAllCommand,
		collapseAllCommand,
		showFileSelectorCommand,
		generatePromptCommand,
		generatePromptPreviewCommand,
		copyToClipboardCommand,
		copyPromptDirectlyCommand,
		applyMergeCommand,
		replaceCodeCommand,
		saveIgnoreConfigCommand,
		savePromptsConfigCommand,
		loadIgnoreConfigCommand,
		loadPromptsConfigCommand,
		getSelectedFilesCommand,
		deselectFileCommand,
		removeDirectoryCommand,
		copyFilePathCommand,
		copyRelativeFilePathCommand,
		clearTokenCacheCommand,
		refreshFileExplorerCommand,
		openFileInEditorCommand,
		showNewContentCommand,
		showDiffCommand,
		debugRefreshSelectedFilesCommand
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}

// Helper function to validate includeOptions
function isValidIncludeOptions(options: any): options is { files: boolean; instructions: boolean } {
	return options && 
	       typeof options === 'object' && 
	       'files' in options && 
	       'instructions' in options && 
	       typeof options.files === 'boolean' && 
	       typeof options.instructions === 'boolean';
}

// Helper function to generate prompt
async function generatePrompt(
	selectedFiles: { 
		path: string; 
		tokenCount: number; 
		workspaceFolderRootPath?: string; 
		absolutePath?: string;
		workspaceFolderName?: string;
	}[], 
	instructions: string,
	includeOptions: { files: boolean; instructions: boolean } 
): Promise<string> {
	const startTime = performance.now();
	
	// If files are not to be included and no instructions, return empty string
	if (!includeOptions.files && (!instructions || !includeOptions.instructions)) {
		const endTime = performance.now();
		console.log(`Prompt generation1 took ${endTime - startTime}ms for ${selectedFiles.length} files`);
		return '';
	}

	// If no files are selected but we have instructions
	if (selectedFiles.length === 0 && instructions && includeOptions.instructions) {
		const endTime = performance.now();
		console.log(`Prompt generation2 took ${endTime - startTime}ms for ${selectedFiles.length} files`);
		return instructions;
	}

	// Get file contents only if files are to be included
	const fileContents = includeOptions.files ? await Promise.all(selectedFiles.map(async file => {
		try {
			let absolutePath: string;
			
			// Use the file's absolutePath if available
			if (file.absolutePath) {
				absolutePath = file.absolutePath;
			}
			// Use the file's specific workspace folder root path if available
			else if (file.workspaceFolderRootPath) {
				absolutePath = path.join(file.workspaceFolderRootPath, file.path);
			}
			// Fallback to the first workspace folder (old behavior)
			else {
				const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
				if (!workspaceRoot) {
					throw new Error('No workspace folder is open');
				}
				absolutePath = path.join(workspaceRoot, file.path);
			}
			
			const content = await vscode.workspace.fs.readFile(vscode.Uri.file(absolutePath));
			return {
				path: file.path,
				content: content.toString(),
				tokenCount: file.tokenCount
			};
		} catch (error) {
			console.error(`Error reading file ${file.path}:`, error);
			return null;
		}
	})) : [];

	// Filter out failed reads
	const validFiles = fileContents.filter(file => file !== null);

	let prompt = '';
	
	// Add file sections only if files are to be included and there are valid files
	if (includeOptions.files && validFiles.length > 0) {
		// Add file tree section
		prompt += '<file_tree>\n';
		
		// First, group files by workspace folder and then by directory
		const filesByWorkspace: { [workspacePath: string]: { [dir: string]: string[] } } = {};
		
		// Get all valid workspace folders for the files
		for (const file of validFiles) {
			// Find which workspace folder this file belongs to
			let workspaceFolderRootPath = '';
			
			// Try to find the workspace folder for this file by looking at the original selected files
			const originalFile = selectedFiles.find(f => f.path === file.path);
			if (originalFile?.workspaceFolderRootPath) {
				workspaceFolderRootPath = originalFile.workspaceFolderRootPath;
			} else {
				// Fallback to first workspace folder if not found
				workspaceFolderRootPath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
			}
			
			// Initialize workspace folder entry if not exists
			if (!filesByWorkspace[workspaceFolderRootPath]) {
				filesByWorkspace[workspaceFolderRootPath] = {};
			}
			
			// Get the directory part of the file path
			const dir = path.dirname(file.path);
			
			// Initialize directory entry if not exists
			if (!filesByWorkspace[workspaceFolderRootPath][dir]) {
				filesByWorkspace[workspaceFolderRootPath][dir] = [];
			}
			
			// Add file to the directory
			filesByWorkspace[workspaceFolderRootPath][dir].push(file.path);
		}
		
		// Sort workspace folders
		const workspacePaths = Object.keys(filesByWorkspace).sort();
		
		// Process each workspace folder
		for (const workspacePath of workspacePaths) {
			// Add the workspace root path
			prompt += `${workspacePath}\n`;
			
			// Get directories for this workspace
			const dirs = Object.keys(filesByWorkspace[workspacePath]).sort();
			let currentIndent = '';
			let lastDir = '';
			
			// Process directories
			for (const dir of dirs) {
				if (dir !== '.') {
					// Calculate common prefix with last directory
					const parts = dir.split('/');
					const lastParts = lastDir.split('/');
					let i = 0;
					while (i < parts.length && i < lastParts.length && parts[i] === lastParts[i]) {
						i++;
					}
					
					// Output directory structure
					for (let j = i; j < parts.length; j++) {
						currentIndent = '    '.repeat(j);
						const isLast = j === parts.length - 1;
						prompt += `${currentIndent}${isLast ? '└── ' : '├── '}${parts[j]}\n`;
					}
					
					lastDir = dir;
				}
				
				// Output files
				const files = filesByWorkspace[workspacePath][dir].sort();
				const indent = dir === '.' ? '' : '    '.repeat(dir.split('/').length);
				for (let i = 0; i < files.length; i++) {
					const isLast = i === files.length - 1;
					const fileName = path.basename(files[i]);
					prompt += `${indent}${isLast ? '└── ' : '├── '}${fileName}\n`;
				}
			}
			
			// Add a blank line between workspace folders
			if (workspacePaths.indexOf(workspacePath) < workspacePaths.length - 1) {
				prompt += '\n';
			}
		}
		
		prompt += '\n</file_tree>\n\n';
		
		// Add file contents section
		prompt += '<files>\n';
		for (const file of validFiles) {
			// Find the original file to get the workspace folder path
			const originalFile = selectedFiles.find(f => f.path === file.path);
			let fullPath = file.path;
			let workspaceName = '';
			let workspaceRoot = '';
			let relPath = file.path; // Default to the path we already have
			
			// Get workspace information if available
			if (originalFile?.workspaceFolderRootPath) {
				fullPath = path.join(originalFile.workspaceFolderRootPath, file.path);
				workspaceName = originalFile.workspaceFolderName || '';
				workspaceRoot = originalFile.workspaceFolderRootPath;
				relPath = file.path; // This is already the relative path
			}
			
			prompt += `workspace_name: ${workspaceName}\n`;
			prompt += `workspace_root: ${workspaceRoot}\n`;
			prompt += `rel_path: ${relPath}\n`;
			prompt += `full_filepath: ${fullPath}\n\`\`\`${path.extname(file.path).substring(1)}\n${file.content}\n\`\`\`\n\n`;
		}
		prompt += '</files>';
	}
	
	// Add instructions if they exist and are to be included
	if (instructions?.trim() && includeOptions.instructions) {
		if (prompt) {
			prompt += '\n';
		}
		prompt += '<user_instructions>\n';
		prompt += instructions.trim();
		prompt += '\n</user_instructions>\n';
	}
	
	const endTime = performance.now();
	console.log(`Prompt generation took ${endTime - startTime}ms for ${validFiles.length} files`);
	
	return prompt;
}

// Helper function to get selected files with content
async function getSelectedFilesWithContent(): Promise<{
	path: string;
	tokenCount: number;
	workspaceFolderRootPath?: string;
	absolutePath?: string;
	workspaceFolderName?: string;
}[]> {
	if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
		throw new Error('No workspace folder is open');
	}

	// Get all checked items
	const selectedFilePaths = Array.from(checkedItems.entries())
		.filter(([_, isChecked]) => isChecked)
		.map(([filePath, _]) => filePath)
		.filter(filePath => {
			try {
				return fs.statSync(filePath).isFile();
			} catch (error) {
				return false;
			}
		});

	// Get file contents and token counts
	const selectedFiles = await Promise.all(
		selectedFilePaths.map(async (absolutePath) => {
			// Find which workspace folder this file belongs to
			let workspaceFolderName = '';
			let workspaceFolderRootPath = '';
			let relativePath = absolutePath;

			for (const folder of vscode.workspace.workspaceFolders!) {
				const folderPath = folder.uri.fsPath;
				if (absolutePath.startsWith(folderPath)) {
					workspaceFolderName = folder.name;
					workspaceFolderRootPath = folderPath;
					relativePath = path.relative(folderPath, absolutePath);
					break;
				}
			}

			const tokenCount = await countTokensWithCache(absolutePath);
			
			return {
				path: relativePath,
				absolutePath,
				workspaceFolderName,
				workspaceFolderRootPath,
				tokenCount
			};
		})
	);

	return selectedFiles;
}
