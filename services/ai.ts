import * as ollama from './ollama';
import * as gemini from './gemini';
import * as mistral from './mistral';
import * as minimax from './minimax';

/**
 * AI Service Abstraction Layer
 * Uses fallback: tries providers in PROVIDER_PRIORITY order.
 *
 * Current priority (chosen by user on 2026-08-05; unusual because it
 * places paid Mistral first and local Ollama last; see
 * summary/audit/004 for justification):
 *   mistral → MiniMax → gemini → ollama
 */

type AIProvider = 'ollama' | 'gemini' | 'mistral' | 'minimax';

/**
 * Priority order for AI providers.
 * User-selected order: mistral → MiniMax → gemini → ollama.
 * ⚠️ This is intentionally not "local-first"; the rationale is
 * documented in openspec/changes/MiniMax-provider-integration/design.md.
 */
const PROVIDER_PRIORITY: AIProvider[] = ['mistral', 'minimax', 'gemini', 'ollama'];

/**
 * Get the selected AI provider from localStorage
 */
const getSelectedProvider = (): AIProvider => {
  const stored = localStorage.getItem('selectedAIProvider');
  return (stored as AIProvider) || 'ollama';
};

/**
 * Check if a provider is available (with basic API test for cloud providers)
 */
const isProviderAvailable = async (provider: AIProvider): Promise<boolean> => {
  switch (provider) {
    case 'ollama':
      return await ollama.checkOllamaConnection();
    case 'gemini':
      const geminiKeyPresent = !!import.meta.env.VITE_API_KEY;
      if (!geminiKeyPresent) return false;
      // Quick API test - try a simple generation
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_API_KEY });
        await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: 'Hello',
        });
        return true;
      } catch (error: any) {
        // If quota exceeded or resource exhausted, consider unavailable
        if (error.message?.includes('RESOURCE_EXHAUSTED') ||
            error.message?.includes('quota') ||
            error.status === 'RESOURCE_EXHAUSTED') {
          return false;
        }
        return false;
      }
    case 'mistral':
      const mistralKeyPresent = !!import.meta.env.VITE_MISTRAL_API_KEY;
      if (!mistralKeyPresent) {
        console.log('Mistral API key not present');
        return false;
      }
      // Quick API test
      try {
        console.log('Testing Mistral API...');
        const response = await fetch('https://api.mistral.ai/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_MISTRAL_API_KEY}`,
          },
        });
        const result = response.ok;
        console.log('Mistral API test result:', result);
        return result;
      } catch (error) {
        console.log('Mistral API test failed:', error.message);
        return false;
      }
    case 'minimax':
      const minimaxKeyPresent = !!import.meta.env.VITE_MINIMAX_API_KEY;
      const minimaxKeyStr = String(import.meta.env.VITE_MINIMAX_API_KEY || '');
      if (!minimaxKeyPresent || minimaxKeyStr.trim().startsWith('MINIMAX_REPLACE_ME')) {
        console.log('MiniMax API key is missing or still a placeholder');
        return false;
      }
      // Quick API test - list available models (OpenAI-compatible endpoint)
      try {
        console.log('Testing MiniMax API...');
        const response = await fetch('https://api.minimax.io/v1/models', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_MINIMAX_API_KEY}`,
          },
        });
        const result = response.ok;
        console.log('MiniMax API test result:', result);
        return result;
      } catch (error) {
        console.log('MiniMax API test failed:', error.message);
        return false;
      }
    default:
      return false;
  }
};

/**
 * Find the first available AI provider in priority order
 */
const findAvailableProvider = async (): Promise<AIProvider> => {
  for (const provider of PROVIDER_PRIORITY) {
    if (await isProviderAvailable(provider)) {
      return provider;
    }
  }
  throw new Error('ALL_AI_PROVIDERS_UNAVAILABLE');
};

/**
 * Get user-friendly error message for unavailable provider
 */
const getUnavailableMessage = (provider: AIProvider): string => {
  switch (provider) {
    case 'ollama':
      return 'Ollama недоступен. Проверьте, запущен ли Ollama сервер.';
    case 'gemini':
      return 'Gemini недоступен. Проверьте API ключ или лимит запросов.';
    case 'mistral':
      return 'Mistral недоступен. Проверьте API ключ или лимит запросов.';
    case 'minimax':
      return 'MiniMax недоступен. Проверьте API ключ или лимит запросов.';
    default:
      return 'Выбранный AI-провайдер недоступен.';
  }
};

export const translateQueryToEnglish = async (query: string): Promise<string> => {
  const provider = getSelectedProvider();

  try {
    // Try selected provider first
    const available = await isProviderAvailable(provider);
    if (available) {
      switch (provider) {
        case 'ollama':
          return ollama.translateQueryToEnglish(query);
        case 'gemini':
          return gemini.translateQueryToEnglish(query);
        case 'mistral':
          return mistral.translateQueryToEnglish(query);
        case 'minimax':
          return minimax.translateQueryToEnglish(query);
        default:
          return query;
      }
    }
  } catch (error) {
    // If selected provider fails, don't throw yet, try fallbacks
  }

  // Try fallback providers in priority order
  for (const fallbackProvider of PROVIDER_PRIORITY.filter(p => p !== provider)) {
    try {
      const available = await isProviderAvailable(fallbackProvider);
      if (available) {
        switch (fallbackProvider) {
          case 'ollama':
            return ollama.translateQueryToEnglish(query);
          case 'gemini':
            return gemini.translateQueryToEnglish(query);
          case 'mistral':
            return mistral.translateQueryToEnglish(query);
          case 'minimax':
            return minimax.translateQueryToEnglish(query);
          default:
            break;
        }
      }
    } catch (error) {
      // Continue to next provider
    }
  }

  // If all providers failed, throw specific error for modal
  throw new Error('ALL_AI_PROVIDERS_UNAVAILABLE');
};

export const translateTitlesToRussian = async (titles: string[]): Promise<string[]> => {
  const provider = getSelectedProvider();

  try {
    // Try selected provider first
    const available = await isProviderAvailable(provider);
    if (available) {
      switch (provider) {
        case 'ollama':
          return ollama.translateTitlesToRussian(titles);
        case 'gemini':
          return gemini.translateTitlesToRussian(titles);
        case 'mistral':
          return mistral.translateTitlesToRussian(titles);
        case 'minimax':
          return minimax.translateTitlesToRussian(titles);
        default:
          return titles;
      }
    }
  } catch (error) {
    // If selected provider fails, don't throw yet, try fallbacks
  }

  // Try fallback providers in priority order
  for (const fallbackProvider of PROVIDER_PRIORITY.filter(p => p !== provider)) {
    try {
      const available = await isProviderAvailable(fallbackProvider);
      if (available) {
        switch (fallbackProvider) {
          case 'ollama':
            return ollama.translateTitlesToRussian(titles);
          case 'gemini':
            return gemini.translateTitlesToRussian(titles);
          case 'mistral':
            return mistral.translateTitlesToRussian(titles);
          case 'minimax':
            return minimax.translateTitlesToRussian(titles);
          default:
            break;
        }
      }
    } catch (error) {
      // Continue to next provider
    }
  }

  // If all providers failed, throw specific error for modal
  throw new Error('ALL_AI_PROVIDERS_UNAVAILABLE');
};

export const summarizeArticleForLayperson = async (title: string, abstract: string): Promise<string> => {
  const provider = getSelectedProvider();

  try {
    // Try selected provider first
    const available = await isProviderAvailable(provider);
    if (available) {
      switch (provider) {
        case 'ollama':
          return ollama.summarizeArticleForLayperson(title, abstract);
        case 'gemini':
          return gemini.summarizeArticleForLayperson(title, abstract);
        case 'mistral':
          return mistral.summarizeArticleForLayperson(title, abstract);
        case 'minimax':
          return minimax.summarizeArticleForLayperson(title, abstract);
        default:
          return 'AI-провайдер не выбран.';
      }
    }
  } catch (error) {
    // If selected provider fails, don't throw yet, try fallbacks
  }

  // Try fallback providers in priority order
  for (const fallbackProvider of PROVIDER_PRIORITY.filter(p => p !== provider)) {
    try {
      const available = await isProviderAvailable(fallbackProvider);
      if (available) {
        switch (fallbackProvider) {
          case 'ollama':
            return ollama.summarizeArticleForLayperson(title, abstract);
          case 'gemini':
            return gemini.summarizeArticleForLayperson(title, abstract);
          case 'mistral':
            return mistral.summarizeArticleForLayperson(title, abstract);
          case 'minimax':
            return minimax.summarizeArticleForLayperson(title, abstract);
          default:
            break;
        }
      }
    } catch (error) {
      // Continue to next provider
    }
  }

  // If all providers failed, throw specific error for modal
  throw new Error('ALL_AI_PROVIDERS_UNAVAILABLE');
};

export const optimizeQueryForPubMed = async (longQuery: string): Promise<string> => {
  const provider = getSelectedProvider();

  try {
    // Try selected provider first
    const available = await isProviderAvailable(provider);
    if (available) {
      switch (provider) {
        case 'ollama':
          return ollama.optimizeQueryForPubMed(longQuery);
        case 'gemini':
          return gemini.optimizeQueryForPubMed(longQuery);
        case 'mistral':
          return mistral.optimizeQueryForPubMed(longQuery);
        case 'minimax':
          return minimax.optimizeQueryForPubMed(longQuery);
        default:
          return longQuery;
      }
    }
  } catch (error) {
    // If selected provider fails, don't throw yet, try fallbacks
  }

  // Try fallback providers in priority order
  for (const fallbackProvider of PROVIDER_PRIORITY.filter(p => p !== provider)) {
    try {
      const available = await isProviderAvailable(fallbackProvider);
      if (available) {
        switch (fallbackProvider) {
          case 'ollama':
            return ollama.optimizeQueryForPubMed(longQuery);
          case 'gemini':
            return gemini.optimizeQueryForPubMed(longQuery);
          case 'mistral':
            return mistral.optimizeQueryForPubMed(longQuery);
          case 'minimax':
            return minimax.optimizeQueryForPubMed(longQuery);
          default:
            break;
        }
      }
    } catch (error) {
      // Continue to next provider
    }
  }

  // If all providers failed, throw specific error for modal
  throw new Error('ALL_AI_PROVIDERS_UNAVAILABLE');
};
