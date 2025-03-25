import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { checkedItems } from './fileExplorer';
import { countTokensWithCache } from './tokenCounter';

// Generate a directory tree representation for the prompt
export async function generateDirectoryTree(workspaceFolders: vscode.WorkspaceFolder[]): Promise<string> {
  let result = '';
  
  for (const folder of workspaceFolders) {
    const rootPath = folder.uri.fsPath;
    const rootName = folder.name;
    
    result += `# Workspace: ${rootName}\n`;
    
    // Build the tree recursively for this workspace
    const buildTree = async (dirPath: string, prefix: string = ''): Promise<void> => {
      try {
        // Get all entries in this directory
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        
        // Sort entries (directories first, then files)
        const sortedEntries = entries.sort((a, b) => {
          if (a.isDirectory() && !b.isDirectory()) return -1;
          if (!a.isDirectory() && b.isDirectory()) return 1;
          return a.name.localeCompare(b.name);
        });
        
        // Process each entry
        for (let i = 0; i < sortedEntries.length; i++) {
          const entry = sortedEntries[i];
          const entryPath = path.join(dirPath, entry.name);
          
          // Skip node_modules, .git, and other common directories/files that should be ignored
          if (entry.name === 'node_modules' || entry.name === '.git') {
            continue;
          }
          
          // Check if this entry is the last one at this level
          const isLast = i === sortedEntries.length - 1;
          
          // Determine the branch character
          const branchChar = isLast ? '└──' : '├──';
          
          // Determine the prefix for the next level
          const nextPrefix = prefix + (isLast ? '    ' : '│   ');
          
          // Get the relative path from workspace root for display
          const relativePath = path.relative(rootPath, entryPath);
          
          if (entry.isDirectory()) {
            // Check if this directory has any selected files before including it
            const hasSelected = await hasSelectedFiles(entryPath);
            if (!hasSelected) continue;
            
            // Add directory entry
            result += `${prefix}${branchChar} ${entry.name}/\n`;
            
            // Recursively process subdirectory
            await buildTree(entryPath, nextPrefix);
          } else {
            // Check if this file is selected
            if (!checkedItems.get(entryPath)) continue;
            
            // Add file entry
            result += `${prefix}${branchChar} ${entry.name} (${relativePath})\n`;
          }
        }
      } catch (error) {
        console.error(`Error building tree for ${dirPath}:`, error);
      }
    };
    
    // Helper function to check if a directory has any selected files
    const hasSelectedFiles = async (dirPath: string): Promise<boolean> => {
      try {
        // Check if this directory itself is selected
        if (checkedItems.get(dirPath)) {
          return true;
        }
        
        // Check all entries in this directory
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        
        // Check each entry
        for (const entry of entries) {
          const entryPath = path.join(dirPath, entry.name);
          
          // Skip common ignored directories
          if (entry.isDirectory() && (entry.name === 'node_modules' || entry.name === '.git')) {
            continue;
          }
          
          if (entry.isDirectory()) {
            // Recursively check subdirectories
            const hasSelected = await hasSelectedFiles(entryPath);
            if (hasSelected) return true;
          } else {
            // Check if this file is selected
            if (checkedItems.get(entryPath)) {
              return true;
            }
          }
        }
      } catch (error) {
        console.error(`Error checking selected files in ${dirPath}:`, error);
      }
      
      return false;
    };
    
    // Start building the tree from the workspace root
    await buildTree(rootPath);
    
    // Add a separator between workspaces
    result += '\n';
  }
  
  return result;
}

// Utility function to read file content with error handling
async function readFileContent(filePath: string): Promise<string> {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8');
    return content;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    return `Error reading file: ${error}`;
  }
}

// Main function to generate the prompt text
export async function generatePrompt(): Promise<string> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return 'No workspace folders available.';
  }
  
  let promptText = '';
  
  // Start with the file map section
  promptText += '<file_map>\n';
  promptText += await generateDirectoryTree([...workspaceFolders]);
  promptText += '</file_map>\n\n';
  
  // Add the file contents section
  promptText += '<file_contents>\n';
  
  // Get all selected file paths
  const selectedFilePaths = Array.from(checkedItems.entries())
    .filter(([_, isChecked]) => isChecked)
    .map(([filePath, _]) => filePath);
  
  // Process each selected file
  for (const filePath of selectedFilePaths) {
    try {
      const stats = await fs.promises.stat(filePath);
      
      // Skip directories
      if (stats.isDirectory()) {
        continue;
      }
      
      // Get the workspace folder containing this file
      const uri = vscode.Uri.file(filePath);
      const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
      
      if (workspaceFolder) {
        // Get relative path from workspace root
        const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
        const tokenCount = await countTokensWithCache(filePath);
        
        promptText += `File: ${relativePath} (${tokenCount} tokens)\n`;
        promptText += '```\n';
        promptText += await readFileContent(filePath);
        promptText += '\n```\n\n';
      } else {
        // Fallback for files not in a workspace
        promptText += `File: ${filePath}\n`;
        promptText += '```\n';
        promptText += await readFileContent(filePath);
        promptText += '\n```\n\n';
      }
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }
  
  promptText += '</file_contents>';
  
  return promptText;
}

export async function copyToClipboard(text: string): Promise<void> {
  await vscode.env.clipboard.writeText(text);
} 