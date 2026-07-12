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
        prompt: "Summarize the following text. Reply only with the text summary with no extra comments." + genericSuffix
    },
    {
        name: "Improve",
        prompt: "Improve the following text. Reply only with the improved text with no extra comments." + genericSuffix
    },
    {
        name: "Spellcheck",
        prompt: "Correct any spelling or grammar mistakes in the following text. Reply only with the corrected text with no extra comments. If there are no mistakes, return the same exact text." + genericSuffix
    },
    {
        name: "Format",
        prompt: "Format the following text using Markdown. Reply only with the Markdown text with no extra comments." + genericSuffix
    },
    {
        name: "Translate",
        prompt: "Translate the following text to %INPUT_DESIRED_LANGUAGE_HERE%. Reply only with the translated text with no extra comments." + genericSuffix
    },
    {
        name: "Analyze",
        prompt: "Analyze the following text, give your opinion on it." + genericSuffix
    }
];