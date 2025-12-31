# QuickLLM Firefox Extension

A Firefox extension (manifest v2) that integrates Large Language Models (LLMs) directly into your browser for seamless text processing and AI assistance. For some reason I failed to find anything even remotely similar in the Add-ons and I really needed a way to quickly feed web data to various models.

**NOTE: You need to have API access to the model you want, either directly from OpenAI, Anthropic, DeepSeek and others, or via custom routers like OpenRouter, Open WebUI, Ollama and so on.**


## Features

- Supports OpenAI, Anthropic, Ollama or compatible APIs
- Callable on any page by a shortcut `⌃⇧I` (or `⌘⇧I` on macOS)
- Allows to define multiple LLM profiles for specific tasks
- Allows you to feed to the LLM the entire page content or just the selected text
- QoL stuff like realtime streaming, markdown rendering, keyboard hotkeys, dark theme, profiles import/export, etc


## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd QuickLLM
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the extension:
   ```bash
   npm run build
   ```

4. Load the extension in Firefox:
   - Open Firefox and go to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on"
   - Select the `manifest.json` file from the project directory


## Usage

### Setting up Profiles

1. Click the QuickLLM extension icon in the toolbar.
2. Click "Add Profile" to create your first profile.
3. Pick "Advanced" mode if you need to define custom API endpoint or other advanced (duh) parameters.

### Processing Text

1. Select any text on a webpage (or don't select anything to send full page as a context).
2. Right-click and select "QuickLLM" or press `⌃⇧I` (`⌘⇧I` on macOS), the hotkey could be changed under "Manage Extension Shortcuts" in Firefox.
3. Select a profile if you have more than one.


## Contributing

1. Fork the repository
2. Create a branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request


## Support

For issues and feature requests, please create an issue.