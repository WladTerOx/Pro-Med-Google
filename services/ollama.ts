/**
 * Ollama AI Service
 * Local LLM integration using Ollama API
 */

// Ollama configuration
const OLLAMA_BASE_URL = import.meta.env.VITE_OLLAMA_BASE_URL || 'http://192.168.50.250:11434';
const OLLAMA_MODEL = import.meta.env.VITE_OLLAMA_MODEL || 'gpt-oss:20b-cloud';
// Логи закомментированы для продакшена
console.log('OLLAMA_BASE_URL', OLLAMA_BASE_URL);
console.log('OLLAMA_MODEL', OLLAMA_MODEL);

/**
 * Check if Ollama is available
 */
export const checkOllamaConnection = async (): Promise<boolean> => {
  console.log('Testing Ollama connection...');
  try {
    // Используем прокси для обхода CORS
    const response = await fetch('/api/ollama/api/tags', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const result = response.ok;
    console.log('Ollama connection test result:', result);
    return result;
  } catch (error: any) {
    console.log('Ollama connection test failed:', error?.message || error);
    return false;
  }
};

/**
 * Make a request to Ollama API
 */
const ollamaRequest = async (messages: Array<{role: string, content: string}>): Promise<string> => {
  try {
    // Используем прокси для обхода CORS
    const response = await fetch('/api/ollama/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: messages,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  } catch (error) {
    console.error('Ollama request error:', error);
    throw error;
  }
};

/**
 * Translates a search query from Russian (or any language) to English for PubMed.
 */
export const translateQueryToEnglish = async (query: string): Promise<string> => {
  try {
    // Check if Ollama is running
    const isAvailable = await checkOllamaConnection();
    if (!isAvailable) {
      console.warn('Ollama is not available, returning original query');
      return query;
    }

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

    const response = await ollamaRequest(messages);
    return response.trim() || query;
  } catch (error) {
    console.error("Query translation error:", error);
    return query; // Fallback to original query
  }
};

/**
 * Translates a list of titles to Russian using Ollama.
 */
export const translateTitlesToRussian = async (titles: string[]): Promise<string[]> => {
  try {
    // Check if Ollama is running
    const isAvailable = await checkOllamaConnection();
    if (!isAvailable) {
      console.warn('Ollama is not available, returning original titles');
      return titles;
    }

    if (titles.length === 0) return titles;

    // Translate titles one by one to avoid parsing issues
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

      const response = await ollamaRequest(messages);
      translatedTitles.push(response.trim() || title);
    }

    return translatedTitles;
  } catch (error) {
    console.error("Title translation error:", error);
    return titles; // Fallback to original
  }
};

/**
 * Optimizes a long query into concise PubMed-compatible search terms.
 */
export const optimizeQueryForPubMed = async (longQuery: string): Promise<string> => {
  try {
    // Check if Ollama is running
    const isAvailable = await checkOllamaConnection();
    if (!isAvailable) {
      // Fallback: extract key terms manually
      return extractKeyTermsManually(longQuery);
    }

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
4. Return ONLY the optimized search query, no explanations

Optimized query:`
      }
    ];

    const response = await ollamaRequest(messages);
    const optimized = response.trim();

    // Validate the response isn't too long or empty
    if (optimized.length > 300) {
      return extractKeyTermsManually(longQuery);
    }

    return optimized || extractKeyTermsManually(longQuery);
  } catch (error) {
    console.error("Query optimization error:", error);
    return extractKeyTermsManually(longQuery);
  }
};

/**
 * Fallback function to extract key terms manually when AI is unavailable.
 */
const extractKeyTermsManually = (query: string): string => {
  // Simple extraction of potential medical terms
  // Remove common words and keep terms that look like medical keywords
  const words = query.toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2)
    .filter(word =>
      !['что', 'как', 'для', 'при', 'после', 'перед', 'между', 'через', 'над', 'под', 'или', 'and', 'the', 'for', 'with', 'from', 'into', 'this', 'that', 'these', 'those'].includes(word)
    );

  // Take first 10 significant words
  const keyTerms = words.slice(0, 10);

  // If we have too many terms, prioritize medical-sounding ones
  const medicalTerms = keyTerms.filter(term =>
    term.includes('ит') ||
    term.includes('ов') ||
    term.includes('ин') ||
    term.includes('он') ||
    term.includes('pat') ||
    term.includes('med') ||
    term.includes('dis') ||
    term.includes('trea') ||
    term.includes('stud') ||
    term.length > 6
  );

  return medicalTerms.length > 0 ? medicalTerms.join(' ') : keyTerms.slice(0, 5).join(' ');
};

/**
 * Summarizes a medical abstract for a layperson in Russian.
 */
export const summarizeArticleForLayperson = async (title: string, abstract: string): Promise<string> => {
  try {
    // Check if Ollama is running
    const isAvailable = await checkOllamaConnection();
    if (!isAvailable) {
      return "Локальный ИИ (Ollama) недоступен. Проверьте, запущен ли Ollama сервер.";
    }

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

    const response = await ollamaRequest(messages);
    return response || "Не удалось создать краткое содержание.";
  } catch (error) {
    console.error("Summarization error:", error);
    return "Произошла ошибка при генерации описания.";
  }
};
