// Process modal functionality for AI response handling
import { renderMarkdownToElement, clearElement, copyToClipboardWithFeedback, createBootstrapLoadingElement } from '../../utils/utils.js';

document.addEventListener('DOMContentLoaded', function() {
    const copyResponseBtn = document.getElementById('copyResponseBtn');
    const responseContent = document.getElementById('responseContent');

    // Copy response to clipboard using utility function
    if (copyResponseBtn) {
        copyResponseBtn.addEventListener('click', function() {
            const content = responseContent.textContent || responseContent.innerText;
            copyToClipboardWithFeedback(content, copyResponseBtn);
        });
    }
});

// Function to update response content (called from extension.js)
function updateResponseContent(content) {
    const responseContent = document.getElementById('responseContent');
    if (responseContent) {
        // Use utility function to render markdown content
        renderMarkdownToElement(content, responseContent);
    }
}

// Function to show loading state
function showLoadingState() {
    const responseContent = document.getElementById('responseContent');
    if (responseContent) {
        // Clear existing content and show loading using utility functions
        clearElement(responseContent);
        const loadingElement = createBootstrapLoadingElement('Thinking...');
        responseContent.appendChild(loadingElement);
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateResponseContent,
        showLoadingState
    };
}