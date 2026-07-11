// Content script entry point for QuickLLM extension.
//
// This file is intentionally minimal: it imports and instantiates the
// ModalController, which coordinates text extraction, the profile
// selector, the prompt modal, and stream rendering. The heavy logic
// lives in the focused modules under src/content/.

import { ModalController } from '../content/modal-controller.js';

// Initialize the content script modal controller.
const controller = new ModalController();
