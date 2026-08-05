import React, { useEffect, useState } from 'react';
import { PubMedArticle } from '../types';
import { summarizeArticleForLayperson } from '../services/ai';
import { XIcon, SparklesIcon, ExternalLinkIcon } from './Icon';
import ReactMarkdown from 'react-markdown'; 

interface Props {
  article: PubMedArticle;
  onClose: () => void;
  onAIError: () => void;
}

const MarkdownRenderer = ({ text }: { text: string }) => {
  return (
    <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6 first:mt-0 text-gray-900 dark:text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-5 text-gray-900 dark:text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-4 text-gray-900 dark:text-white">{children}</h3>,
          p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="ml-4">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-gray-100">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export const ArticleModal: React.FC<Props> = ({ article, onClose, onAIError }) => {
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const fetchSummary = async () => {
      setLoading(true);
      if (!article.abstract) {
          if(mounted) {
            setSummary("К сожалению, для этой статьи нет доступной аннотации (abstract), поэтому ИИ не может составить резюме.");
            setLoading(false);
          }
          return;
      }

      try {
        const result = await summarizeArticleForLayperson(article.title, article.abstract);
        if (mounted) {
          setSummary(result);
          setLoading(false);
        }
      } catch (error: any) {
        if (error.message === 'ALL_AI_PROVIDERS_UNAVAILABLE') {
          onAIError();
          onClose(); // Close the article modal
        } else {
          // Handle other errors
          if (mounted) {
            setSummary('Произошла ошибка при обработке статьи. Попробуйте позже.');
            setLoading(false);
          }
        }
      }
    };

    fetchSummary();
    return () => { mounted = false; };
  }, [article]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-200 border dark:border-gray-700">
        
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
          <div>
             <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400 font-medium text-sm uppercase tracking-wider">
               <SparklesIcon className="w-4 h-4" />
               <span>AI Analysis</span>
             </div>
             <h2 className="text-xl font-bold text-gray-900 dark:text-white line-clamp-2">
               {article.titleTranslated || article.title}
             </h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <XIcon />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-4 text-gray-500 dark:text-gray-400">
              <div className="w-8 h-8 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin"></div>
              <p className="animate-pulse">ИИ изучает статью и готовит пересказ...</p>
            </div>
          ) : (
            <MarkdownRenderer text={summary} />
          )}
          
          <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
             <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase">Оригинальные данные</h4>
             <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">{article.authors.join(', ')} • {article.year} • {article.journal}</p>
             <a 
               href={article.url} 
               target="_blank" 
               rel="noopener noreferrer"
               className="inline-flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 font-medium"
             >
               Читать оригинал на PubMed <ExternalLinkIcon className="w-3 h-3" />
             </a>
          </div>
        </div>

      </div>
    </div>
  );
};
