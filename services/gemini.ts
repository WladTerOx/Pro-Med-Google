import { GoogleGenAI, Type } from "@google/genai";

// Ensure API Key exists
const apiKey = import.meta.env.VITE_API_KEY;
if (!apiKey) {
  console.error("API_KEY environment variable is missing.");
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'dummy-key-to-prevent-crash-if-missing' });

/**
 * Translates a search query from Russian (or any language) to English for PubMed.
 */
export const translateQueryToEnglish = async (query: string): Promise<string> => {
  if (!apiKey) throw new Error('Gemini API key is missing');

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `Translate the following medical search query into English for a PubMed database search. 
    If the query is already in English, return it exactly as is.
    Return ONLY the English translation, no other text or explanation.
    
    Query: "${query}"`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text?.trim() || query;
  } catch (error) {
    throw error; // Re-throw to trigger fallback
  }
};

/**
 * Translates a list of titles to Russian using Gemini.
 */
export const translateTitlesToRussian = async (titles: string[]): Promise<string[]> => {
  if (!apiKey) throw new Error('Gemini API key is missing');
  if (titles.length === 0) return titles;

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `Translate the following medical article titles from English to Russian. 
    Return ONLY a JSON array of strings corresponding to the order of the input.
    Input: ${JSON.stringify(titles)}`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return titles;

    const translatedTitles = JSON.parse(jsonText);
    if (Array.isArray(translatedTitles) && translatedTitles.length === titles.length) {
      return translatedTitles;
    }
    return titles;
  } catch (error) {
    console.error("Translation error:", error);
    throw error; // Re-throw to trigger fallback
  }
};

/**
 * Summarizes a medical abstract for a layperson in Russian.
 */
export const summarizeArticleForLayperson = async (title: string, abstract: string): Promise<string> => {
  if (!apiKey) return "API Key is missing. Cannot generate summary.";

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `You are a helpful medical assistant. 
    Your task is to explain the following medical scientific article to a simple person (non-medical expert) in Russian.
    
    Rules:
    1. **Output Language**: Russian (Русский).
    2. Use simple, clear language. Avoid complex terminology where possible, or explain it.
    3. Focus on the main conclusion: What did they find? Why is it important?
    4. Structure the response with clear paragraphs or bullet points.
    5. Be concise but informative.
    6. Do not make up facts. Stick to the abstract provided.

    Article Title: ${title}
    Abstract: ${abstract}
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text || "Не удалось создать краткое содержание.";
  } catch (error) {
    console.error("Summarization error:", error);
    throw error; // Re-throw to trigger fallback
  }
};

/**
 * Optimizes a long query into concise PubMed-compatible search terms using Gemini.
 */
export const optimizeQueryForPubMed = async (longQuery: string): Promise<string> => {
  if (!apiKey) throw new Error('Gemini API key is missing');

  try {
    const model = 'gemini-2.5-flash';
    const prompt = `You are a medical research assistant. Your task is to optimize long, detailed queries into concise PubMed search terms. Focus on the core medical concepts, diseases, treatments, and key terms that would yield the best search results.
    
    Please optimize this medical query for PubMed search. Extract the key medical terms, diseases, treatments, and concepts. Make it concise but comprehensive.

    Original query: "${longQuery}"

    Rules:
    1. Focus on medical keywords, diseases, treatments, symptoms, and research topics
    2. Use PubMed-compatible syntax when appropriate (AND, OR, NOT)
    3. Keep it under 200 characters if possible
    4. Return ONLY the optimized search query, no explanations`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
    });

    return response.text?.trim() || longQuery;
  } catch (error) {
    console.error("Query optimization error:", error);
    throw error; // Re-throw to trigger fallback
  }
};