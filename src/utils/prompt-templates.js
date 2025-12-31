// Prompt templates configuration
// This file contains predefined prompt templates that users can quickly select

const genericSuffix = " Follow additional user instructions if there are any. Last user message is always the content to process.";

export const PROMPT_TEMPLATES = [
    {
        name: "Generic",
        prompt: "You are a helpful AI assistant. Please process the content following user requests."
    },
    {
        name: "Summarize",
        prompt: "Summarize the following text, return only the text summary." + genericSuffix
    },
    {
        name: "Improve",
        prompt: "Improve the following text, return only the improved text." + genericSuffix
    },
    {
        name: "Spellcheck",
        prompt: "Do a spellcheck on the following text, return only the fixed text." + genericSuffix
    },
    {
        name: "Format",
        prompt: "Format the following text using markdown, return only the text in markdown format." + genericSuffix
    },
    {
        name: "Translate",
        prompt: "Translate the following text to %INPUT_DESIRED_LANGUAGE_HERE%, return only the translated text." + genericSuffix
    },
    {
        name: "Analyze",
        prompt: "Analyze the following text, give your opinion on it." + genericSuffix
    }
];