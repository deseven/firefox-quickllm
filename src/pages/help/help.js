// Help page for QuickLLM extension
import './help.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import markdownRenderer from '../../utils/markdown-renderer.js';
import { applyTheme } from '../../utils/utils.js';

class HelpPage {
    constructor() {
        this.init();
    }

    async init() {
        applyTheme();
        this.renderContent();
        this.displayVersion();
    }

    renderContent() {
        const helpContent = document.getElementById('helpContent');
        const usageGuide = process.env.USAGE_GUIDE;
        
        if (usageGuide && helpContent) {
            helpContent.innerHTML = markdownRenderer.render(usageGuide);
        }
    }

    displayVersion() {
        const versionElement = document.getElementById('version');
        const version = process.env.EXTENSION_VERSION;
        
        if (versionElement && version) {
            versionElement.textContent = version;
        }
    }
}

// Initialize help page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HelpPage();
});