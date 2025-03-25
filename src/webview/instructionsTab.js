(function () {
  /**
   * Initializes all logic for the "Add Instructions" tab, including:
   *  - The instructions text area
   *  - Automatic saving of instructions
   *  - Handling the "updateInstructions" message
   *  - Prompt picker for inserting embedded instructions
   *
   * @param {any} vscode - VS Code API object
   */
  function initInstructionsTab(vscode) {
    // We rely on any global that sets up: window.samplePrompts = [...];
    // If you prefer to pass them in, you can do: initInstructionsTab(vscode, prompts).
    // For now, we read window.samplePrompts directly:

    let availablePrompts = window.samplePrompts || [];

    // ------------------------------------------------
    // 0) Setup the configuration section
    // ------------------------------------------------
    const configHeader = document.getElementById('prompts-config-section-header');
    const configContent = document.getElementById('prompts-config-content');
    const includeBuiltInTemplates = document.getElementById('include-built-in-templates');
    const promptFolders = document.getElementById('prompt-folders');
    const savePromptsConfigBtn = document.getElementById('save-prompts-config-btn');

    // Configuration toggle
    if (configHeader && configContent) {
      configContent.style.display = 'none';
      configHeader.addEventListener('click', function () {
        const configSection = document.getElementById('prompts-config-section');
        configSection.classList.toggle('collapsed');
        if (configSection.classList.contains('collapsed')) {
          configContent.style.display = 'none';
        } else {
          configContent.style.display = 'block';
        }
      });
    }

    // Include built-in templates checkbox
    if (includeBuiltInTemplates) {
      // Set it as checked by default
      includeBuiltInTemplates.classList.add('checked');
      
      includeBuiltInTemplates.addEventListener('click', function () {
        this.classList.toggle('checked');
      });
    }

    // Save configuration button
    if (promptFolders && savePromptsConfigBtn) {
      // Set default values
      promptFolders.value = `.promptcode/prompts\n.cursor/rules\n.github/copilot-instructions.md\n.zed/\n.windsurfrules\n.clinerules\n.ai-rules/\nai-docs/`;
      
      savePromptsConfigBtn.addEventListener('click', () => {
        vscode.postMessage({
          command: 'savePromptsConfig',
          promptFolders: promptFolders.value,
          includeBuiltInTemplates: includeBuiltInTemplates.classList.contains('checked')
        });
      });
      
      // Request current configuration
      vscode.postMessage({ command: 'loadPromptsConfig' });
    }

    // ------------------------------------------------
    // 1) Setup the instruction text area & saving
    // ------------------------------------------------
    const textarea = document.querySelector('.instruction-textarea');
    const editorContainer = document.querySelector('.editor-container');
    let contentEditableDiv = null;
    
    // Create a contentEditable div to replace the textarea for richer editing
    if (textarea && editorContainer) {
      // Create contentEditable div with same styling as textarea
      contentEditableDiv = document.createElement('div');
      contentEditableDiv.className = 'instruction-textarea';
      contentEditableDiv.contentEditable = 'true';
      contentEditableDiv.spellcheck = false;
      
      // Create a hidden textarea to store raw text content
      const hiddenTextarea = document.createElement('textarea');
      hiddenTextarea.style.display = 'none';
      hiddenTextarea.id = 'raw-instruction-content';
      editorContainer.appendChild(hiddenTextarea);
      
      // Set CSS to preserve whitespace and line breaks
      contentEditableDiv.style.whiteSpace = 'pre-wrap';
      
      // Set placeholder text
      contentEditableDiv.setAttribute('data-placeholder', 'Write your instructions here... use @ to embed built-in and custom templates');
      
      // Transfer any existing value from textarea
      if (textarea.value) {
        contentEditableDiv.textContent = textarea.value;
      }
      
      // Replace textarea with contentEditable div
      editorContainer.replaceChild(contentEditableDiv, textarea);
      
      // Add input event listener for saving
      contentEditableDiv.addEventListener('input', debounce(() => {
        // Check if content is actually empty (just BR tags or whitespace)
        const contentIsEmpty = isContentEmpty(contentEditableDiv);
        
        // If it's empty, properly empty it to trigger the CSS placeholder
        if (contentIsEmpty) {
          contentEditableDiv.innerHTML = '';
        }
        
        saveInstructionContent();
        
        // Store the full HTML content instead of just text
        const hiddenTextarea = document.getElementById('raw-instruction-content');
        if (hiddenTextarea) {
          hiddenTextarea.value = contentEditableDiv.innerHTML;
        }
      }, 500));
      
      // Add input interceptor to handle HTML special characters
      contentEditableDiv.addEventListener('input', (e) => {
        // Get current content
        const content = contentEditableDiv.innerHTML;
        
        // Check if the content contains unescaped angle brackets
        // Create proper regex to match both opening and closing tags
        if (content.match(/<[^>]*>/)) {
          // Save current selection
          const selection = window.getSelection();
          const range = selection.getRangeCount() > 0 ? selection.getRangeAt(0).cloneRange() : null;
          
          // Process content to escape all angle brackets that aren't part of valid HTML
          let processedContent = content;
          
          // Create a temporary DOM element to safely parse the HTML
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = content;
          
          // Get the text content and convert it back to HTML with escaped brackets
          const plainText = tempDiv.textContent;
          const safeHtml = plainText
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\n/g, '<br>');
          
          // Only update if changes were made
          if (safeHtml !== content) {
            // Update content
            contentEditableDiv.innerHTML = safeHtml;
            
            // Restore selection if possible
            if (range) {
              // Try to restore selection approximately
              try {
                selection.removeAllRanges();
                selection.addRange(range);
              } catch (err) {
                console.error('Failed to restore selection:', err);
              }
            }
            
            // Save the updated content
            saveInstructionContent();
          }
        }
      });
      
      // Modify the paste event handler to handle content with angle brackets
      contentEditableDiv.addEventListener('paste', (e) => {
        e.preventDefault();
        
        // Get pasted text from clipboard
        const clipboardData = e.clipboardData || window.clipboardData;
        let pastedText = clipboardData.getData('text/plain');
        
        // Escape angle brackets in pasted text
        pastedText = pastedText
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        
        // Insert the escaped text
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          range.deleteContents();
          
          // Create a temporary div to convert to HTML nodes
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = pastedText;
          
          // Get all nodes from the div to insert
          const fragment = document.createDocumentFragment();
          while (tempDiv.firstChild) {
            fragment.appendChild(tempDiv.firstChild);
          }
          
          range.insertNode(fragment);
          
          // Move cursor to the end of pasted text
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
          
          // Save the content
          saveInstructionContent();
        }
      });
      
      // Add keydown event handler for special keys
      contentEditableDiv.addEventListener('keydown', (e) => {
        // Handle special keys like Backspace for template tags
        if (e.key === 'Backspace') {
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            if (range.collapsed) {
              // If cursor is right after a template tag, delete the whole tag
              const previousSibling = range.startContainer.previousSibling;
              if (previousSibling && previousSibling.nodeType === Node.ELEMENT_NODE && 
                  previousSibling.classList.contains('template-tag')) {
                e.preventDefault();
                previousSibling.remove();
                saveInstructionContent();
              }
            }
          }
        }
        // Handle Enter key to ensure consistent line break behavior
        else if (e.key === 'Enter') {
          e.preventDefault();
          
          // Insert a proper BR element
          const selection = window.getSelection();
          if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            
            // Insert a single BR element first
            const br1 = document.createElement('br');
            range.insertNode(br1);
            
            // Move selection after the first BR
            range.setStartAfter(br1);
            range.setEndAfter(br1);
            
            // Insert a second BR element
            const br2 = document.createElement('br');
            range.insertNode(br2);
            
            // Move cursor after the first BR but before the second BR
            // This places cursor at the beginning of the new line
            range.setStartAfter(br1);
            range.setEndAfter(br1);
            range.collapse(true);
            
            // Update selection
            selection.removeAllRanges();
            selection.addRange(range);
            
            saveInstructionContent();
          }
        }
      });
    }

    /**
     * Sends the updated instruction text to the extension for saving
     */
    function saveInstructionContent() {
      if (contentEditableDiv) {
        // Get the HTML content and normalize line breaks
        const htmlContent = contentEditableDiv.innerHTML
          // Replace consecutive BR tags with a single one
          .replace(/<br\s*\/?><br\s*\/?>/gi, '<br>')
          // Ensure consistent BR tag format
          .replace(/<br\s*\/?>/gi, '<br>');
          
        const processedContent = processContentForSaving(htmlContent);
        
        vscode.postMessage({
          command: 'saveInstructions',
          instructions: processedContent
        });
      }
    }
    
    /**
     * Process the HTML content to convert template tags to the embedded instruction format
     * when saving to the extension
     */
    function processContentForSaving(htmlContent) {
      // Create a temporary div to parse the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlContent;
      
      // Convert BR elements to newlines for proper text processing
      const brs = tempDiv.querySelectorAll('br');
      brs.forEach(br => {
        br.replaceWith(document.createTextNode('\n'));
      });
      
      // Find all template tags and convert them to embedded instruction format
      const templateTags = tempDiv.querySelectorAll('.template-tag');
      templateTags.forEach(tag => {
        const promptName = tag.getAttribute('data-prompt-name');
        if (promptName) {
          const prompt = availablePrompts.find(p => p.name === promptName);
          if (prompt) {
            // Create embedded instruction text preserving exact whitespace
            const embeddedText = `<embedded-instruction name="${promptName}">\n${prompt.content}\n</embedded-instruction>`;
            const embeddedInstruction = document.createTextNode(embeddedText);
            tag.replaceWith(embeddedInstruction);
          }
        }
      });
      
      // Get the content with templates processed - don't replace with placeholders anymore
      // since we're handling it with HTML entities at the input level
      let processedContent = tempDiv.textContent;
      
      return processedContent;
    }
    
    /**
     * Process content from extension to display template tags
     */
    function processContentForDisplay(textContent) {
      // No need to replace placeholders back to angle brackets
      // since we're now using HTML entities
      
      // Find all embedded instructions using regex
      const regex = /<embedded-instruction name="([^"]+)">([\s\S]*?)<\/embedded-instruction>/g;
      let match;
      let lastIndex = 0;
      let result = '';
      
      while ((match = regex.exec(textContent)) !== null) {
        // Get the text before the match, preserving exact whitespace
        const beforeText = textContent.substring(lastIndex, match.index);
        // Convert newlines to <br> tags
        result += beforeText.replace(/\n/g, '<br>');
        
        // Add the template tag
        const promptName = match[1];
        
        // Try to find the prompt in the available prompts to get its file path
        let filePathAttr = '';
        const prompt = availablePrompts.find(p => p.name === promptName);
        if (prompt && prompt.filePath) {
          filePathAttr = ` data-file-path="${prompt.filePath}"`;
        }
        
        result += `<span class="template-tag" data-prompt-name="${promptName}"${filePathAttr} contenteditable="false">@${promptName}</span>`;
        
        lastIndex = regex.lastIndex;
      }
      
      // Add any remaining text
      const remainingText = textContent.substring(lastIndex);
      result += remainingText.replace(/\n/g, '<br>');
      
      return result;
    }

    // ------------------------------------------------
    // 2) Listen for "updateInstructions" from extension
    //    and apply to the instruction text area
    // ------------------------------------------------
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (!message || !message.command) return;

      switch (message.command) {
        case 'updateInstructions':
          if (contentEditableDiv) {
            // Check if we have content in the hidden textarea first
            const hiddenTextarea = document.getElementById('raw-instruction-content');
            if (hiddenTextarea && hiddenTextarea.value) {
              // Use innerHTML instead of textContent to preserve formatting and template tags
              contentEditableDiv.innerHTML = hiddenTextarea.value;
            } else if (message.instructions) {
              // Process the instructions to display template tags
              const processedInstructions = processContentForDisplay(message.instructions);
              contentEditableDiv.innerHTML = processedInstructions;
            } else {
              contentEditableDiv.innerHTML = '';
            }
            
            // Add click handlers to template tags
            setupTemplateTagClickHandlers();
          }
          break;

        case 'loadPromptsConfig':
          if (includeBuiltInTemplates) {
            if (message.includeBuiltInTemplates) {
              includeBuiltInTemplates.classList.add('checked');
            } else {
              includeBuiltInTemplates.classList.remove('checked');
            }
          }
          
          if (promptFolders && message.promptFolders) {
            promptFolders.value = message.promptFolders;
          }
          break;

        default:
          // Ignore
          break;
      }
    });
    
    /**
     * Setup click handlers for template tags
     */
    function setupTemplateTagClickHandlers() {
      const templateTags = document.querySelectorAll('.template-tag');
      templateTags.forEach(tag => {
        tag.addEventListener('click', (e) => {
          // Prevent editor from getting focus
          e.preventDefault();
          e.stopPropagation();
          
          const promptName = tag.getAttribute('data-prompt-name');
          const filePath = tag.getAttribute('data-file-path');
          if (promptName) {
            // Send message to VSCode to open the prompt file
            vscode.postMessage({
              command: 'openPromptFile',
              promptName: promptName,
              filePath: filePath
            });
          }
        });
      });
    }

    // ------------------------------------------------
    // 3) Prompt Picker for embedding prompt templates
    // ------------------------------------------------
    setupPromptPicker();

    function setupPromptPicker() {
      const promptPicker = document.getElementById('prompt-picker');
      const promptList = document.querySelector('.prompt-list');
      if (!contentEditableDiv || !promptPicker || !promptList) return;

      let currentPosition = null;
      let currentRange = null;

      // Populate the prompt list with built-in + user prompts:
      populatePromptList();

      function populatePromptList() {
        // Group prompts by category
        const categorizedPrompts = {};
        const uncategorizedPrompts = [];

        // Split prompts into categorized and uncategorized
        availablePrompts.forEach(prompt => {
          if (prompt.category) {
            if (!categorizedPrompts[prompt.category]) {
              categorizedPrompts[prompt.category] = [];
            }
            categorizedPrompts[prompt.category].push(prompt);
          } else {
            uncategorizedPrompts.push(prompt);
          }
        });

        // Generate HTML for prompt list with categories and uncategorized items
        let promptListHtml = '';

        // First add uncategorized prompts at the root level
        uncategorizedPrompts.forEach(prompt => {
          promptListHtml += `
            <div class="prompt-item" data-prompt-name="${prompt.name}">
              <div>
                <div class="prompt-name">${prompt.name}</div>
                <div class="prompt-description">${prompt.description}</div>
              </div>
            </div>
          `;
        });

        // Then add the categories
        Object.keys(categorizedPrompts).sort().forEach(category => {
          promptListHtml += `
            <div class="prompt-category" data-category="${category}">
              <span class="prompt-category-icon"></span>
              <div class="prompt-category-name">${category}</div>
            </div>
            <div class="prompt-category-items" data-category="${category}">
              ${categorizedPrompts[category].map(prompt => `
                <div class="prompt-item" data-prompt-name="${prompt.name}">
                  <div>
                    <div class="prompt-name">${prompt.name}</div>
                    <div class="prompt-description">${prompt.description}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        });

        promptList.innerHTML = promptListHtml;

        // Add click handlers for categories
        document.querySelectorAll('.prompt-category').forEach(categoryEl => {
          categoryEl.addEventListener('click', () => {
            const category = categoryEl.getAttribute('data-category');
            categoryEl.classList.toggle('open');
            
            // Find and toggle display of category items
            const categoryItems = document.querySelector(`.prompt-category-items[data-category="${category}"]`);
            if (categoryItems) {
              if (categoryEl.classList.contains('open')) {
                categoryItems.style.display = 'block';
              } else {
                categoryItems.style.display = 'none';
              }
            }
          });
        });
      }

      // On receiving updated prompts from extension:
      window.addEventListener('message', (event) => {
        const message = event.data;
        if (!message || message.command !== 'updatePrompts') return;
        console.log('Received updated prompts:', message.prompts.length);
        availablePrompts = message.prompts;
        // Refresh prompt list if the picker is open:
        if (promptPicker.style.display === 'block') {
          populatePromptList();
          filterPromptList('');
        }
      });

      function filterPromptList(searchLower) {
        let visibleCategories = new Set();
        let hasVisibleItems = false;

        // First hide all items that don't match
        const allItems = promptList.querySelectorAll('.prompt-item');
        allItems.forEach((item) => {
          const promptName = item.dataset.promptName.toLowerCase();
          const promptDesc = item.querySelector('.prompt-description')?.textContent.toLowerCase() || '';
          const isVisible = !searchLower || 
            promptName.includes(searchLower) || 
            promptDesc.includes(searchLower);

          item.style.display = isVisible ? 'flex' : 'none';
          
          if (isVisible) {
            hasVisibleItems = true;
            // Find parent category if it exists
            const categoryItems = item.closest('.prompt-category-items');
            if (categoryItems) {
              const categoryName = categoryItems.getAttribute('data-category');
              visibleCategories.add(categoryName);
            }
          }
        });

        // Now show/hide categories based on whether they have visible items
        const categories = promptList.querySelectorAll('.prompt-category');
        categories.forEach((category) => {
          const categoryName = category.getAttribute('data-category');
          const hasVisibleChildren = visibleCategories.has(categoryName);
          
          category.style.display = hasVisibleChildren ? 'flex' : 'none';
          
          // Open categories with visible children when searching
          if (searchLower && hasVisibleChildren) {
            category.classList.add('open');
            const categoryItems = document.querySelector(`.prompt-category-items[data-category="${categoryName}"]`);
            if (categoryItems) {
              categoryItems.style.display = 'block';
            }
          }
        });

        // Select the first visible item for keyboard navigation
        const visibleItems = Array.from(promptList.querySelectorAll('.prompt-item')).filter(
          (item) => item.style.display !== 'none'
        );

        if (visibleItems.length > 0) {
          allItems.forEach((item) => item.classList.remove('selected'));
          visibleItems[0].classList.add('selected');
        }
      }

      // Show/hide + arrow key handling:
      contentEditableDiv.addEventListener('input', (e) => {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (!range.collapsed) return;
        
        const node = range.startContainer;
        const offset = range.startOffset;
        
        // Check if we're in a text node and the previous character is '@'
        if (node.nodeType === Node.TEXT_NODE && offset > 0 && node.nodeValue[offset - 1] === '@') {
          currentPosition = offset;
          currentRange = range.cloneRange();
          vscode.postMessage({ 
            command: 'requestPrompts',
            includeBuiltInTemplates: includeBuiltInTemplates?.classList.contains('checked') ?? true,
            promptFolders: promptFolders?.value ?? ''
          });

          // Position the picker near the caret
          const rect = range.getBoundingClientRect();
          const editorRect = contentEditableDiv.getBoundingClientRect();
          
          // Set position ensuring it doesn't overflow right edge
          promptPicker.style.top = `${rect.bottom + 5}px`;
          
          // Calculate left position, ensuring it stays within the editor bounds
          let leftPos = rect.left;
          const pickerWidth = 300; // Match the CSS width
          
          // Prevent overflow to the right
          if (leftPos + pickerWidth > editorRect.right) {
            leftPos = Math.max(editorRect.left, editorRect.right - pickerWidth);
          }
          
          promptPicker.style.left = `${leftPos}px`;
          promptPicker.style.display = 'block';

          // Reset the list:
          filterPromptList('');
          return;
        }

        // If we are currently showing the picker and we advanced the caret:
        if (currentPosition && node.nodeType === Node.TEXT_NODE && offset > currentPosition) {
          const filterText = node.nodeValue.substring(currentPosition, offset).toLowerCase();
          filterPromptList(filterText);
        }

        // If the user erased the "@" or moved elsewhere
        if (currentPosition && (node.nodeType !== Node.TEXT_NODE || 
            offset <= currentPosition - 1 || 
            (node.nodeType === Node.TEXT_NODE && offset > 0 && node.nodeValue[currentPosition - 1] !== '@'))) {
          promptPicker.style.display = 'none';
          currentPosition = null;
          currentRange = null;
        }
      });

      promptList.addEventListener('click', (e) => {
        const promptItem = e.target.closest('.prompt-item');
        if (!promptItem) return;
        insertPrompt(promptItem.dataset.promptName);
      });

      contentEditableDiv.addEventListener('keydown', (e) => {
        if (promptPicker.style.display !== 'block') return;
        
        // Find all visible prompt items
        const items = Array.from(promptList.querySelectorAll('.prompt-item'))
          .filter(item => item.style.display !== 'none');
        
        if (!items.length) return;

        let selectedIndex = items.findIndex((i) => i.classList.contains('selected'));

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          items.forEach((item) => item.classList.remove('selected'));
          
          if (e.key === 'ArrowDown') {
            selectedIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
          } else {
            selectedIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
          }
          
          items[selectedIndex].classList.add('selected');
          items[selectedIndex].scrollIntoView({ block: 'nearest' });
        }
        
        if (e.key === 'Enter' && selectedIndex >= 0) {
          e.preventDefault();
          insertPrompt(items[selectedIndex].dataset.promptName);
        }
        
        if (e.key === 'Escape') {
          promptPicker.style.display = 'none';
          currentPosition = null;
          currentRange = null;
        }
      });

      document.addEventListener('click', (e) => {
        if (!promptPicker.contains(e.target) && e.target !== contentEditableDiv) {
          promptPicker.style.display = 'none';
          currentPosition = null;
          currentRange = null;
        }
      });

      /**
       * Insert prompt template tag at the current cursor position
       */
      function insertPrompt(promptName) {
        const selectedPrompt = availablePrompts.find((p) => p.name === promptName);
        if (!selectedPrompt || !currentRange) return;

        // Create the template tag element
        const templateTag = document.createElement('span');
        templateTag.className = 'template-tag';
        templateTag.setAttribute('data-prompt-name', promptName);
        // Store the file path if available
        if (selectedPrompt.filePath) {
          templateTag.setAttribute('data-file-path', selectedPrompt.filePath);
        }
        templateTag.setAttribute('contenteditable', 'false');
        templateTag.textContent = `@${promptName}`;
        
        // Add click handler to the template tag
        templateTag.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          vscode.postMessage({
            command: 'openPromptFile',
            promptName: promptName,
            filePath: selectedPrompt.filePath
          });
        });
        
        // Set up selection to replace the "@" and any text after it
        const selection = window.getSelection();
        const range = currentRange.cloneRange();
        
        // Move range start to before the "@" character
        range.setStart(range.startContainer, currentPosition - 1);
        
        // If there's text following the "@" for filtering, include it in the replacement
        if (range.startContainer.nodeType === Node.TEXT_NODE && 
            currentPosition < range.startContainer.nodeValue.length) {
          const searchEnd = range.startContainer.nodeValue.indexOf(' ', currentPosition);
          const endPos = searchEnd === -1 ? range.startContainer.nodeValue.length : searchEnd;
          range.setEnd(range.startContainer, endPos);
        }
        
        // Delete the current "@" and any filter text
        range.deleteContents();
        
        // Insert the template tag without adding any extra whitespace
        range.insertNode(templateTag);
        
        // Move cursor after the template tag
        range.setStartAfter(templateTag);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Hide the prompt picker
        promptPicker.style.display = 'none';
        currentPosition = null;
        currentRange = null;
        
        // Focus the editor
        contentEditableDiv.focus();
        
        // Save the updated content
        saveInstructionContent();
      }
    }

    function debounce(fn, wait) {
      let timeout;
      return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => fn.apply(context, args), wait);
      };
    }
    
    /**
     * Helper function to insert text at the current cursor position
     */
    function insertTextAtCursor(text) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        
        // Move cursor to the end of inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Trigger a DOM change to ensure content is updated
        const inputEvent = new Event('input', {
          bubbles: true,
          cancelable: true,
        });
        contentEditableDiv.dispatchEvent(inputEvent);
      }
    }

    /**
     * Checks if the editor content is effectively empty (only whitespace or BR tags)
     */
    function isContentEmpty(element) {
      // Get content with all tags removed
      const textContent = element.textContent.trim();
      
      // Check if there's just a BR tag or empty
      const onlyBrTags = element.innerHTML.trim() === '<br>' || element.innerHTML.trim() === '';
      
      return textContent === '' || onlyBrTags;
    }
  }

  /* Export the initialization function to the global scope so it can be called from the HTML */
  window.initInstructionsTab = initInstructionsTab;
})(); 