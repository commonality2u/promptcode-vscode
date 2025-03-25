/** 
 * This function returns the HTML snippet for the "Instructions" tab content.
 * You can tweak or reorganize the markup here if desired.
 */
export function getInstructionsTabHtml(): string {
  return /* html */ `
    <!-- Configuration Section -->
    <section class="configuration-section collapsed" id="prompts-config-section">
      <div class="section-header" id="prompts-config-section-header">
        <div class="section-title">Configuration</div>
        <span class="codicon codicon-chevron-right toggle-icon"></span>
      </div>
      <div class="configuration-content" id="prompts-config-content">
        <div class="checkbox-container">
          <div class="custom-checkbox" id="include-built-in-templates">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <label>Include built-in templates</label>
        </div>
        <div class="prompt-folders-container">
          <label for="prompt-folders" class="text-sm text-muted">Prompt folder paths (one per line)</label>
          <textarea id="prompt-folders" class="ignore-textarea" placeholder=".promptcode/prompts&#10;.cursor/rules&#10;.github/copilot-instructions.md&#10;.zed/&#10;.windsurfrules&#10;.clinerules&#10;.ai-rules/&#10;ai-docs/"></textarea>
        </div>
        <button id="save-prompts-config-btn" class="button">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          Save Configuration
        </button>
      </div>
    </section>

    <div class="card">
      <div class="instruction-header">
        <h3 class="instruction-title">Instruction Builder</h3>
        <p class="instruction-subtitle">Create instructions for the AI to understand your code context and goal. Type '@' to embed prompts from both the extension's built-in collection and your custom prompts (located in .promptcode/prompts). These templates can help structure your instructions for specific tasks.</p>
      </div>
      <div class="card-content">
        <div class="tabs">
          <div class="instruction-tabs"></div>
          <div class="editor-container">
            <div class="editor-toolbar">
              <span class="editor-toolbar-text">Type '@' to access templates</span>
            </div>
            <textarea placeholder="Write your instructions here... use @ to embed built-in and custom templates" class="instruction-textarea" autofocus></textarea>
          </div>
          <div id="prompt-picker" class="prompt-picker" style="display: none;">
            <div class="prompt-list"></div>
          </div>
        </div>
      </div>
    </div>
  `;
} 