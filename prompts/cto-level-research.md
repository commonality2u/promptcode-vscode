---
description: Generate comprehensive technical documentation for a codebase, suitable for a new CTO, including architecture, setup, usage, and best practices.
category: Code Research
---

### Instruction for AI to Generate `ai-cto-docs.md`

**Objective**:  
Analyze the provided codebase and generate a single Markdown file, `ai-cto-docs.md`, that serves as a complete guide for a new CTO. The document should include an executive summary, codebase overview, file tree, setup and installation instructions, usage examples, operational guides, FAQs, architecture details, key design decisions, known issues, and contribution guidelines. Use clear, professional language and follow best practices for open-source documentation.

**Steps to Generate the Document**:

1. **Analyze the Codebase Structure**:
   - Identify the main directories and their purposes (e.g., `src/`, `tests/`, `docs/`).
   - Detect the programming languages, frameworks, and libraries used (e.g., Python with Django, JavaScript with React).
   - Understand the relationships between different parts of the code (e.g., how modules or components interact).

2. **Extract Key Information**:
   - Look for comments, docstrings, and existing documentation within the code to understand functionality and intent.
   - Identify configuration files (e.g., `.env`, `config.json`), environment variables, and dependencies (e.g., `package.json`, `requirements.txt`).
   - Find the entry points of the application (e.g., `main.py`, `index.js`, `app.js`).

3. **Generate the Executive Summary**:
   - Summarize the overall purpose of the codebase (e.g., "This is a web application for managing inventory").
   - Highlight the main technologies and frameworks (e.g., "Built with Flask and PostgreSQL").
   - Mention standout features (e.g., "Real-time data syncing") and potential high-level issues (e.g., "Heavy reliance on third-party APIs").

4. **Create the Codebase Overview**:
   - Describe the main components or modules and their functionalities (e.g., "The `api` module handles external requests").
   - Explain how these components interact (e.g., "The frontend fetches data from the backend via GraphQL").

5. **Produce the File Tree**:
   - Generate a simplified directory structure focusing on key folders and files (e.g., using a text-based tree representation).
   - Provide brief descriptions for each major directory or file (e.g., "`src/`: Core application logic").

6. **Detail Setup and Installation**:
   - List prerequisites (e.g., "Python 3.9+, pip, Node.js v18+").
   - Provide step-by-step instructions to set up the development environment (e.g., "Clone the repository: `git clone <repo-url>`").
   - Include commands to install dependencies (e.g., "Run `pip install -r requirements.txt`") and configure the environment (e.g., "Set up `.env` with the provided template").

7. **Explain Usage**:
   - Show how to run the application locally (e.g., "Start the server with `npm run dev`").
   - Provide examples of common commands or operations (e.g., "To query data: `curl http://localhost:3000/api/data`").
   - Include sample inputs and outputs if applicable (e.g., "Input: `{ "id": 1 }`, Output: `{ "name": "Item1" }`").

8. **Develop Operational Guides**:
   - Create concise, high-level guides for common tasks, such as:
     - **Adding a New Feature**: "Add a new route in `src/routes/`, update the UI, and test locally."
     - **Fixing a Bug**: "Locate the issue in logs, fix in `src/`, and verify with unit tests."
     - **Deploying the Application**: "Push to production with `git push prod main` after building."
   - Ensure these guides are actionable and relevant to the codebase.

9. **Compile FAQs**:
   - Anticipate common questions a new CTO might have (e.g., "What database is used?", "How do I run tests?").
   - Provide clear answers based on the codebase (e.g., "The app uses MongoDB; see [Setup](#setup-and-installation)").

10. **Describe the Architecture**:
    - Explain the overall architecture pattern (e.g., "Follows a client-server model").
    - Include a simple text-based diagram if possible (e.g., "Client → API → Database").
    - Highlight data flow and key system interactions.

11. **Discuss Key Design Decisions**:
    - Identify why certain technologies or approaches were chosen (e.g., "TypeScript was used for type safety").
    - Mention trade-offs or alternatives considered (e.g., "Considered SQLite but chose MySQL for scalability").

12. **List Known Issues**:
    - Identify bugs, performance bottlenecks, or areas needing improvement (e.g., "High memory usage in `data-processor.js`").
    - Suggest possible solutions or workarounds (e.g., "Optimize loops or add caching").

13. **Outline Contribution Guidelines**:
    - Explain coding style and standards (e.g., "Follow PEP 8 for Python code").
    - Describe the process for submitting changes (e.g., "Submit a pull request with a detailed description").
    - Mention testing and documentation requirements (e.g., "All new features must include unit tests").

**Formatting Instructions**:
- Use Markdown syntax with:
  - Clear headings (`#`, `##`, `###`) for each section.
  - Bullet points or numbered lists for steps and details.
  - Code blocks (```) for commands, file names, and code snippets.
- Include a table of contents at the top with links to each section (e.g., `[Executive Summary](#executive-summary)`).
- Use professional, concise language suitable for a CTO audience.
- If specific information is missing from the codebase, make reasonable inferences based on structure, naming conventions, or common practices.

**Final Output**:
- Produce a single Markdown file named `ai-cto-docs.md`.
- Ensure the document is well-organized, easy to navigate, and balances high-level insights with practical details.

---

### Example Structure of `ai-cto-docs.md`
Here's how the final file might look in outline form:

```markdown
# AI CTO Documentation

## Table of Contents
- [Executive Summary](#executive-summary)
- [Codebase Overview](#codebase-overview)
- [File Tree](#file-tree)
- [Setup and Installation](#setup-and-installation)
- [Usage](#usage)
- [Operational Guides](#operational-guides)
- [FAQs](#faqs)
- [Architecture](#architecture)
- [Key Design Decisions](#key-design-decisions)
- [Known Issues](#known-issues)
- [Contribution Guidelines](#contribution-guidelines)

## Executive Summary
...

## Codebase Overview
...

## File Tree
```
project/
├── src/         # Core application logic
├── tests/       # Unit and integration tests
└── docs/        # Documentation files
```
...
```

---

This instruction ensures the AI delivers a high-quality, CTO-ready document based on your codebase. Provide the AI with this instruction and your codebase, and it will generate the `ai-cto-docs.md` file accordingly. Let me know if you need further refinements!