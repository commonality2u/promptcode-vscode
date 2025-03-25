# PromptCode

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **The ultimate rescue tool when AI code agents hit their limits**

PromptCode is your go-to VS Code extension when code agents like Cursor or Windsurf hit a wall. Designed to supercharge your coding workflow, PromptCode seamlessly connects your codebase to your favorite AI models—including those without direct API access, like o1-pro or Grok. Pick your file context, craft precise prompt templates, generate AI prompts, and even parse the responses—all within the comfort of your VS Code editor.

## Why PromptCode?

When your trusty code agent stumbles, PromptCode steps in as the ultimate rescue tool. Its unique strength lies in bridging the gap between your codebase and AI models, offering a structured, intuitive way to:

- **Select specific files** as context for your prompts
- **Add custom instructions** or use prompt templates for clarity
- **Work with any AI model**, even those tricky non-API ones
- **Parse and apply AI responses** directly to your code, implement yourself, or paste the response to your AI code agent

No more fumbling with scattered tools or manual context copying—PromptCode keeps it all in one place, right where you code.

## Key Features

### 🔍 Smart Context Selection
- **Intuitive File Picker**: Hand-pick files from your workspace to give your AI the exact context it needs
- **Intelligent Filtering**: Quickly filter relevant files with smart search and .gitignore/.promptcode_ignore support
- **Token Optimization**: See real-time token counts to maximize your context window

### ✏️ Instruction Builder
- **Custom Templates**: Built-in prompt templates for common coding tasks (refactoring, bug fixing, optimization, etc.)
- **@mention System**: Quickly insert templates with our `@` mention system (type @ in the instructions field)
- **Workspace Templates**: Create your own project-specific templates in `.promptcode/prompts`

### 💬 Universal AI Compatibility
- **Copy & Paste**: Works with ANY AI model or assistant - including Anthropic Claude, OpenAI GPT-4, Google Gemini, and others
- **No API Required**: Use with desktop models (Claude 3 Opus Local, o1-pro, Grok, etc.) or private instances
- **Supplement Your Workflow**: Perfect companion to Cursor, Windsurfninja, GitHub Copilot, and other AI coding tools

### 🔄 Structured Output Processing
- **Code Change Extraction**: Automatically parse code changes from AI responses
- **Smart Code Diff**: Preview changes with side-by-side diffs before applying
- **Bulk Apply**: Apply multiple file changes with a single click

## Usage

Here's how PromptCode rescues your workflow in four simple steps:

1. **Select Files**: Open the PromptCode view and use the file explorer to choose the files you want as context.
2. **Add Instructions**: Switch to the Instructions tab, type @ to pull up prompt templates, or write custom directions.
3. **Generate Prompt**: Review your polished prompt in the Generate Prompt tab—copy it or open it in the editor.
4. **Apply Changes**: Paste the AI's response in the Merge tab to review and apply suggested edits effortlessly.

## Configuration

Tailor PromptCode to your needs with these options:

- **Ignore Patterns**: Define which files to skip when selecting context (e.g., node_modules/ or .git/).
- **Prompt Folders**: Point to directories housing your custom prompt templates for quick access (e.g., .cursorrule, ai-docs).

## Installation

You can install this extension from the Visual Studio Code marketplace.

## Copyright 

© 2025 cogflows. All Rights Reserved.