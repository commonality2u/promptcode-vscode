/** 
 * This function returns the HTML snippet for the "Merge" tab content.
 * You can tweak or reorganize the markup here if desired.
 */
export function getMergeTabHtml(): string {
  return /* html */ `
    <div class="card">
      <div class="instruction-header">
        <h3 class="instruction-title">Merge Model Output</h3>
        <p class="instruction-subtitle">Just paste the model response to see suggested changes</p>
      </div>
      <div class="card-content">
        <div class="prompt-actions">
          <button class="button primary" id="apply-merge-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 16l-4-4 4-4"></path>
              <path d="M8 12h12"></path>
              <path d="M8 20V4"></path>
            </svg>
            Apply & Review
          </button>
        </div>
        <div class="merge-content">
          <textarea id="merge-textarea" class="merge-textarea" placeholder="Paste the model response here..."></textarea>
        </div>
      </div>
    </div>
  `;
} 