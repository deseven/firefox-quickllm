// Process modal functionality for AI response handling
import markdownRenderer from '../../utils/markdown-renderer.js';

document.addEventListener('DOMContentLoaded', function() {
    const copyResponseBtn = document.getElementById('copyResponseBtn');
    const responseContent = document.getElementById('responseContent');

    // Copy response to clipboard
    if (copyResponseBtn) {
        copyResponseBtn.addEventListener('click', function() {
            const content = responseContent.textContent || responseContent.innerText;
            navigator.clipboard.writeText(content).then(() => {
                // Visual feedback for successful copy
                const originalText = copyResponseBtn.innerHTML;
                copyResponseBtn.innerHTML = 'Copied!';
                copyResponseBtn.classList.add('btn-success');
                copyResponseBtn.classList.remove('btn-primary');
                
                setTimeout(() => {
                    copyResponseBtn.innerHTML = originalText;
                    copyResponseBtn.classList.remove('btn-success');
                    copyResponseBtn.classList.add('btn-primary');
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });
    }
});

// Function to update response content (called from extension.js)
function updateResponseContent(content) {
    const responseContent = document.getElementById('responseContent');
    if (responseContent) {
        // Always render content as markdown
        const renderedContent = markdownRenderer.render(content);
        responseContent.innerHTML = renderedContent;
        responseContent.classList.add('markdown-content');
    }
}

// Function to show loading state
function showLoadingState() {
    const responseContent = document.getElementById('responseContent');
    if (responseContent) {
        responseContent.innerHTML = `
            <div class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Processing...</span>
                </div>
                <p class="text-muted mt-2">Thinking...</p>
            </div>
        `;
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateResponseContent,
        showLoadingState
    };
}