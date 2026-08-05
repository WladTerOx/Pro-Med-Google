import React, { useState, useEffect } from 'react';
import { SearchIcon, SparklesIcon, SettingsIcon, FileTextIcon, ExternalLinkIcon, MoonIcon, SunIcon, XCircleIcon } from './components/Icon';
import { PubMedArticle, SearchState } from './types';
import { searchPubMedArticles } from './services/pubmed';
import { translateTitlesToRussian, translateQueryToEnglish, optimizeQueryForPubMed } from './services/ai';
import { ArticleModal } from './components/ArticleModal';

function App() {
  const [pubmedApiKey, setPubmedApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [selectedAIProvider, setSelectedAIProvider] = useState<'ollama' | 'gemini' | 'mistral'>('ollama');
  
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    results: [],
    loading: false,
    error: null,
    count: 10
  });

  const [selectedArticle, setSelectedArticle] = useState<PubMedArticle | null>(null);
  const [showAIErrorModal, setShowAIErrorModal] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const stored = localStorage.getItem('selectedAIProvider') as 'ollama' | 'gemini' | 'mistral' | null;
    if (stored) {
      setSelectedAIProvider(stored);
    }
  }, []);

  const handleAIProviderChange = (provider: 'ollama' | 'gemini' | 'mistral') => {
    setSelectedAIProvider(provider);
    localStorage.setItem('selectedAIProvider', provider);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchState.query.trim()) return;

    setSearchState(prev => ({ ...prev, loading: true, error: null, results: [] }));

    try {
      let searchQuery = searchState.query.trim();

      // Check if query needs optimization (long queries or multiple sentences)
      const needsOptimization = searchQuery.length > 100 || searchQuery.split(/[.!?]+/).length > 2;

      if (needsOptimization) {
        console.log('Optimizing long query for PubMed...');
        searchQuery = await optimizeQueryForPubMed(searchQuery);
        console.log('Optimized query:', searchQuery);
      }

      // 0. Translate Query to English for PubMed compatibility
      // PubMed works best with English terms. We translate the optimized query.
      const englishQuery = await translateQueryToEnglish(searchQuery);

      // 1. Fetch from PubMed
      const articles = await searchPubMedArticles(englishQuery, searchState.count, pubmedApiKey);

      // Update state immediately with raw articles to show something
      setSearchState(prev => ({
        ...prev,
        results: articles,
      }));

      // 2. Translate Titles in background (or immediately if fast)
      if (articles.length > 0) {
        const titles = articles.map(a => a.title);
        const translatedTitles = await translateTitlesToRussian(titles);

        const translatedArticles = articles.map((article, index) => ({
          ...article,
          titleTranslated: translatedTitles[index]
        }));

        setSearchState(prev => ({
          ...prev,
          loading: false,
          results: translatedArticles
        }));
      } else {
        setSearchState(prev => ({ ...prev, loading: false }));
      }

    } catch (err: any) {
      if (err.message === 'ALL_AI_PROVIDERS_UNAVAILABLE') {
        setShowAIErrorModal(true);
        setSearchState(prev => ({
          ...prev,
          loading: false,
          error: null // Don't show error in results when modal is shown
        }));
      } else {
        setSearchState(prev => ({
          ...prev,
          loading: false,
          error: err.message || 'Произошла ошибка при поиске'
        }));
      }
    }
  };

  const handleClearSearch = () => {
    setSearchState(prev => ({
      ...prev,
      query: '',
      results: [],
      error: null
    }));
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 pb-20 transition-colors duration-300`}>
      
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-indigo-600 dark:bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-indigo-200 dark:shadow-none shadow-lg">
                <SearchIcon />
             </div>
             <div>
               <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">PubMed AI Explorer</h1>
               <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Поиск и перевод медицинских статей</p>
             </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Toggle Dark Mode"
            >
              {isDarkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              aria-label="Settings"
            >
              <SettingsIcon />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 animate-in slide-in-from-top-2">
            <div className="max-w-4xl mx-auto">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                PubMed API Key (Optional)
                <span className="text-gray-400 text-xs ml-2 font-normal">Позволяет делать больше запросов в секунду</span>
              </label>
              <input 
                type="text" 
                value={pubmedApiKey}
                onChange={(e) => setPubmedApiKey(e.target.value)}
                placeholder="Введите ваш NCBI API Key"
                className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder-gray-400 dark:placeholder-gray-500"
              />
               <div className="mt-3 flex items-center gap-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                     Количество результатов:
                  </label>
                  <select
                     value={searchState.count}
                     onChange={(e) => setSearchState(prev => ({...prev, count: Number(e.target.value)}))}
                     className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded text-sm"
                  >
                     <option value={5}>5</option>
                     <option value={10}>10</option>
                     <option value={20}>20</option>
                  </select>
               </div>
               <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                     AI Провайдер
                     <span className="text-gray-400 text-xs ml-2 font-normal">Выберите источник ИИ для переводов и анализа</span>
                  </label>
                  <div className="space-y-2">
                     <label className="flex items-center">
                        <input
                           type="radio"
                           name="aiProvider"
                           value="ollama"
                           checked={selectedAIProvider === 'ollama'}
                           onChange={(e) => handleAIProviderChange(e.target.value as 'ollama')}
                           className="mr-2 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Ollama (локальный, рекомендуется)</span>
                     </label>
                     <label className="flex items-center">
                        <input
                           type="radio"
                           name="aiProvider"
                           value="gemini"
                           checked={selectedAIProvider === 'gemini'}
                           onChange={(e) => handleAIProviderChange(e.target.value as 'gemini')}
                           className="mr-2 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Gemini (Google AI)</span>
                     </label>
                     <label className="flex items-center">
                        <input
                           type="radio"
                           name="aiProvider"
                           value="mistral"
                           checked={selectedAIProvider === 'mistral'}
                           onChange={(e) => handleAIProviderChange(e.target.value as 'mistral')}
                           className="mr-2 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">Mistral (бесплатный)</span>
                     </label>
                  </div>
               </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Search Form */}
        <div className="mb-10">
          <div className="space-y-4">
            <div className="relative group">
              <div className="absolute inset-y-0 left-4 flex items-start pt-4 pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400 dark:text-gray-500 group-focus-within:text-indigo-500 transition-colors" />
              </div>
              <textarea
                className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm text-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/20 dark:focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-500 transition-all resize-none min-h-[60px]"
                placeholder="Введите запрос на русском (например: влияние кофе на сердце)..."
                value={searchState.query}
                onChange={(e) => setSearchState(prev => ({ ...prev, query: e.target.value }))}
                rows={2}
                style={{ height: 'auto', minHeight: '60px' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                }}
              />
            </div>
            <div className="flex gap-3 justify-end">
              {searchState.query && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-xl font-medium transition-colors"
                  aria-label="Clear search"
                >
                  Очистить
                </button>
              )}
              <button
                type="button"
                onClick={handleSearch}
                disabled={searchState.loading}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white rounded-xl font-medium transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {searchState.loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Поиск...
                  </>
                ) : (
                  <>
                    <SearchIcon className="h-4 w-4" />
                    Найти
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {searchState.error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-xl border border-red-100 dark:border-red-800 flex items-center gap-3">
              <span className="text-xl">⚠️</span>
              {searchState.error}
            </div>
          )}

          {searchState.results.map((article) => (
            <div 
              key={article.id} 
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700/50 transition-all group"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">
                    {article.titleTranslated || <span className="animate-pulse bg-gray-200 dark:bg-gray-700 text-transparent rounded select-none">{article.title}</span>}
                  </h3>
                  {article.titleTranslated && (
                     <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-medium">{article.title}</p>
                  )}
                  
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-gray-500 dark:text-gray-400 mb-4">
                     <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/50 px-2 py-1 rounded-md">
                        <FileTextIcon className="w-3 h-3" /> {article.journal}
                     </span>
                     <span>{article.year}</span>
                     <span className="text-gray-400 dark:text-gray-600">|</span>
                     <span className="truncate max-w-xs">{article.authors.join(', ')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSelectedArticle(article)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-semibold rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                    >
                      <SparklesIcon className="w-4 h-4" />
                      Пересказать (AI)
                    </button>
                    <a 
                      href={article.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2 text-gray-500 dark:text-gray-400 text-sm hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      PubMed <ExternalLinkIcon className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {!searchState.loading && searchState.results.length === 0 && searchState.query && !searchState.error && (
             <div className="text-center py-20 text-gray-400 dark:text-gray-500">
                <p>Результаты не найдены. Попробуйте изменить запрос.</p>
             </div>
          )}
          
          {!searchState.loading && searchState.results.length === 0 && !searchState.query && (
            <div className="text-center py-20">
               <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-200 dark:text-indigo-400 rounded-full mb-4">
                  <SearchIcon className="w-10 h-10" />
               </div>
               <h3 className="text-lg font-medium text-gray-900 dark:text-white">Начните поиск</h3>
               <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">Введите ключевые слова на русском языке (например: "диабет", "витамин D"). ИИ автоматически переведет их для поиска.</p>
            </div>
          )}

          {searchState.loading && searchState.results.length === 0 && (
             <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 animate-pulse">
                     <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
                     <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-1/2 mb-4"></div>
                     <div className="flex gap-2">
                        <div className="h-8 bg-gray-100 dark:bg-gray-700 rounded w-32"></div>
                     </div>
                  </div>
                ))}
             </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {selectedArticle && (
        <ArticleModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
          onAIError={() => setShowAIErrorModal(true)}
        />
      )}

      {showAIErrorModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center">
                <XCircleIcon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                AI недоступен
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Ни один из AI-провайдеров (Ollama, Gemini, Mistral) не доступен.
              Проверьте настройки подключения и API ключи для облачных сервисов.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowAIErrorModal(false);
                  setShowSettings(true);
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Настроить
              </button>
              <button
                onClick={() => setShowAIErrorModal(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg font-medium transition-colors"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
