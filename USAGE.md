# Setting up Profiles

Profiles define how QuickLLM connects to different AI services and what instructions to give them.

> **Important:** You need API access to the model you want to use, either directly from OpenAI, Anthropic, DeepSeek and others, or via custom routers like OpenRouter, Open WebUI, Ollama and so on.

# Using the Extension

## Creating Your First Profile

1. Click the QuickLLM extension icon in the toolbar
2. Click **"Create Your First Profile"**
3. Choose between **Basic** or **Advanced** mode:
   - **Basic:** Simple setup with default endpoints for common providers
   - **Advanced:** Custom API endpoints and extra options
4. Fill all required fields. For detailed guide see **"Profile Configuration"** section below.


## Activating QuickLLM

There are two ways to activate QuickLLM on any webpage:
1. **Keyboard shortcut:** Press `Alt+Shift+I` (`⌘⇧I` on macOS), the shortcut could be changed in Firefox by going to the "Manage Your Extensions" page, pressing on the gear icon and selecting "Manage Extension Shortcuts".
2. **Context menu:** Right-click and select "QuickLLM".
3. **Extension window:** Click on the extension icon in the browser toolbar.


## Text Processing

- **Selected text:** Select any text on the page before activating
- **Full page:** Don't select anything to send the entire page content


## Profile Selection

If you have multiple profiles, you can select them using:
- **Mouse:** Click on the desired profile
- **Arrow keys:** Navigate up/down and press Enter
- **Number keys:** Press 1-0 for quick selection

\* arrow and number keys don't work in the extension window


# Settings

Settings page (accessible by pressing on the gear in the top right of the main extension window) allows you to set a theme, add, edit, reorder, import or export the profiles.

## Profile Configuration

### Basic Settings
- **Name:** A descriptive name for your profile, I suggest calling the profile by the action it's going to perform, for example "Summarize" or "Translate"
- **Type:** Choose the type of API
- **API Key:** Your API key from the provider
- **Model:** Model name (e.g., gpt-5, claude-haiku-4-5)

### Advanced Settings
- **Custom Endpoint:** For custom API routers
- **Extra Options:** JSON format API parameters
- **User Prompt:** Additional prompt before content


## Prompts

The system prompt guides the AI's behavior. You can:
- Write your own custom prompt
- Use the ✨ template button to select from predefined templates
- Examples: "Summarize this text", "Translate to Spanish", "Review the following code"

The user prompt adds additional instructions. This is typically not needed, unless you want to have some quick prompt template that you can use immediately when calling profile or replace with something else (in case **Process immediately** is not enabled, see below).


## Processing Options

- **Process immediately:** Skip profile selection and process automatically, not asking for user prompt


# API Providers

## Anthropic

- **API Key:** Get from [Anthropic Console](https://console.anthropic.com/)
- **Model:** Pick from [Anthropic Docs](https://platform.claude.com/docs/en/about-claude/models/overview)


## DeepSeek

- **API Key:** Get from [DeepSeek Console](https://platform.deepseek.com/)
- **Model:** Pick from [DeepSeek Docs](https://api-docs.deepseek.com/quick_start/pricing)


## Ollama

- **Setup:** Install and run Ollama locally or elsewhere
- **API Key:** Whatever you set it to when configuring (could be empty)
- **Model:** Any model you have
- **Endpoint:** Whatever your endpoint is


## OpenAI

- **API Key:** Get from [OpenAI Platform](https://platform.openai.com/api-keys)
- **Model:** Pick from [OpenAI Docs](https://platform.openai.com/docs/models)


## OpenRouter

- **API Key:** Get from [OpenRouter](https://openrouter.ai/settings/keys)
- **Model:** Pick from [OpenRouter Models](https://openrouter.ai/models) (for example `z-ai/glm-4.7-flash`)


## Together.ai

- **API Key:** Get from [Together.ai](https://api.together.ai/)
- **Model:** Pick from [Together.ai Models](https://www.together.ai/pricing) (for example `moonshotai/Kimi-K2.5`)


## Custom Routers

For services like OpenRouter, Open WebUI, llama.cpp or other compatible APIs (most of them use OpenAI format):
- Use **Advanced mode** when creating profiles
- Set the **Custom Endpoint** to your service URL
- Use the appropriate API key (if your API requires it) and model names


# Troubleshooting

## Common Issues

### Extension doesn't activate
- Check if the keyboard shortcut conflicts with other extensions or browser shortcuts
- Try using the right-click context menu instead or calling from the extension window
- Ensure the extension is enabled in your browser

### API errors
- Read the error (duh)
- Verify your API key is correct and has sufficient credits
- Check if the model name is spelled correctly
- For custom endpoints, ensure the URL is accessible

### No response from AI
- Check your internet connection
- Verify the API service is not experiencing downtime
- Try a different model or profile

## Getting Help

If you're still experiencing issues:
- Check the [GitHub Issues](https://github.com/deseven/firefox-quickllm/issues) page
- Create a new issue with detailed information about your problem
- Include your browser version, extension version, and error messages