import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Volume2, 
  BookOpen, 
  Image as ImageIcon, 
  Award, 
  Sparkles, 
  RefreshCw, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ChevronRight, 
  Search, 
  History, 
  Eye, 
  EyeOff, 
  ArrowLeft, 
  Lightbulb, 
  Play, 
  Smile, 
  Library, 
  X
} from 'lucide-react';

interface WordItem {
  id: string;
  word: string;               // e.g. "gorgeous"
  phonetic: string;           // e.g. "/ˈɡɔːdʒəs/"
  translation: string;        // e.g. "极好的，华丽的"
  sentence: string;           // e.g. "You look gorgeous tonight."
  sentenceTranslation: string;// e.g. "你今晚看起来太美了。"
  createdAt: number;
  correctTimes: number;
  wrongTimes: number;
  lastTestedAt?: number;
}

interface QuizSession {
  isActive: boolean;
  wordList: WordItem[];
  currentIndex: number;
  userAnswer: string;
  showFeedback: boolean;
  feedbackStatus: 'correct' | 'wrong' | null;
  revealedProgress: boolean; // Show hinting letters
  score: {
    correct: number;
    wrong: number;
  };
  wrongRecords: string[]; // IDs of words failed in this current session
}

export default function App() {
  // Navigation Tabs: 'vocab' | 'quiz-setup' | 'quiz-active' | 'mistakes'
  const [activeTab, setActiveTab] = useState<'vocab' | 'quiz-setup' | 'quiz-active' | 'mistakes'>('vocab');

  // Core Word Database State
  const [words, setWords] = useState<WordItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Loading indicator states
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);

  // Manual word inputs
  const [manualInputValue, setManualInputValue] = useState('');

  // Toast / Dialog alerts
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Quiz Settings State
  const [quizSettings, setQuizSettings] = useState({
    limit: 10,
    source: 'all' as 'all' | 'mistakes' | 'recent',
    showPhonetic: true,
    showChinese: true,
    showSentenceBlank: true,
    autoSpeak: true,
  });

  // Active Quiz State
  const [quiz, setQuiz] = useState<QuizSession>({
    isActive: false,
    wordList: [],
    currentIndex: 0,
    userAnswer: '',
    showFeedback: false,
    feedbackStatus: null,
    revealedProgress: false,
    score: { correct: 0, wrong: 0 },
    wrongRecords: [],
  });

  const [activeQuizReport, setActiveQuizReport] = useState<{
    total: number;
    correct: number;
    wrong: number;
    failures: WordItem[];
  } | null>(null);

  // Ref to audio elements or input elements
  const fileInputRef = useRef<HTMLInputElement>(null);
  const answerInputRef = useRef<HTMLInputElement>(null);

  // Initialize and load from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('vocab_words');
      if (stored) {
        setWords(JSON.parse(stored));
      } else {
        // Hydrate with high-quality sample data if empty
        const samples: WordItem[] = [
          {
            id: 'sample-1',
            word: 'achievement',
            phonetic: '/əˈtʃiːvmənt/',
            translation: '成就，功绩，达到',
            sentence: 'Winning the match was a great achievement.',
            sentenceTranslation: '赢得这场比赛是一项巨大的成就。',
            createdAt: Date.now() - 500000,
            correctTimes: 2,
            wrongTimes: 1,
          },
          {
            id: 'sample-2',
            word: 'perseverance',
            phonetic: '/ˌpɜːsɪˈvɪərəns/',
            translation: '毅力，不屈不挠的精神',
            sentence: 'Great works are performed not by strength, but by perseverance.',
            sentenceTranslation: '伟大的作品不是靠力量，而是靠坚持不懈来完成的。',
            createdAt: Date.now() - 400000,
            correctTimes: 0,
            wrongTimes: 2,
          },
          {
            id: 'sample-3',
            word: 'optimistic',
            phonetic: '/ˌɒptɪˈmɪstɪk/',
            translation: '乐观的，乐观主义的',
            sentence: 'She is optimistic about her future career.',
            sentenceTranslation: '她对自己的未来职业充满乐观。',
            createdAt: Date.now() - 300000,
            correctTimes: 4,
            wrongTimes: 0,
          }
        ];
        setWords(samples);
        localStorage.setItem('vocab_words', JSON.stringify(samples));
      }
    } catch (e) {
      console.error("Failed to load local storage: ", e);
    }
  }, []);

  // Save changes to localStorage helper
  const saveWordsToStore = (newWords: WordItem[]) => {
    setWords(newWords);
    try {
      localStorage.setItem('vocab_words', JSON.stringify(newWords));
    } catch (e) {
      console.error(e);
    }
  };

  // Helper trigger Notification toast
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4500);
  };

  // Speaks pronunciation using browser SpeechSynthesis
  const speakWord = (word: string) => {
    if (!window.speechSynthesis) {
      showToast("您的浏览器暂不支持语音合成", "error");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'en-US';
    utterance.rate = 0.8; // spelling speed
    window.speechSynthesis.speak(utterance);
  };

  const speakSentence = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  };

  // Normalizes list of inputted words, e.g. splits in multiple separators
  const handleManualImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInputValue.trim()) {
      showToast("请输入至少一个英文单词", "error");
      return;
    }

    // Capture separate words (allows commas, semicolons, lines, space separates)
    const rawWords = manualInputValue
      .split(/[\n,;，；\s]+/)
      .map(w => w.replace(/[^a-zA-Z-]/g, '').trim()) // Clear numbers/chinese tags
      .filter(w => w.length > 0);

    if (rawWords.length === 0) {
      showToast("没有解析到合法的英文单词(仅限字母和连字符)", "error");
      return;
    }

    // Filter duplicates already pending
    const existingLowers = words.map(w => w.word.toLowerCase());
    const uniqueIncoming: string[] = ([...new Set(rawWords)] as string[]).filter(
      (w: string) => !existingLowers.includes(w.toLowerCase())
    );

    if (uniqueIncoming.length === 0) {
      showToast("输入的单词都在词库中已存在", "info");
      return;
    }

    setManualLoading(true);
    showToast(`正在通过 Gemini 生成 ${uniqueIncoming.length} 个单词的释义、音标与例句...`, "info");

    try {
      const response = await fetch('/api/gemini/generate-word-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ words: uniqueIncoming }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '获取释义失败');
      }

      if (data.results && Array.isArray(data.results)) {
        const addedItems: WordItem[] = data.results.map((item: any, idx: number) => ({
          id: `word-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          word: item.word || uniqueIncoming[idx],
          phonetic: item.phonetic || '/.../',
          translation: item.translation || '未知释义',
          sentence: item.sentence || 'No example sentence created.',
          sentenceTranslation: item.sentenceTranslation || '无翻译',
          createdAt: Date.now(),
          correctTimes: 0,
          wrongTimes: 0,
        }));

        const updated = [...addedItems, ...words];
        saveWordsToStore(updated);
        setManualInputValue('');
        showToast(`成功导入 ${addedItems.length} 个单词到词库！`, "success");
      } else {
        throw new Error("返回的数据格式不正确");
      }
    } catch (err: any) {
      console.error(err);
      showToast(`AI解析失败：${err.message || '未知错误'}`, "error");
    } finally {
      setManualLoading(false);
    }
  };

  // Handle Photo OCR Import
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processPhotoImport(file);
    }
  };

  const processPhotoImport = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast("请上传图片文件(png/jpg/webp等)", "error");
      return;
    }

    setIsOcrLoading(true);
    showToast("正在读取照片并上传给 Gemini 智能提取单词...", "info");

    try {
      // FileReader to Base64 conversion
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      const response = await fetch('/api/gemini/import-ocr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64Data,
          mimeType: file.type
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '照片分析失败');
      }

      if (data.results && Array.isArray(data.results)) {
        if (data.results.length === 0) {
          showToast("Gemini 已经在照片中仔细寻找，但未发现印刷或手写的英文单词。请拍写字迹清洗的生词表重试。", "info");
          return;
        }

        // Filter duplicates
        const existingLowers = words.map(w => w.word.toLowerCase());
        const validResults = data.results.filter((item: any) => {
          return item.word && typeof item.word === 'string' && item.word.trim().length > 0;
        });

        const newItems: WordItem[] = [];
        let skippedCount = 0;

        validResults.forEach((item: any, idx: number) => {
          const wName = item.word.trim();
          if (existingLowers.includes(wName.toLowerCase())) {
            skippedCount++;
          } else {
            newItems.push({
              id: `ocr-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
              word: wName,
              phonetic: item.phonetic || '/.../',
              translation: item.translation || '提取释义',
              sentence: item.sentence || 'No illustrative sentence generated.',
              sentenceTranslation: item.sentenceTranslation || '无翻译',
              createdAt: Date.now(),
              correctTimes: 0,
              wrongTimes: 0,
            });
          }
        });

        if (newItems.length > 0) {
          const updated = [...newItems, ...words];
          saveWordsToStore(updated);
          showToast(`照片解析成功！提取了 ${newItems.length} 个新单词。${skippedCount > 0 ? `(自动跳过 ${skippedCount} 个已存在词)` : ''}`, "success");
        } else {
          showToast(`照片内识别到的 ${skippedCount} 个单词均已在您的词库中了！`, "info");
        }
      } else {
        throw new Error("AI没有传回规范的单词结构");
      }
    } catch (err: any) {
      console.error(err);
      showToast(`照片智能提取损坏或超时: ${err.message || '未知错误'}`, "error");
    } finally {
      setIsOcrLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Eliminate word
  const deleteWord = (id: string, name: string) => {
    if (confirm(`确认要将单词 "${name}" 从您的词库中永久删除吗？`)) {
      const filtered = words.filter(w => w.id !== id);
      saveWordsToStore(filtered);
      showToast(`已将单词 "${name}" 移出词库`, "info");
    }
  };

  // Format the sentence to blank out the key word dynamically
  const getMaskedSentence = (sentence: string, word: string) => {
    if (!sentence || !word) return '';
    // Use word boundaries, case insensitive replace
    const escapedWord = word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    return sentence.replace(regex, '______');
  };

  // Initialize Quiz Session Setup
  const handleSetupQuiz = (isMistakeReview: boolean = false) => {
    let sourcePool: WordItem[] = [];

    if (isMistakeReview) {
      sourcePool = words.filter(w => w.wrongTimes > 0);
      if (sourcePool.length === 0) {
        showToast("检测到您目前还没有任何拼写错误的记录！先进行普通默写吧。", "info");
        return;
      }
    } else {
      if (quizSettings.source === 'mistakes') {
        sourcePool = words.filter(w => w.wrongTimes > 0);
        if (sourcePool.length === 0) {
          showToast("您的错词库目前是空的！默认切换为选取整个词库。", "info");
          sourcePool = [...words];
        }
      } else if (quizSettings.source === 'recent') {
        // Last updated first
        sourcePool = [...words].sort((a,b) => b.createdAt - a.createdAt);
      } else {
        // All words
        sourcePool = [...words];
      }
    }

    if (sourcePool.length === 0) {
      showToast("您的词库里目前没有任何生词。请先在左侧输入英文或拍照上传！", "error");
      setActiveTab('vocab');
      return;
    }

    // Shuffle pool
    const shuffled = [...sourcePool].sort(() => 0.5 - Math.random());
    const targetCount = isMistakeReview ? shuffled.length : Math.min(quizSettings.limit, shuffled.length);
    const selectedList = shuffled.slice(0, targetCount);

    setQuiz({
      isActive: true,
      wordList: selectedList,
      currentIndex: 0,
      userAnswer: '',
      showFeedback: false,
      feedbackStatus: null,
      revealedProgress: false,
      score: { correct: 0, wrong: 0 },
      wrongRecords: []
    });

    setActiveQuizReport(null);
    setActiveTab('quiz-active');
    
    // Speak first word after minor delay
    setTimeout(() => {
      speakWord(selectedList[0].word);
    }, 400);
  };

  // Quiz submission verification
  const handleAnswerSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (quiz.showFeedback) return; // Wait for next action

    const currentItem = quiz.wordList[quiz.currentIndex];
    const userAnsClean = quiz.userAnswer.trim().toLowerCase();
    const correctAnsClean = currentItem.word.trim().toLowerCase();

    // Check spelling
    const isCorrect = userAnsClean === correctAnsClean;

    // Pronouce word results automatically upon submission
    if (quizSettings.autoSpeak) {
      speakWord(currentItem.word);
    }

    // Update database record statistics
    const updatedWords = words.map(w => {
      if (w.word.toLowerCase() === correctAnsClean) {
        return {
          ...w,
          correctTimes: isCorrect ? w.correctTimes + 1 : w.correctTimes,
          wrongTimes: !isCorrect ? w.wrongTimes + 1 : w.wrongTimes,
          lastTestedAt: Date.now()
        };
      }
      return w;
    });
    saveWordsToStore(updatedWords);

    setQuiz(prev => {
      const newScore = { ...prev.score };
      const newWrongRecords = [...prev.wrongRecords];

      if (isCorrect) {
        newScore.correct += 1;
      } else {
        newScore.wrong += 1;
        newWrongRecords.push(currentItem.id);
      }

      return {
        ...prev,
        showFeedback: true,
        feedbackStatus: isCorrect ? 'correct' : 'wrong',
        score: newScore,
        wrongRecords: newWrongRecords
      };
    });

    // Auto focus next button or answer
    setTimeout(() => {
      const nextBtn = document.getElementById('quiz-next-btn');
      if (nextBtn) nextBtn.focus();
    }, 100);
  };

  // Skip step
  const handleSkipQuestion = () => {
    const currentItem = quiz.wordList[quiz.currentIndex];
    // Regard as wrong answer
    const updatedWords = words.map(w => {
      if (w.id === currentItem.id) {
        return {
          ...w,
          wrongTimes: w.wrongTimes + 1,
          lastTestedAt: Date.now()
        };
      }
      return w;
    });
    saveWordsToStore(updatedWords);

    setQuiz(prev => {
      const newScore = { ...prev.score };
      const newWrongRecords = [...prev.wrongRecords];
      newScore.wrong += 1;
      newWrongRecords.push(currentItem.id);

      return {
        ...prev,
        userAnswer: currentItem.word, // Auto fill
        showFeedback: true,
        feedbackStatus: 'wrong',
        score: newScore,
        wrongRecords: newWrongRecords
      };
    });
  };

  // Go to next spelling question
  const advanceQuiz = () => {
    if (quiz.currentIndex + 1 < quiz.wordList.length) {
      setQuiz(prev => ({
        ...prev,
        currentIndex: prev.currentIndex + 1,
        userAnswer: '',
        showFeedback: false,
        feedbackStatus: null,
        revealedProgress: false
      }));

      // Speak next word shortly after loading
      const nextWord = quiz.wordList[quiz.currentIndex + 1].word;
      setTimeout(() => {
        speakWord(nextWord);
        if (answerInputRef.current) answerInputRef.current.focus();
      }, 300);
    } else {
      // Finished dictation! Generate report
      const failures = quiz.wordList.filter(item => quiz.wrongRecords.includes(item.id));
      setActiveQuizReport({
        total: quiz.wordList.length,
        correct: quiz.score.correct,
        wrong: quiz.score.wrong,
        failures
      });
      setQuiz(prev => ({ ...prev, isActive: false }));
      setActiveTab('quiz-setup');
    }
  };

  // Letter by letter typing difference analyzer
  const renderInteractiveDiff = (user: string, correct: string) => {
    const cleanUser = user.trim().toLowerCase();
    const cleanCorrect = correct.trim().toLowerCase();
    
    return (
      <div className="flex flex-wrap items-center gap-1 font-mono text-lg mt-1 tracking-wide">
        {cleanCorrect.split('').map((char, index) => {
          const userChar = cleanUser[index];
          const isMatched = userChar === char;
          const bgClass = isMatched 
            ? "border-emerald-300 text-emerald-600 bg-emerald-50" 
            : "border-rose-300 text-rose-500 bg-rose-50 font-bold decoration-wavy line-through";
          
          return (
            <span key={index} className={`px-2 py-0.5 border rounded-md text-base ${bgClass}`}>
              {char}
            </span>
          );
        })}
        {cleanUser.length > cleanCorrect.length && (
          <span className="text-xs text-rose-400 font-sans ml-2">
            (输入超长)
          </span>
        )}
      </div>
    );
  };

  const masterCount = words.filter(w => w.correctTimes >= 3 && w.wrongTimes === 0).length;
  const needPracticeCount = words.filter(w => w.wrongTimes > 0).length;

  const filteredWords = words.filter(w => {
    const term = searchQuery.toLowerCase();
    return w.word.toLowerCase().includes(term) || w.translation.toLowerCase().includes(term);
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans" id="word-dictation-root">
      {/* Dynamic Toast System */}
      {notification && (
        <div 
          id="toast-notification"
          className={`fixed top-5 right-5 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border max-w-sm transition-all duration-300 transform animate-bounce ${
            notification.type === 'success' 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : notification.type === 'error' 
              ? 'bg-rose-50 border-rose-200 text-rose-800' 
              : 'bg-indigo-50 border-indigo-200 text-indigo-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          ) : notification.type === 'error' ? (
            <XCircle className="w-5 h-5 text-rose-500 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0" />
          )}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Top Banner Branding / Human Header */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40" id="main-app-header">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-600/10 rounded-2xl flex items-center justify-center border border-teal-600/20 shadow-sm">
              <BookOpen className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                智能单词默写本 <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 border border-teal-100 text-teal-700">AI Powered</span>
              </h1>
              <p className="text-xs text-slate-500">拍照导入 / 智能音标例句 / 自动发音 / 错词专项反复练</p>
            </div>
          </div>

          {/* Navigation Controls */}
          {(!quiz.isActive) && (
            <nav className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl border border-slate-200/40" id="navigation-rail">
              <button
                id="tab-btn-vocab"
                onClick={() => setActiveTab('vocab')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'vocab' 
                    ? 'bg-white text-teal-700 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                <Library className="w-4 h-4 stroke-[2.2]" />
                我的词库
              </button>
              <button
                id="tab-btn-quiz"
                onClick={() => setActiveTab('quiz-setup')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'quiz-setup' 
                    ? 'bg-white text-teal-700 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                <Play className="w-4 h-4 stroke-[2.2]" />
                单词默写
              </button>
              <button
                id="tab-btn-mistakes"
                onClick={() => setActiveTab('mistakes')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all relative ${
                  activeTab === 'mistakes' 
                    ? 'bg-white text-teal-700 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                <AlertCircle className="w-4 h-4 stroke-[2.2]" />
                错词复习
                {needPracticeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1 text-[10px] w-5 h-5 flex items-center justify-center font-bold bg-rose-500 text-white rounded-full border-2 border-white scale-90">
                    {needPracticeCount}
                  </span>
                )}
              </button>
            </nav>
          )}

          {quiz.isActive && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-rose-500 font-semibold uppercase px-2 py-1 rounded bg-rose-50 border border-rose-100 flex items-center gap-1 animate-pulse">
                🔴 默写会话进行中
              </span>
              <button 
                id="exit-quiz-btn"
                onClick={() => {
                  if (confirm("确定要提前结束本次单词默写吗？未完成词将不会记入正确率。")) {
                    setQuiz(prev => ({ ...prev, isActive: false }));
                    setActiveTab('quiz-setup');
                    showToast("已退出默写", "info");
                  }
                }}
                className="text-xs text-slate-500 hover:text-rose-600 transition-colors border border-slate-200 bg-white hover:bg-rose-50 py-1.5 px-3 rounded-lg"
              >
                提前退场
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8" id="primary-app-container">
        
        {/* VIEW: Vocabulary Bank */}
        {activeTab === 'vocab' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="view-vocabulary-bank">
            {/* Left Side: Addition Zone */}
            <section className="lg:col-span-5 space-y-6" id="add-vocabulary-section">
              {/* Photo OCR Card Upload */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl -mr-6 -mt-6"></div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-teal-600" />
                    拍照 / 图像导入生词
                  </h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60 font-medium">推荐</span>
                </div>
                <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                  拍摄单词书、手写错词表或平板截图，AI 会智能检测所有可见单词，自动生成其正规国际音标、中文释义和语境例句。
                </p>

                {/* Dropzone Container */}
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 cursor-pointer flex flex-col items-center justify-center min-h-[160px] ${
                    isOcrLoading 
                      ? 'border-teal-400 bg-teal-50/20' 
                      : 'border-slate-300 hover:border-teal-500 hover:bg-slate-50'
                  }`}
                  id="ocr-upload-dropzone"
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImageFileChange} 
                    accept="image/*" 
                    className="hidden" 
                  />

                  {isOcrLoading ? (
                    <div className="space-y-3 flex flex-col items-center py-2">
                      <RefreshCw className="w-8 h-8 text-teal-600 animate-spin" />
                      <div>
                        <p className="text-sm font-semibold text-teal-800">Gemini 正在分析照片中...</p>
                        <p className="text-[11px] text-slate-500 mt-1">提取单词并生成发音、释义、场景例句，请静候 5-10 秒</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 py-2">
                      <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center mx-auto text-teal-600 shadow-sm">
                        <Plus className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <div className="pt-2">
                        <span className="text-sm font-semibold text-slate-700">点击上传 或 拖拽照片到此</span>
                        <p className="text-xs text-slate-400 mt-1">支持 JPEG, PNG, WEBP 等常见格式</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Manual Entry Form */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
                <h2 className="font-bold text-slate-900 text-base flex items-center gap-2 mb-2">
                  <Plus className="w-5 h-5 text-teal-600" />
                  手动输入英文单词
                </h2>
                <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                  直接输入拼写，支持批量输入(用空格、逗号或回车分隔多个单词)。AI 同样会自动查询生成音标及例句。
                </p>

                <form onSubmit={handleManualImportSubmit} className="space-y-4" id="manual-import-form">
                  <div className="relative">
                    <textarea
                      id="manual-words-textarea"
                      rows={3}
                      value={manualInputValue}
                      onChange={(e) => setManualInputValue(e.target.value)}
                      placeholder="例如: evaluate, transform, magnificent"
                      disabled={manualLoading}
                      className="w-full px-4 py-3 text-sm rounded-xl border border-slate-300 focus:border-teal-500 focus:outline-none placeholder:text-slate-400 transition-colors bg-slate-50/50"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={manualLoading || isOcrLoading || !manualInputValue.trim()}
                    className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    {manualLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        正在为您配置词书词典...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                        AI 智能生成并导入生词
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Overview Summary Panel */}
              <div className="bg-gradient-to-br from-teal-550 to-emerald-600 rounded-2xl p-6 text-white shadow-sm flex flex-col justify-between min-h-[140px] relative overflow-hidden bg-slate-900">
                <div className="absolute bottom-0 right-0 opacity-10 translate-x-3 translate-y-3">
                  <Award className="w-36 h-36" />
                </div>
                <div className="relative z-10">
                  <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider">我的词词库盘点</span>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-4xl font-extrabold tracking-tight" id="vocab-total-count">{words.length}</span>
                    <span className="text-sm font-medium text-slate-300">个生词累积</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6 border-t border-white/15 pt-3 relative z-10">
                  <div>
                    <span className="text-[10px] text-slate-400 block">已牢记 (熟练词)</span>
                    <span className="text-sm font-bold text-teal-400" id="vocab-mastered-count">{masterCount} 个</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">错词记录本</span>
                    <span className="text-sm font-bold text-rose-400" id="vocab-mistake-count">{needPracticeCount} 个</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Right Side: List & Directory Search */}
            <section className="lg:col-span-7 flex flex-col" id="vocabulary-directory-section">
              <div className="bg-white border border-slate-200/80 rounded-2xl flex-1 flex flex-col max-h-[700px] overflow-hidden shadow-sm">
                
                {/* Search Header toolbar */}
                <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="搜索单词或中文释义..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 bg-white"
                    />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <span className="text-xs text-slate-500" id="search-results-info">
                      共筛选出 <strong className="text-slate-900">{filteredWords.length}</strong> 个词条
                    </span>
                    {words.length > 0 && (
                      <button
                        onClick={() => {
                          if (confirm("确定要清空您的所有词库内容吗？此操作不可撤销，错词记录也将归零。")) {
                            saveWordsToStore([]);
                            showToast("词库已全部清空", "info");
                          }
                        }}
                        className="text-xs text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-rose-100 transition-colors"
                      >
                        清空
                      </button>
                    )}
                  </div>
                </div>

                {/* Words Content Box */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 min-h-[300px]" id="words-scroller-box">
                  {filteredWords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-8 text-center" id="words-empty-fallback">
                      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3 text-slate-400">
                        <Search className="w-6 h-6" />
                      </div>
                      <h3 className="font-semibold text-slate-700 text-sm">未能找到相关单词</h3>
                      <p className="text-xs text-slate-400 max-w-xs mt-1">
                        {words.length === 0 ? "您的单词本还是空的，快从左边手动输入或拍照导入吧！" : "请尝试更换搜索关键字重试。"}
                      </p>
                    </div>
                  ) : (
                    filteredWords.map((wordItem, idx) => (
                      <div 
                        key={wordItem.id} 
                        className="p-5 hover:bg-slate-50/80 transition-all flex items-start gap-4"
                        id={`word-row-${wordItem.id}`}
                      >
                        {/* Word Details block */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <h3 className="text-base font-bold text-slate-900 tracking-tight" id={`word-text-${wordItem.id}`}>{wordItem.word}</h3>
                            <span className="text-xs font-mono text-slate-400 select-all" id={`word-phonetic-${wordItem.id}`}>{wordItem.phonetic}</span>
                            
                            {/* Speech Button */}
                            <button
                              id={`speak-btn-${wordItem.id}`}
                              onClick={() => speakWord(wordItem.word)}
                              className="text-slate-400 hover:text-teal-600 transition-colors p-1 rounded hover:bg-slate-200/50"
                              title="播放发音"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {/* Translation */}
                          <p className="text-sm font-medium text-slate-700" id={`word-trans-${wordItem.id}`}>{wordItem.translation}</p>

                          {/* Live Example Sentence card */}
                          <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-lg text-xs space-y-1">
                            <p className="text-slate-600 leading-relaxed font-sans flex items-start gap-1">
                              <span className="text-[10px] font-bold px-1 py-0.2 rounded bg-slate-200 text-slate-500 uppercase mt-0.5 scale-90">例句</span>
                              <span id={`word-sentence-${wordItem.id}`}>
                                {wordItem.sentence}
                              </span>
                              <button
                                onClick={() => speakSentence(wordItem.sentence)}
                                className="text-slate-400 hover:text-slate-600 p-0.5 rounded ml-1"
                                title="播放例句发音"
                              >
                                <Volume2 className="w-3 h-3" />
                              </button>
                            </p>
                            <p className="text-slate-400" id={`word-sentence-trans-${wordItem.id}`}>{wordItem.sentenceTranslation}</p>
                          </div>

                          {/* History stats indicator */}
                          <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-1">
                            <span>
                              正确: <strong className="text-emerald-600">{wordItem.correctTimes}次</strong>
                            </span>
                            <span>
                              错误: <strong className="text-rose-500">{wordItem.wrongTimes}次</strong>
                            </span>
                            {wordItem.lastTestedAt && (
                              <span>
                                上次背记: {new Date(wordItem.lastTestedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions Delete bar */}
                        <button
                          id={`del-btn-${wordItem.id}`}
                          onClick={() => deleteWord(wordItem.id, wordItem.word)}
                          className="text-slate-350 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all self-start"
                          title="移出词本"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>
          </div>
        )}

        {/* VIEW: Spelling Quiz Config / Setup Screen */}
        {activeTab === 'quiz-setup' && (
          <div className="max-w-2xl mx-auto space-y-6" id="view-quiz-setup">
            {/* Last Quiz Session report wrapper */}
            {activeQuizReport && (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4" id="quiz-result-report">
                <div className="flex items-center gap-2 text-teal-700">
                  <Award className="w-5 h-5" />
                  <h2 className="font-bold text-base text-slate-900">本次默写成绩报告</h2>
                </div>

                <div className="grid grid-cols-3 gap-3 text-center py-2.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <span className="text-[10px] text-slate-400 block">测试词数</span>
                    <strong className="text-xl text-slate-800" id="report-total">{activeQuizReport.total}</strong>
                  </div>
                  <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                    <span className="text-[10px] text-emerald-600 block">全对拼写</span>
                    <strong className="text-xl text-emerald-650" id="report-correct">{activeQuizReport.correct}</strong>
                  </div>
                  <div className="bg-rose-50/30 p-3 rounded-xl border border-rose-100/30">
                    <span className="text-[10px] text-rose-500 block">错误归档</span>
                    <strong className="text-xl text-rose-600" id="report-wrong">{activeQuizReport.wrong}</strong>
                  </div>
                </div>

                {activeQuizReport.failures.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-slate-500">❌ 仍需强化的错词 ({activeQuizReport.failures.length})：</h3>
                    <div className="max-h-36 overflow-y-auto border border-rose-100 bg-rose-50/10 rounded-xl p-3 divide-y divide-rose-100/30" id="report-failures-list">
                      {activeQuizReport.failures.map(item => (
                        <div key={item.id} className="py-2 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-bold text-slate-800 font-mono">{item.word}</span>
                            <span className="text-slate-450 ml-2 font-mono text-[10px]">{item.phonetic}</span>
                            <p className="text-slate-500 text-[10px] mt-0.5">{item.translation}</p>
                          </div>
                          
                          <button
                            onClick={() => speakWord(item.word)}
                            className="p-1 hover:bg-slate-200/50 rounded text-slate-400 hover:text-teal-600"
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-50 rounded-xl p-4 flex items-center justify-center gap-2 border border-emerald-100 text-center" id="report-perfect">
                    <Smile className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-800">完美通关！当前默写百分百正确，继续保持！</span>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    id="retry-failed-btn"
                    disabled={activeQuizReport.failures.length === 0}
                    onClick={() => {
                      // Custom session targeting only failures
                      const shuffleFailures = [...activeQuizReport.failures].sort(() => 0.5 - Math.random());
                      setQuiz({
                        isActive: true,
                        wordList: shuffleFailures,
                        currentIndex: 0,
                        userAnswer: '',
                        showFeedback: false,
                        feedbackStatus: null,
                        revealedProgress: false,
                        score: { correct: 0, wrong: 0 },
                        wrongRecords: []
                      });
                      setActiveQuizReport(null);
                      setActiveTab('quiz-active');
                    }}
                    className="flex-1 py-2.5 px-4 bg-teal-650 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-40 disabled:hover:bg-teal-650 flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    专项再练一遍这些错词
                  </button>
                  <button
                    id="dismiss-report-btn"
                    onClick={() => setActiveQuizReport(null)}
                    className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-colors"
                  >
                    好的，知道啦
                  </button>
                </div>
              </div>
            )}

            {/* General Quiz Setup Card */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h2 className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                    <Play className="w-5 h-5 text-teal-600 fill-teal-50" />
                    启动全新默写测试
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">定制适合您习惯的默写环境</p>
                </div>
                <BookOpen className="w-8 h-8 text-teal-600/10 shrink-0" />
              </div>

              <div className="space-y-5">
                {/* Setting: Source select */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 block">选取生词来源</label>
                  <div className="grid grid-cols-3 gap-2" id="quiz-source-selector">
                    <button
                      id="opt-src-all"
                      type="button"
                      onClick={() => setQuizSettings(prev => ({ ...prev, source: 'all' }))}
                      className={`py-3 px-3 border text-xs font-semibold rounded-xl text-center transition-all ${
                        quizSettings.source === 'all'
                          ? 'border-teal-600 bg-teal-50/50 text-teal-700 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      全部词库 ({words.length})
                    </button>
                    <button
                      id="opt-src-mistakes"
                      type="button"
                      onClick={() => setQuizSettings(prev => ({ ...prev, source: 'mistakes' }))}
                      className={`py-3 px-3 border text-xs font-semibold rounded-xl text-center transition-all ${
                        quizSettings.source === 'mistakes'
                          ? 'border-teal-600 bg-teal-50/50 text-teal-700 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      错词优先 ({needPracticeCount})
                    </button>
                    <button
                      id="opt-src-recent"
                      type="button"
                      onClick={() => setQuizSettings(prev => ({ ...prev, source: 'recent' }))}
                      className={`py-3 px-3 border text-xs font-semibold rounded-xl text-center transition-all ${
                        quizSettings.source === 'recent'
                          ? 'border-teal-600 bg-teal-50/50 text-teal-700 shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      最新导入优先
                    </button>
                  </div>
                </div>

                {/* Setting: Limit slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="font-bold text-slate-700">本次测试额度</label>
                    <span className="font-semibold text-teal-600">{quizSettings.limit} 个单词</span>
                  </div>
                  <input
                    type="range"
                    min="3"
                    max="100"
                    step="1"
                    value={quizSettings.limit}
                    onChange={(e) => setQuizSettings(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
                    className="w-full accent-teal-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
                    id="quiz-limit-range"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>最少 3 个</span>
                    <span>最多 100 个</span>
                  </div>
                </div>

                {/* Setting: Clues checkboxes */}
                <div className="space-y-2 border-t border-slate-150 pt-3">
                  <label className="text-xs font-bold text-slate-700 block">默写线索开关</label>
                  <p className="text-[11px] text-slate-400 mt-1 leading-normal">
                    可自由关闭或开启线索。如果只留下“自动发音”，即可挑战完完全全的纯听力盲听默写学霸模式。
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:bg-slate-55 bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={quizSettings.showChinese}
                        onChange={(e) => setQuizSettings(prev => ({ ...prev, showChinese: e.target.checked }))}
                        className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                        id="clue-chinese-toggle"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">显示中文提示</span>
                        <span className="text-[10px] text-slate-400">显示主要释义</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:bg-slate-55 bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={quizSettings.showPhonetic}
                        onChange={(e) => setQuizSettings(prev => ({ ...prev, showPhonetic: e.target.checked }))}
                        className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                        id="clue-phonetic-toggle"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">显示国际音标</span>
                        <span className="text-[10px] text-slate-400">显示 IPA 发音标识</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:bg-slate-55 bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={quizSettings.showSentenceBlank}
                        onChange={(e) => setQuizSettings(prev => ({ ...prev, showSentenceBlank: e.target.checked }))}
                        className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                        id="clue-sentence-toggle"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">显示例句填空</span>
                        <span className="text-[10px] text-slate-400">词汇镂空的情景例句</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-100 hover:bg-slate-55 bg-slate-50 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={quizSettings.autoSpeak}
                        onChange={(e) => setQuizSettings(prev => ({ ...prev, autoSpeak: e.target.checked }))}
                        className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500"
                        id="clue-autospeak-toggle"
                      />
                      <div>
                        <span className="font-bold text-slate-800 block">进入时自动发音</span>
                        <span className="text-[10px] text-slate-400">切换单词时自动朗读</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  id="start-quiz-submit-btn"
                  onClick={() => handleSetupQuiz(false)}
                  className="w-full py-3.5 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow hover:translate-y-[-1px] active:translate-y-[0] transition-all cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-white stroke-[2.5]" />
                  开始默写
                </button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW: Active Spelling Session */}
        {activeTab === 'quiz-active' && quiz.isActive && (
          <div className="max-w-2xl mx-auto" id="view-active-quiz">
            {/* Progress indicators Header */}
            <div className="flex items-center justify-between mb-4 px-2">
              <span className="text-xs font-bold text-slate-500">
                进度：<strong className="text-slate-800">{quiz.currentIndex + 1}</strong> / {quiz.wordList.length} 单词
              </span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-emerald-600 font-bold">对: {quiz.score.correct}</span>
                <span className="text-rose-500 font-bold">错: {quiz.score.wrong}</span>
              </div>
            </div>

            {/* Slider bar of progress */}
            <div className="w-full h-2 bg-slate-200 rounded-full mb-6 overflow-hidden">
              <div 
                className="h-full bg-teal-600 transition-all duration-300 rounded-full"
                style={{ width: `${((quiz.currentIndex + 1) / quiz.wordList.length) * 100}%` }}
                id="quiz-progress-indicator-bar"
              ></div>
            </div>

            {/* Core Spelling Panel Card */}
            <div className={`bg-white border rounded-2xl p-6 md:p-8 shadow-sm transition-all duration-300 ${
              quiz.showFeedback 
                ? quiz.feedbackStatus === 'correct' 
                  ? 'border-emerald-300 shadow-emerald-50/50 bg-emerald-50/10' 
                  : 'border-rose-300 shadow-rose-50/50 bg-rose-50/5'
                : 'border-slate-200'
            }`} id="quiz-spelling-canvas">
              
              {/* Question clues wrapper */}
              <div className="flex flex-col items-center text-center space-y-6 mb-8">
                
                {/* Chinese definition translation */}
                {quizSettings.showChinese && (
                  <div className="space-y-1">
                    <span className="text-[10px] text-teal-600 font-bold uppercase tracking-wider block bg-teal-50 px-2.5 py-0.5 rounded-full mx-auto w-max border border-teal-100/50">词意提示</span>
                    <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 pt-1" id="quiz-clue-trans">
                      {quiz.wordList[quiz.currentIndex].translation}
                    </h2>
                  </div>
                )}

                {/* Phonics transcription */}
                {quizSettings.showPhonetic && (
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="text-sm font-mono text-slate-400 bg-slate-100 px-3 py-1 rounded-lg" id="quiz-clue-phonetic">
                      {quiz.wordList[quiz.currentIndex].phonetic}
                    </span>
                    <button
                      id="quiz-pronounce-btn"
                      onClick={() => speakWord(quiz.wordList[quiz.currentIndex].word)}
                      className="p-1 px-2 text-slate-500 hover:text-teal-600 hover:bg-slate-150 rounded"
                      title="重播发音"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  </div>
                )}

                {/* Example sentence blank box */}
                {quizSettings.showSentenceBlank && (
                  <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl max-w-lg w-full">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">- 语境例句填空 -</span>
                    <p className="text-sm text-slate-700 italic leading-relaxed" id="quiz-clue-sentence">
                      {getMaskedSentence(quiz.wordList[quiz.currentIndex].sentence, quiz.wordList[quiz.currentIndex].word)}
                    </p>
                    <p className="text-xs text-slate-400 mt-2" id="quiz-clue-sentence-trans">
                      {quiz.wordList[quiz.currentIndex].sentenceTranslation}
                    </p>
                  </div>
                )}

                {!quizSettings.showChinese && !quizSettings.showPhonetic && !quizSettings.showSentenceBlank && (
                  <div className="py-6 space-y-2">
                    <Volume2 className="w-12 h-12 text-teal-600 animate-pulse mx-auto" />
                    <p className="text-sm font-semibold text-slate-700">🎧 纯听力默写模式开启中</p>
                    <button 
                      onClick={() => speakWord(quiz.wordList[quiz.currentIndex].word)}
                      className="px-4 py-1.5 bg-slate-100 text-xs font-bold hover:bg-slate-250 text-slate-600 rounded-lg transition-colors inline-block"
                    >
                      再次播放发音 (音频)
                    </button>
                  </div>
                )}
              </div>

              {/* Input Form container */}
              <form onSubmit={handleAnswerSubmit} className="space-y-2 max-w-md mx-auto" id="quiz-interactive-form">
                <div className="relative">
                  <input
                    type="text"
                    ref={answerInputRef}
                    disabled={quiz.showFeedback}
                    value={quiz.userAnswer}
                    onChange={(e) => setQuiz(prev => ({ ...prev, userAnswer: e.target.value }))}
                    placeholder="输入该单词的正确英文拼写"
                    className={`w-full text-center px-4 py-3.5 text-lg font-mono font-bold tracking-wide rounded-xl border-2 focus:outline-none transition-all ${
                      quiz.showFeedback
                        ? quiz.feedbackStatus === 'correct'
                          ? 'border-emerald-500 bg-emerald-100/30 text-emerald-800'
                          : 'border-rose-400 bg-rose-100/20 text-rose-800'
                        : 'border-slate-300 focus:border-teal-600 bg-slate-50/50'
                    }`}
                    id="quiz-spelling-input"
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck="false"
                    autoFocus
                  />
                  
                  {/* Help letters hint trigger */}
                  {!quiz.showFeedback && (
                    <button
                      type="button"
                      onClick={() => {
                        const target = quiz.wordList[quiz.currentIndex].word;
                        // Provide first 2 letters
                        const hint = target.substring(0, 2) + "•".repeat(target.length - 2);
                        showToast(`求助提示: 首字母是 "${target.substring(0, 2)}" (长度 ${target.length}位)`, "info");
                        setQuiz(prev => ({ ...prev, revealedProgress: true, userAnswer: target.substring(0, 2) }));
                        if (answerInputRef.current) answerInputRef.current.focus();
                      }}
                      className="absolute right-3 top-3 text-slate-450 hover:text-slate-650 p-1"
                      title="求助提示"
                    >
                      <Lightbulb className="w-4.5 h-4.5" />
                    </button>
                  )}
                </div>

                {/* Feedback state cards */}
                {quiz.showFeedback && (
                  <div className="pt-2 animate-fadeIn" id="quiz-evaluation-feedback">
                    {quiz.feedbackStatus === 'correct' ? (
                      <div className="bg-emerald-50 border border-emerald-150 p-3.5 rounded-xl flex items-center gap-2.5 text-emerald-800 text-xs">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <div>
                          <strong className="font-bold font-mono text-emerald-700">拼写正确！十分完美。</strong>
                          <p className="text-emerald-500 mt-0.5">继续保持这般精确度！</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-rose-50 border border-rose-150 p-4 rounded-xl space-y-2 text-xs">
                        <div className="flex items-start gap-2.5">
                          <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <strong className="font-bold text-rose-700">拼写有误。</strong>
                            <span className="text-slate-500 ml-1">正确拼写为：</span>
                            <span className="px-2 py-0.5 font-mono text-sm bg-rose-100 text-rose-600 font-extrabold rounded select-all ml-1 block w-max my-1">
                              {quiz.wordList[quiz.currentIndex].word}
                            </span>
                          </div>
                        </div>

                        {/* Interactive analytical comparison */}
                        <div className="border-t border-rose-100 pt-2 mt-1">
                          <span className="text-[10px] text-slate-400 block mb-1">拼写差异分析：</span>
                          {renderInteractiveDiff(quiz.userAnswer, quiz.wordList[quiz.currentIndex].word)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Navigation actions bar */}
                <div className="flex items-center gap-3 pt-4">
                  {!quiz.showFeedback ? (
                    <>
                      <button
                        type="button"
                        onClick={handleSkipQuestion}
                        className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-sm font-semibold transition-all"
                        id="quiz-skip-btn"
                      >
                        不会拼，跳过
                      </button>
                      <button
                        type="submit"
                        disabled={!quiz.userAnswer.trim()}
                        className="flex-1 py-3 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold shadow transition-all cursor-pointer disabled:opacity-40"
                        id="quiz-submit-btn"
                      >
                        确认提交 (回车)
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      id="quiz-next-btn"
                      onClick={advanceQuiz}
                      className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow"
                      autoFocus
                    >
                      {quiz.currentIndex + 1 < quiz.wordList.length ? (
                        <>
                          下一个单词
                          <ArrowRight className="w-4 h-4" />
                        </>
                      ) : (
                        <>
                          完成默写，查看报告
                          <Award className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* VIEW: Mistakes Review Booklet */}
        {activeTab === 'mistakes' && (
          <div className="space-y-6 animate-fadeIn" id="view-mistake-booklet">
            {/* Header statistics bar */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1.5 text-center md:text-left">
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center justify-center md:justify-start gap-2">
                  <AlertCircle className="w-5 h-5 text-rose-500" />
                  错词红墨水记录本
                </h2>
                <p className="text-xs text-slate-500 max-w-sm">
                  凡是在默写中拼错的单词，都会自动追加到本栏目下。错词在后续测试中连续拼对 3 次将自动从本记录移出！
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-600">
                  当前累计错词：<strong className="text-rose-500 font-black text-sm">{needPracticeCount}</strong> 个
                </span>
                
                <button
                  id="start-review-mistakes-now"
                  disabled={needPracticeCount === 0}
                  onClick={() => handleSetupQuiz(true)}
                  className="py-2.5 px-4 bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold rounded-xl shadow-sm transition-all disabled:opacity-40 disabled:hover:bg-rose-500 flex items-center gap-1 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  错词专项突击
                </button>
              </div>
            </div>

            {/* Grid of Mistake cards */}
            {words.filter(w => w.wrongTimes > 0).length === 0 ? (
              <div className="bg-white border border-slate-200/80 rounded-2xl p-16 text-center space-y-4 shadow-sm" id="mistakes-empty-container">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner border border-emerald-100">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">恭喜，暂无未掌握错词！</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    看来您的拼写功底非常扎实。去词库导入更多有挑战性的生词吧！
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="mistakes-grid-container">
                {words.filter(w => w.wrongTimes > 0).map(word => (
                  <div 
                    key={word.id} 
                    className="bg-white border border-slate-200/80 rounded-xl p-5 shadow-sm hover:shadow hover:border-rose-200 transition-all flex justify-between gap-3 relative overflow-hidden"
                    id={`mistake-card-${word.id}`}
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-base font-extrabold text-slate-900 tracking-tight font-mono">{word.word}</span>
                        <span className="text-xs font-mono text-slate-400">{word.phonetic}</span>
                        <button
                          onClick={() => speakWord(word.word)}
                          className="text-slate-400 hover:text-teal-600 transition-colors p-0.5 rounded ml-0.5"
                          title="播放音频"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <p className="text-xs font-medium text-slate-800">{word.translation}</p>

                      <div className="bg-slate-50 border border-slate-100 p-2 rounded text-[11px] text-slate-500 block leading-relaxed">
                        <strong className="text-[9px] font-bold text-slate-400 block border-b border-slate-200/60 pb-1 mb-1 italic">
                          情景例句：
                        </strong>
                        <p>{word.sentence}</p>
                        <p className="text-slate-400 mt-1">{word.sentenceTranslation}</p>
                      </div>

                      {/* Incorrect count block */}
                      <div className="flex items-center gap-3 pt-1 text-[10px]">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                          累计拼错：<strong className="text-rose-500 font-bold">{word.wrongTimes}次</strong>
                        </span>
                        <span className="text-slate-450">
                          拼对通过：<strong className="text-emerald-600 font-bold">{word.correctTimes}/3</strong> (满3次移出)
                        </span>
                      </div>
                    </div>

                    {/* Quick remove from mistake button */}
                    <button
                      onClick={() => {
                        if (confirm(`确定要手动清除 "${word.word}" 的错误拼写次数记录吗？这会将其从错词集中移出。`)) {
                          const updated = words.map(w => {
                            if (w.id === word.id) {
                              return { ...w, wrongTimes: 0, correctTimes: 0 };
                            }
                            return w;
                          });
                          saveWordsToStore(updated);
                          showToast(`已重置单词 "${word.word}" 的错词统计`, "info");
                        }
                      }}
                      className="text-slate-300 hover:text-rose-600 hover:bg-rose-50 p-1 rounded-md self-start transition-all"
                      title="清除错误记录"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* Decorative Brand footer */}
      <footer className="bg-white border-t border-slate-200/50 py-6 text-center text-xs text-slate-400 select-none mt-auto" id="application-footer">
        <p>© 2026 Word Dictation App • AI 辅助高效记忆与拼写反馈本</p>
      </footer>
    </div>
  );
}
