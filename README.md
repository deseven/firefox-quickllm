# QuickLLM Firefox Extension

A Firefox extension (manifest v2) that integrates Large Language Models (LLMs) directly into your browser for seamless text processing and AI assistance. For some reason I failed to find anything even remotely similar in the Add-ons and I really needed a way to quickly feed web data to various models.

The extension could be seen in action in [the demo video](https://d7.wtf/s/quickllm-demo.mp4).

> [!IMPORTANT]
> You need to have API access to the model you want, either directly from OpenAI, Anthropic, DeepSeek and others, or via custom routers like OpenRouter, Open WebUI, Ollama and so on.


## Features

- Supports OpenAI, Anthropic, Ollama or compatible APIs
- Callable on any page by a shortcut `Alt-Shift-I` (or `⌘⇧I` on macOS)
- Allows to define multiple LLM profiles for specific tasks
- Allows you to feed to the LLM the entire page content or just the selected text
- QoL stuff like realtime streaming, markdown rendering, keyboard hotkeys, dark theme, profiles import/export, etc


## Browser Support

**Only Firefox is officially supported at the moment.** Basic compatibility with Chrome was implemented too and I've tested the extension in Brave, but your mileage may vary.


## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/deseven/firefox-quickllm.git
   cd firefox-quickllm
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

See [USAGE.md](https://github.com/deseven/firefox-quickllm/blob/main/USAGE.md), the version-specific usage guide is always included with the packaged extension and accessible by pressing the question sign in the main extension window.


## Contributing

Contributions are welcome! Feel free to submit a pull request.

1. Fork the repository
2. Create a branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request


## Support

For issues and feature requests, please [create an issue](https://github.com/deseven/firefox-quickllm/issues/new).