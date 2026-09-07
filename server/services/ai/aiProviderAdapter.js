/**
 * KiranaWala AI — Provider Adapter
 *
 * This module is the ONLY place in the codebase that imports and depends on
 * the Google Gemini SDK (@google/generative-ai).
 *
 * All other modules interact with the AI provider through this adapter,
 * making the provider entirely swappable without changes elsewhere.
 *
 * Interface exported:
 *   createConversation({ systemPrompt, tools, modelName, maxOutputTokens })
 *     → { send(messageOrParts) }
 *
 * The returned conversation object maintains internal chat state, so the
 * tool-calling loop in aiService.js can correctly alternate between:
 *   User text → Model → Function call → Function response → Model → Text
 *
 * Security:
 *  - API key is read exclusively from process.env.GEMINI_API_KEY
 *  - Key is never logged, returned in responses, or exposed to callers
 *  - This module is server-side ONLY; never bundle for the browser
 */

"use strict";

const {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} = require("@google/generative-ai");

// ---------------------------------------------------------------------------
// Safety Settings
// ---------------------------------------------------------------------------

/**
 * Conservative safety configuration for a commerce context.
 */
const SAFETY_SETTINGS = [
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
  },
];

// ---------------------------------------------------------------------------
// createConversation
// ---------------------------------------------------------------------------

/**
 * Creates a stateful Gemini chat conversation session.
 *
 * The returned object wraps a single Gemini `ChatSession`, allowing
 * aiService.js to send multiple turns (user text, then function responses)
 * without re-instantiating the model or losing history.
 *
 * @param {object}   params
 * @param {string}   params.systemPrompt       - KiranaWala system instruction
 * @param {Array}    [params.tools]            - Gemini function declarations
 * @param {string}   [params.modelName]        - Gemini model name
 * @param {number}   [params.maxOutputTokens]  - Max tokens in each response
 *
 * @returns {{ send: function(string|Array): Promise<GenerateContentResult> }}
 *
 * @throws {Error} with code AI_PROVIDER_NOT_CONFIGURED if key is absent
 */
function createConversation({
  systemPrompt,
  tools = [],
  modelName = "gemini-1.5-flash",
  maxOutputTokens = 1024,
}) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    const err = new Error(
      "AI service is not configured. GEMINI_API_KEY is missing.",
    );
    err.code = "AI_PROVIDER_NOT_CONFIGURED";
    throw err;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const modelConfig = {
    model: modelName,
    systemInstruction: systemPrompt,
    generationConfig: {
      maxOutputTokens,
      temperature: 0.4, // Lower temperature for factual, grounded responses
    },
    safetySettings: SAFETY_SETTINGS,
  };

  // Only attach tool declarations when tools are provided
  if (tools && tools.length > 0) {
    modelConfig.tools = [{ functionDeclarations: tools }];
    // AUTO mode: the model decides when to call tools vs. respond directly
    modelConfig.toolConfig = { functionCallingConfig: { mode: "AUTO" } };
  }

  const model = genAI.getGenerativeModel(modelConfig);

  // A single chat session that maintains history across all send() calls
  const chat = model.startChat();

  return {
    /**
     * Sends a user message or function response parts to the conversation.
     *
     * @param {string|Array} messageOrParts
     *   - String for user text messages
     *   - Array of { functionResponse: { name, response } } for tool results
     * @returns {Promise<import("@google/generative-ai").GenerateContentResult>}
     */
    async send(messageOrParts) {
      return chat.sendMessage(messageOrParts);
    },
  };
}

module.exports = { createConversation };
