/**
 * MiniMax AI Service
 * Free-tier integration using MiniMax Chat Completions API
 *
 * API contract: OpenAI-compatible.
 *   - Base URL: https://api.minimax.io
 *   - Chat completions: POST /v1/chat/completions
 *   - Models list:      GET /v1/models  (used for availability probe)
 *   - Auth:             Authorization: Bearer <API_KEY>
 *   - Docs: https://platform.minimax.io/docs/api-reference/text-chat-openai
 *
 * All public functions THROW on failure so the orchestrator
 * (`services/ai.ts`) can advance to the next provider in the chain.
 */

const MINIMAX_BASE_URL = 'https://api.minimax.io/v1/chat/completions';
const MINIMAX_MODELS_URL = 'https://api.minimax.io/v1/models';
const MINIMAX_MODEL = 'MiniMax-M2.7-highspeed';
const apiKey = import.meta.env.VITE_MINIMAX_API_KEY;

/**
 * Check if MiniMax API key is configured.
 * The literal string `MINIMAX_REPLACE_ME_BEFORE_DEPLOY` is treated as
 * "not configured" so a placeholder never silently passes the gate.
 */
const isMinimaxConfigured = (): boolean => {
  if (!apiKey) return false;
  const trimmed = String(apiKey).trim();
  if (trimmed.length === 0) return false;
  if (trimmed.startsWith('MINIMAX_REPLACE_ME')) return false;
  return true;
};

/**
 * Make a request to the MiniMax Chat Completions endpoint.
 */
const MiniMaxRequest = async (messages: Array<{role: string, content: string}>): Promise<string> => {
  if (!isMinimaxConfigured()) {
    throw new Error('MiniMax API key is missing. Please configure VITE_MINIMAX_API_KEY in .env');
  }

  try {
    const response = await fetch(MINIMAX_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MINIMAX_MODEL,
        messages: messages,
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('MiniMax API key is invalid. Check VITE_MINIMAX_API_KEY.');
      }
      if (response.status === 429) {
        throw new Error('MiniMax API rate limit exceeded. Please try again later.');
      }
      throw new Error(`MiniMax API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.error('MiniMax request error:', error);
    throw error;
  }
};

/**
 * Translates a search query from Russian (or any language) to English for PubMed.
 */
export const translateQueryToEnglish = async (query: string): Promise<string> => {
  if (!isMinimaxConfigured()) {
    throw new Error('MiniMax API key is missing');
  }

  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful assistant that translates medical search queries to English for PubMed database searches. Return ONLY the English translation, no other text or explanation.'
      },
      {
        role: 'user',
        content: `Translate the following medical search query into English for a PubMed database search. If the query is already in English, return it exactly as is. Return ONLY the English translation, no other text or explanation.\n\nQuery: "${query}"`
      }
    ];

    const response = await MiniMaxRequest(messages);
    return response.trim() || query;
  } catch (error) {
    console.error("MiniMax query translation error:", error);
    throw error; // Re-throw to trigger fallback
  }
};

/**
 * Translates a list of titles to Russian using MiniMax.
 */
export const translateTitlesToRussian = async (titles: string[]): Promise<string[]> => {
  if (!isMinimaxConfigured() || titles.length === 0) {
    throw new Error('MiniMax API key is missing');
  }

  try {
    const translatedTitles: string[] = [];

    for (const title of titles) {
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful assistant that translates medical article titles from English to Russian. Return ONLY the Russian translation, no other text.'
        },
        {
          role: 'user',
          content: `Translate this medical article title from English to Russian. Return ONLY the translation:\n\n${title}`
        }
      ];

      const response = await MiniMaxRequest(messages);
      translatedTitles.push(response.trim() || title);
    }

    return translatedTitles;
  } catch (error) {
    console.error("MiniMax title translation error:", error);
    throw error; // Re-throw to trigger fallback
  }
};

/**
 * Summarizes a medical abstract for a layperson in Russian.
 */
export const summarizeArticleForLayperson = async (title: string, abstract: string): Promise<string> => {
  if (!isMinimaxConfigured()) {
    throw new Error('MiniMax API key is missing');
  }

  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful medical assistant. Your task is to explain medical scientific articles to simple people (non-medical experts) in Russian. Use simple, clear language. Focus on the main conclusion. Be concise but informative.'
      },
      {
        role: 'user',
        content: `You are a helpful medical assistant. Your task is to explain the following medical scientific article to a simple person (non-medical expert) in Russian.

Rules:
1. **Output Language**: Russian (Русский).
2. Use simple, clear language. Avoid complex terminology where possible, or explain it.
3. Focus on the main conclusion: What did they find? Why is it important?
4. Structure the response with clear paragraphs or bullet points.
5. Be concise but informative.
6. Do not make up facts. Stick to the abstract provided.

Article Title: ${title}
Abstract: ${abstract}`
      }
    ];

    const response = await MiniMaxRequest(messages);
    return response || "Не удалось создать краткое содержание.";
  } catch (error) {
    console.error("MiniMax summarization error:", error);
    throw error; // Re-throw to trigger fallback
  }
};

/**
 * Optimizes a long query into concise PubMed-compatible search terms using MiniMax.
 */
export const optimizeQueryForPubMed = async (longQuery: string): Promise<string> => {
  if (!isMinimaxConfigured()) {
    throw new Error('MiniMax API key is missing');
  }

  try {
    const messages = [
      {
        role: 'system',
        content: 'You are a medical research assistant. Your task is to optimize long, detailed queries into concise PubMed search terms. Focus on the core medical concepts, diseases, treatments, and key terms that would yield the best search results.'
      },
      {
        role: 'user',
        content: `Please optimize this medical query for PubMed search. Extract the key medical terms, diseases, treatments, and concepts. Make it concise but comprehensive.

Original query: "${longQuery}"

Rules:
1. Focus on medical keywords, diseases, treatments, symptoms, and research topics
2. Use PubMed-compatible syntax when appropriate (AND, OR, NOT)
3. Keep it under 200 characters if possible
4. Return ONLY the optimized search query, no explanations`
      }
    ];

    const response = await MiniMaxRequest(messages);
    const optimized = response.trim();

    // Validate the response
    if (optimized.length > 300) {
      throw new Error('Optimized query too long');
    }

    return optimized || longQuery;
  } catch (error) {
    console.error("MiniMax query optimization error:", error);
    throw error; // Re-throw to trigger fallback
  }
};
