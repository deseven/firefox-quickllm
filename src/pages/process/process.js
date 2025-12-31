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
                const originalText = copyResponseBtn.textContent;
                copyResponseBtn.textContent = 'Copied!';
                copyResponseBtn.classList.add('btn-success');
                copyResponseBtn.classList.remove('btn-primary');
                
                setTimeout(() => {
                    copyResponseBtn.textContent = originalText;
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
        // Clear existing content
        while (responseContent.firstChild) {
            responseContent.removeChild(responseContent.firstChild);
        }
        
        // Always render content as markdown
        const renderedContent = markdownRenderer.render(content);
        const parser = new DOMParser();
        const doc = parser.parseFromString(renderedContent, 'text/html');
        
        // Move all children from parsed document to target element
        const bodyChildren = Array.from(doc.body.childNodes);
        bodyChildren.forEach(child => {
            responseContent.appendChild(child);
        });
        
        responseContent.classList.add('markdown-content');
    }
}

// Function to show loading state
function showLoadingState() {
    const responseContent = document.getElementById('responseContent');
    if (responseContent) {
        // Clear existing content using DOM APIs
        while (responseContent.firstChild) {
            responseContent.removeChild(responseContent.firstChild);
        }
        
        // Create loading state using DOM APIs
        const containerDiv = document.createElement('div');
        containerDiv.className = 'text-center py-4';
        
        const spinnerDiv = document.createElement('div');
        spinnerDiv.className = 'spinner-border text-primary';
        spinnerDiv.setAttribute('role', 'status');
        
        const hiddenSpan = document.createElement('span');
        hiddenSpan.className = 'visually-hidden';
        hiddenSpan.textContent = 'Processing...';
        
        const thinkingP = document.createElement('p');
        thinkingP.className = 'text-muted mt-2';
        thinkingP.textContent = 'Thinking...';
        
        spinnerDiv.appendChild(hiddenSpan);
        containerDiv.appendChild(spinnerDiv);
        containerDiv.appendChild(thinkingP);
        responseContent.appendChild(containerDiv);
    }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        updateResponseContent,
        showLoadingState
    };
}