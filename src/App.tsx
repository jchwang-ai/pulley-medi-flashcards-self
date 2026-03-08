import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import {
  BookOpen,
  Plus,
  Upload,
  Trophy,
  Users,
  BarChart2,
  Settings,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Volume2,
  Flame,
  MoreVertical,
  ArrowLeft,
  HelpCircle,
  ChevronLeft,
  Pencil,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Card {
  id?: number;
  term: string;
  meaning: string;
  example?: string;
  category?: string;
  difficulty?: string;
  source?: string;
  deckId?: number;
}

interface Deck {
  id: number;
  title: string;
  description: string;
  category: string;
  cardCount: number;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
  previewCards: { term: string }[];
  words: { term: string; meaning: string; example: string }[];
}

interface User {
  id: number;
  name: string;
  xp: number;
  streak: number;
}

const Button = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) => {
  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary: 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm',
    outline: 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg font-medium',
  };

  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const CardUI = ({
  children,
  className,
  onClick
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) => (
  <div
    className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col', className)}
    onClick={onClick}
  >
    {children}
  </div>
);

const ProgressBar = ({ progress, color = 'bg-indigo-600' }: { progress: number; color?: string }) => (
  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${progress}%` }}
      className={cn('h-full transition-all duration-500', color)}
    />
  </div>
);

export default function App() {
  const [view, setView] = useState<'home' | 'decks' | 'study' | 'groups' | 'reports' | 'upload' | 'auth'>('auth');
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleAuth = async () => {
    setIsAuthLoading(true);
    setAuthError(null);
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail, password: authPassword, name: authName }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        if (authMode === 'login') {
          setToken(data.token);
          localStorage.setItem('token', data.token);
          setView('home');
        } else {
          setAuthMode('login');
          alert(data?.message || '회원가입이 완료되었습니다. 로그인해주세요.');
        }
      } else {
        setAuthError(data?.message || data?.error || '인증 실패');
      }
    } catch (error) {
      console.error('Auth error:', error);
      setAuthError('서버 연결 중 오류가 발생했습니다.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const authFetch = (url: string, options: RequestInit = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    return fetch(url, { ...options, headers });
  };
  const [deckFilter, setDeckFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [uploadMode, setUploadMode] = useState<'file' | 'paste'>('paste');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [studyCards, setStudyCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [uploadData, setUploadData] = useState<Card[]>([{ term: '', meaning: '', example: '', category: '', difficulty: 'medium', source: '' }]);
  const [uploadMeta, setUploadMeta] = useState({ title: '', category: 'General' });
  const [activeMenuDeck, setActiveMenuDeck] = useState<Deck | null>(null);
  const [dailyGoal, setDailyGoal] = useState(() => {
    const saved = localStorage.getItem('dailyGoal');
    return saved ? Number(saved) : 10;
  });
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState(dailyGoal);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [studyDates, setStudyDates] = useState<string[]>(() => {
    const saved = localStorage.getItem('studyDates');
    return saved ? JSON.parse(saved) : [];
  });

  const [streak, setStreak] = useState(0);

  const calculateStreak = (dates: string[]) => {
    if (!dates.length) return 0;

    const uniqueDates = [...new Set(dates)].sort((a, b) => (a < b ? 1 : -1));
    let count = 0;

    const current = new Date();
    current.setHours(0, 0, 0, 0);

    for (let i = 0; i < uniqueDates.length; i++) {
      const expected = new Date(current);
      expected.setDate(current.getDate() - i);

      const expectedString = expected.toISOString().split('T')[0];

      if (uniqueDates[i] === expectedString) {
        count += 1;
      } else {
        break;
      }
    }

    return count;
  };

  const getMonthCalendarCells = (monthDate: Date, dates: string[]) => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    // Convert to 0 (Mon) - 6 (Sun)
    const startDay = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const cells = [];
    
    // Leading blanks
    for (let i = 0; i < startDay; i++) {
      cells.push({ day: null, dateString: null, isStudied: false, isCurrentMonth: false });
    }
    
    // Days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dateString = date.toISOString().split('T')[0];
      cells.push({
        day: i,
        dateString,
        isStudied: dates.includes(dateString),
        isCurrentMonth: true
      });
    }
    
    return cells;
  };

  const calendarCells = getMonthCalendarCells(currentMonth, studyDates);
  const studiedDaysInMonth = calendarCells.filter(c => c.isStudied).length;

  const changeMonth = (delta: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));
  };

  useEffect(() => {
    localStorage.setItem('studyDates', JSON.stringify(studyDates));
    setStreak(calculateStreak(studyDates));
  }, [studyDates]);

  const markStudyCompleteToday = () => {
    const today = getTodayString();
    setStudyDates(prev => {
      if (prev.includes(today)) return prev;
      return [...prev, today];
    });
  };

  useEffect(() => {
    localStorage.setItem('dailyGoal', String(dailyGoal));
    setTempGoal(dailyGoal);
  }, [dailyGoal]);
  const [feedbackStats, setFeedbackStats] = useState({ hard: 0, medium: 0, easy: 0 });
  const [sessionFeedback, setSessionFeedback] = useState<Map<number, 'easy' | 'medium' | 'hard'>>(new Map());
  const [originalStudyCards, setOriginalStudyCards] = useState<Card[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [reviewBuckets, setReviewBuckets] = useState<{ hard: Card[]; medium: Card[]; easy: Card[] }>(() => {
    const saved = localStorage.getItem('reviewBuckets');
    return saved
      ? JSON.parse(saved)
      : { hard: [], medium: [], easy: [] };
  });

  useEffect(() => {
    localStorage.setItem('reviewBuckets', JSON.stringify(reviewBuckets));
  }, [reviewBuckets]);

  useEffect(() => {
    if (view === 'upload' && uploadData.length === 0) {
      setUploadData([
        {
          term: '',
          meaning: '',
          example: '',
          category: '',
          difficulty: 'medium',
          source: ''
        }
      ]);
    }
  }, [view]);

  useEffect(() => {
    fetchUser();
    fetchDecks();
  }, []);

  useEffect(() => {
    if (view === 'home' || view === 'decks') {
      fetchUser();
      fetchDecks();
    }
  }, [view]);

  const fetchUser = async () => {
    try {
      const res = await authFetch('/api/user');
      if (!res.ok) {
        setToken(null);
        localStorage.removeItem('token');
        setView('auth');
        return;
      }
      const data = await res.json();
      setUser(data);
    } catch {
      setToken(null);
      localStorage.removeItem('token');
      setView('auth');
    }
  };

const fetchDecks = async () => {
  try {
    const res = await authFetch('/api/decks');
    if (!res.ok) {
      setDecks([]);
      return;
    }

    const data = await res.json();
    console.log('Fetched decks data:', data);

    const mappedDecks: Deck[] = (Array.isArray(data) ? data : []).map((deck: any) => {
      const words = Array.isArray(deck.words) ? deck.words : (typeof deck.words === 'string' ? JSON.parse(deck.words) : []);

      const easyCount = words.filter((w: any) => w.status === 'easy').length;
      const mediumCount = words.filter((w: any) => w.status === 'medium').length;
      const hardCount = words.filter((w: any) => w.status === 'hard').length;

      return {
        id: Number(deck.id),
        title: deck.name || '새 단어장',
        description: `${words.length}개의 단어가 포함된 단어장`,
        category: deck.category || 'General',
        cardCount: words.length,
        easyCount,
        mediumCount,
        hardCount,
        previewCards: words.slice(0, 3).map((w: any) => ({
          term: w?.term || '',
        })),
        words: words,
      };
    });

    setDecks(mappedDecks);
  } catch (error) {
    console.error('fetchDecks error:', error);
    setDecks([]);
  }
};

const startStudy = async (deckId?: number) => {
  try {
    setIsLoading(true);

    let studyTerms: any[] = [];

    if (deckId) {
      const selected = decks.find((d) => d.id === deckId);
      studyTerms = selected?.words || [];
    }

    const cards: Card[] = studyTerms.length
      ? studyTerms.map((p: any, index: number) => ({
          id: p.id || index + 1,
          term: p.term || '',
          meaning: p.meaning || '',
          example: p.example || '',
          category: p.category || '',
          difficulty: p.difficulty || 'medium',
          source: p.source || '',
          deckId: deckId,
        }))
      : [
          {
            id: 1,
            term: 'Hypoxia',
            meaning: '저산소증',
            example: 'Cyanosis is a late sign of hypoxia.',
            deckId: deckId,
          },
          {
            id: 2,
            term: 'Bradycardia',
            meaning: '서맥',
            example: 'The patient developed bradycardia.',
            deckId: deckId,
          },
        ];

    setStudyCards(cards);
    setOriginalStudyCards(cards);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setView('study');
    setFeedbackStats({ hard: 0, medium: 0, easy: 0 });
    setSessionFeedback(new Map());
    setShowSummary(false);
    setIsFiltering(false);
    setFilteredCards([]);
  } catch (error) {
    console.error('[DEBUG] Study start error:', error);
    alert('학습을 시작하는 중 오류가 발생했습니다.');
  } finally {
    setIsLoading(false);
  }
};

  const handleFeedback = async (feedback: 'easy' | 'medium' | 'hard') => {
    const card = studyCards[currentCardIndex];
    if (!card) return;

    const oldFeedback = sessionFeedback.get(card.id || 0);

    setFeedbackStats((prev) => {
      const next = { ...prev };
      if (oldFeedback && next[oldFeedback] > 0) {
        next[oldFeedback] = next[oldFeedback] - 1;
      }
      next[feedback] = next[feedback] + 1;
      return next;
    });

    setReviewBuckets(prev => {
      const removeCard = (list: Card[]) => list.filter(item => item.id !== card.id);

      const next = {
        hard: removeCard(prev.hard),
        medium: removeCard(prev.medium),
        easy: removeCard(prev.easy),
      };

      next[feedback] = [...next[feedback], card];
      return next;
    });

    setSessionFeedback((prev) => new Map(prev).set(card.id || 0, feedback));

    try {
      await authFetch('/api/study/feedback', {
        method: 'POST',
        body: JSON.stringify({ cardId: card.id, feedback: feedback }),
      });
    } catch (error) {
      console.error('Failed to save feedback:', error);
    }

    if (currentCardIndex < studyCards.length - 1) {
      setCurrentCardIndex((prev) => prev + 1);
      setIsFlipped(false);
    } else {
      markStudyCompleteToday();
      setShowSummary(true);
    }
  };

  const [filteredCards, setFilteredCards] = useState<Card[]>([]);
  const [isFiltering, setIsFiltering] = useState(false);

  const restartStudy = (onlyReview: boolean, category?: 'hard' | 'medium' | 'easy') => {
    let cardsToStudy = originalStudyCards;

    if (onlyReview) {
      cardsToStudy = originalStudyCards.filter((card) => {
        const feedback = sessionFeedback.get(card.id || 0);
        return feedback === 'hard' || feedback === 'medium';
      });
    } else if (category) {
      cardsToStudy = originalStudyCards.filter((card) => sessionFeedback.get(card.id || 0) === category);
    }

    setStudyCards(cardsToStudy);
    setCurrentCardIndex(0);
    setShowSummary(false);
    setIsFlipped(false);
  };

  const showFilteredCards = (category: 'hard' | 'medium' | 'easy') => {
    const cardsToStudy = originalStudyCards.filter((card) => sessionFeedback.get(card.id || 0) === category);
    setFilteredCards(cardsToStudy);
    setIsFiltering(true);
    setShowSummary(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const mapped = data
        .map((item) => ({
          term: item.term || item.word || item['영단어'] || '',
          meaning: item.meaning || item.definition || item['뜻'] || '',
          example: item.example || item['예문'] || '',
          category: item.category || item['카테고리'] || '',
          difficulty: item.difficulty || item['난이도'] || 'medium',
          source: item.source || item['출처'] || '',
        }))
        .filter((c) => c.term && c.meaning);

      setUploadData(mapped);
      setUploadMeta((prev) => ({ ...prev, title: file.name.split('.')[0] }));
    };
    reader.readAsBinaryString(file);
  };

const saveDeck = async () => {
  if (!uploadMeta.title) {
    alert('단어장 제목을 입력해주세요.');
    return;
  }

  try {
    const validWords = uploadData.filter(
      (item) => item.term?.trim() && item.meaning?.trim()
    );

    const res = await authFetch('/api/decks', {
      method: 'POST',
      body: JSON.stringify({
        name: uploadMeta.title,
        category: uploadMeta.category,
        words: validWords
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('saveDeck error:', errorText);
      alert('단어장 저장 중 오류가 발생했습니다.');
      return;
    }

    await fetchDecks();
    setView('decks');

    setUploadData([
      { term: '', meaning: '', example: '', category: '', difficulty: 'medium', source: '' }
    ]);

    setUploadMeta({ title: '', category: 'General' });

  } catch (error) {
    console.error('saveDeck error:', error);
    alert('단어장 저장 중 오류가 발생했습니다.');
  }
};

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  const startReviewFromBucket = (type: 'hard' | 'medium' | 'easy') => {
    const cards = reviewBuckets[type] || [];
    if (cards.length === 0) {
      alert('학습할 카드가 없습니다.');
      return;
    }

    setStudyCards(cards);
    setOriginalStudyCards(cards);
    setCurrentCardIndex(0);
    setIsFlipped(false);
    setView('study');
    setFeedbackStats({ hard: 0, medium: 0, easy: 0 });
    setSessionFeedback(new Map());
    setShowSummary(false);
  };

  const renderHome = () => {
    const totalWords = Array.isArray(decks) ? decks.reduce((acc, deck) => acc + (deck.cardCount || 0), 0) : 0;
    const easyWords = Array.isArray(reviewBuckets?.easy) ? reviewBuckets.easy.length : 0;
    const hardWords = Array.isArray(reviewBuckets?.hard) ? reviewBuckets.hard.length : 0;
    const mediumWords = Array.isArray(reviewBuckets?.medium) ? reviewBuckets.medium.length : 0;
    const unstudiedWords = Math.max(0, totalWords - (easyWords + hardWords + mediumWords));

    const completedDecks = Array.isArray(decks) ? decks.filter(deck => {
      const progress = getDeckProgress(deck.id, deck.cardCount || 0);
      return progress.easy === (deck.cardCount || 0) && (deck.cardCount || 0) > 0;
    }).length : 0;
    const activeDecks = Array.isArray(decks) ? decks.filter(deck => {
      const progress = getDeckProgress(deck.id, deck.cardCount || 0);
      return progress.easy < (deck.cardCount || 0) && (deck.cardCount || 0) > 0;
    }).length : 0;
    const notStartedDecks = Array.isArray(decks) ? decks.filter(deck => {
      const progress = getDeckProgress(deck.id, deck.cardCount || 0);
      return (deck.cardCount || 0) > 0 && progress.easy === 0 && progress.medium === 0 && progress.hard === (deck.cardCount || 0);
    }).length : 0;

    const unstudiedPercent = totalWords > 0 ? (unstudiedWords / totalWords) * 100 : 0;
    const unknownPercent = totalWords > 0 ? (hardWords / totalWords) * 100 : 0;
    const confusingPercent = totalWords > 0 ? (mediumWords / totalWords) * 100 : 0;
    const knownPercent = totalWords > 0 ? (easyWords / totalWords) * 100 : 0;

    return (
      <div className="space-y-8">
        {/* 1. Greeting + Learning streak + AI Coach */}
        <div className="flex flex-col md:flex-row gap-6">
          <header className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">안녕하세요, {user?.name || 'Nursing Student'}!</h1>
            <div className="flex items-center gap-1.5 text-indigo-600 font-bold mt-2 bg-indigo-50 px-3 py-1.5 rounded-full w-fit">
              <Flame className="w-5 h-5" />
              <span>{streak}일 연속 학습 중! 학습 습관이 만들어지고 있어요.</span>
            </div>
          </header>
          <CardUI className="p-4 bg-slate-50 border-slate-100 flex-1">
            <p className="text-sm text-slate-600 font-medium">오늘은 헷갈리는 단어 5개만 더 복습하면 이번 주 목표를 달성할 수 있어요!</p>
          </CardUI>
        </div>

        {/* 2. Learning Status Summary */}
        <CardUI className="p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">나의 단어 이해 상태</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#E5E7EB] p-4 rounded-xl cursor-pointer hover:opacity-90 transition-opacity" onClick={() => { setView('decks'); setDeckFilter('active'); }}>
              <div className="text-sm text-slate-600 font-bold">미학습</div>
              <div className="text-3xl font-bold text-slate-900">{unstudiedWords}</div>
            </div>
            <div className="bg-[#9CA3AF] p-4 rounded-xl cursor-pointer hover:opacity-90 transition-opacity" onClick={() => startReviewFromBucket('hard')}>
              <div className="text-sm text-white font-bold">모르겠음</div>
              <div className="text-3xl font-bold text-white">{hardWords}</div>
            </div>
            <div className="bg-[#F59E0B] p-4 rounded-xl cursor-pointer hover:opacity-90 transition-opacity" onClick={() => startReviewFromBucket('medium')}>
              <div className="text-sm text-white font-bold">헷갈림</div>
              <div className="text-3xl font-bold text-white">{mediumWords}</div>
            </div>
            <div className="bg-[#10B981] p-4 rounded-xl cursor-pointer hover:opacity-90 transition-opacity" onClick={() => startReviewFromBucket('easy')}>
              <div className="text-sm text-white font-bold">알겠음</div>
              <div className="text-3xl font-bold text-white">{easyWords}</div>
            </div>
          </div>
          <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex mb-4">
            <div className="h-full" style={{ width: `${unstudiedPercent}%`, backgroundColor: '#E5E7EB' }} />
            <div className="h-full" style={{ width: `${unknownPercent}%`, backgroundColor: '#9CA3AF' }} />
            <div className="h-full" style={{ width: `${confusingPercent}%`, backgroundColor: '#F59E0B' }} />
            <div className="h-full" style={{ width: `${knownPercent}%`, backgroundColor: '#10B981' }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-500 mb-6 font-medium">
            <div className="flex flex-col"><span>미학습</span><span className="text-slate-900 font-bold">{unstudiedWords}개 ({Math.round(unstudiedPercent)}%)</span></div>
            <div className="flex flex-col"><span>모르겠음</span><span className="text-slate-900 font-bold">{hardWords}개 ({Math.round(unknownPercent)}%)</span></div>
            <div className="flex flex-col"><span>헷갈림</span><span className="text-slate-900 font-bold">{mediumWords}개 ({Math.round(confusingPercent)}%)</span></div>
            <div className="flex flex-col"><span>알겠음</span><span className="text-slate-900 font-bold">{easyWords}개 ({Math.round(knownPercent)}%)</span></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Review buttons removed */}
          </div>
        </CardUI>
        
        {/* 4. 오늘의 학습 */}
        <CardUI className="p-6 border-indigo-100 shadow-indigo-100/50">
          <h2 className="text-lg font-bold text-slate-900 mb-4">오늘의 학습</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="text-sm text-slate-500">오늘 목표</div>
                {isEditingGoal ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={tempGoal}
                      onChange={(e) => setTempGoal(Number(e.target.value))}
                      className="w-16 px-1 text-sm border rounded"
                    />
                    <button onClick={() => { setDailyGoal(tempGoal); setIsEditingGoal(false); }} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded">
                      <Check className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setIsEditingGoal(true)} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded">
                    <Pencil className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="text-2xl font-bold text-slate-900 mb-4">{dailyGoal} 단어</div>
              <div className="text-sm text-slate-500 mb-1">진행률</div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-600 transition-all duration-500" style={{ width: `${dailyGoal > 0 ? Math.min(100, (8 / dailyGoal) * 100) : 0}%` }} />
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1">8 / {dailyGoal || 0} 완료</div>
            </div>
          </div>
          <Button className="w-full mt-6" size="lg" onClick={() => setView('decks')}>학습 시작하기</Button>
        </CardUI>

        {/* 5. 내 단어장 현황 */}
        <CardUI className="p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-4">내 단어장 현황</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="text-sm text-slate-600 font-bold">전체 단어장</div>
              <div className="text-2xl font-bold text-slate-900">{decks.length}개</div>
            </div>
            <div className="p-4 bg-indigo-50 rounded-xl">
              <div className="text-sm text-indigo-600 font-bold">학습중</div>
              <div className="text-2xl font-bold text-indigo-900">{activeDecks}개</div>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl">
              <div className="text-sm text-emerald-600 font-bold">완료</div>
              <div className="text-2xl font-bold text-emerald-900">{completedDecks}개</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="text-sm text-slate-600 font-bold">시작 전</div>
              <div className="text-2xl font-bold text-slate-900">{notStartedDecks}개</div>
            </div>
          </div>
        </CardUI>
      </div>
    );
  };

  const getDeckProgress = (deckId: number, totalCount: number) => {
    const easy = reviewBuckets.easy.filter(card => String(card.deckId) === String(deckId)).length;
    const medium = reviewBuckets.medium.filter(card => String(card.deckId) === String(deckId)).length;
    const hard = Math.max(0, totalCount - easy - medium);

    return { hard, medium, easy };
  };

  const renderAuth = () => (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <CardUI className="w-full max-w-md p-8">
        <h2 className="text-2xl font-bold text-center mb-6">{authMode === 'login' ? '로그인' : '회원가입'}</h2>
        {authMode === 'signup' && (
          <input
            type="text"
            placeholder="이름"
            className="w-full p-3 mb-4 border rounded-xl"
            value={authName}
            onChange={(e) => setAuthName(e.target.value)}
          />
        )}
        {authError && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100">
            {authError}
          </div>
        )}
        <input
          type="email"
          placeholder="이메일"
          className="w-full p-3 mb-4 border rounded-xl"
          value={authEmail}
          onChange={(e) => setAuthEmail(e.target.value)}
        />
        <input
          type="password"
          placeholder="비밀번호"
          className="w-full p-3 mb-6 border rounded-xl"
          value={authPassword}
          onChange={(e) => setAuthPassword(e.target.value)}
        />
        <Button className="w-full mb-4" onClick={handleAuth} disabled={isAuthLoading}>
          {isAuthLoading ? '처리중...' : (authMode === 'login' ? '로그인' : '회원가입')}
        </Button>
        <button
          className="w-full text-sm text-slate-500 hover:text-indigo-600"
          onClick={() => {
            setAuthMode(authMode === 'login' ? 'signup' : 'login');
            setAuthError(null);
          }}
        >
          {authMode === 'login' ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </button>
      </CardUI>
    </div>
  );

  const renderDecks = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">내 단어장</h2>
        <Button onClick={() => setView('upload')} className="gap-2">
          <Plus className="w-4 h-4" /> 새 단어장 만들기
        </Button>
      </div>

      <div className="flex gap-2">
        {(['all', 'active', 'completed'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setDeckFilter(filter)}
            className={cn(
              "px-4 py-1.5 text-sm font-medium rounded-full transition-all",
              deckFilter === filter
                ? "bg-indigo-100 text-indigo-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {filter === 'all' ? '전체' : filter === 'active' ? '학습중' : '완료'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {(decks || []).filter(deck => {
          const progress = getDeckProgress(deck.id, deck.cardCount);
          if (deckFilter === 'active') return progress.easy < deck.cardCount && deck.cardCount > 0;
          if (deckFilter === 'completed') return progress.easy === deck.cardCount && deck.cardCount > 0;
          return true;
        }).map((deck) => {
          const progress = getDeckProgress(deck.id, deck.cardCount);
          const isCompleted = progress.easy === deck.cardCount && deck.cardCount > 0;
          return (
            <div key={deck.id} className="relative">
              {isCompleted && (
                <div className="absolute -top-3 -right-3 z-10 rotate-12">
                  <div className="bg-emerald-500 text-white font-black text-xs px-3 py-1 rounded shadow-lg border-2 border-white">
                    PASS
                  </div>
                </div>
              )}
              <CardUI 
                className={cn(
                  "group hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer",
                  isCompleted && "border-emerald-200 bg-emerald-50/30"
                )} 
                onClick={() => startStudy(deck.id)}
              >
                <div className="p-5 flex flex-col h-full">
                  <div className="flex justify-between items-start mb-4">
                    <div className="bg-indigo-50 text-indigo-600 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">
                      {deck.category}
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setActiveMenuDeck(deck); }} className="p-1 hover:bg-slate-100 rounded">
                      <MoreVertical className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 mb-1">{deck.title}</h3>
                  <p className="text-sm text-slate-500 mb-4 line-clamp-2">{deck.description}</p>

                  <div className="mb-4 text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">
                    <span className="font-semibold text-slate-700">단어:</span> {(deck.previewCards || []).slice(0, 3).map((c) => c.term).join(', ')}
                    {deck.cardCount > 3 && '...'}
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>모르겠음 {progress.hard}</span>
                      <span>헷갈림 {progress.medium}</span>
                      <span>알겠음 {progress.easy}</span>
                    </div>
                    <div className="flex h-2.5 rounded-full overflow-hidden bg-slate-100">
                      <motion.div 
                        className="bg-rose-500" 
                        initial={{ width: 0 }}
                        animate={{ width: `${deck.cardCount > 0 ? (progress.hard / deck.cardCount) * 100 : 0}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                      <motion.div 
                        className="bg-amber-500" 
                        initial={{ width: 0 }}
                        animate={{ width: `${deck.cardCount > 0 ? (progress.medium / deck.cardCount) * 100 : 0}%` }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.1 }}
                      />
                      <motion.div 
                        className="bg-emerald-500" 
                        initial={{ width: 0 }}
                        animate={{ width: `${deck.cardCount > 0 ? (progress.easy / deck.cardCount) * 100 : 0}%` }}
                        transition={{ duration: 0.5, ease: "easeOut", delay: 0.2 }}
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 mt-auto">
                    <Button className={cn("w-full shadow-lg", isCompleted ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200")} onClick={() => startStudy(deck.id)}>
                      {isCompleted ? '다시 학습하기' : '학습하기'} <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardUI>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {activeMenuDeck && (
          <div className="fixed inset-0 bg-black/20 z-[60] flex items-center justify-center p-4" onClick={() => setActiveMenuDeck(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <DeckDetailsContent deck={activeMenuDeck} onClose={() => setActiveMenuDeck(null)} onUpdate={fetchDecks} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderReports = () => {
    const totalWords = decks.reduce((acc, deck) => acc + deck.cardCount, 0);
    const easyWords = reviewBuckets.easy.length;
    const hardWords = reviewBuckets.hard.length;
    const mediumWords = reviewBuckets.medium.length;
    const reviewNeeded = hardWords + mediumWords;

    const data = [
      { name: '알겠음', value: easyWords, color: '#10b981' },
      { name: '헷갈림', value: mediumWords, color: '#f59e0b' },
      { name: '모르겠음', value: hardWords, color: '#f43f5e' },
    ];

    return (
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-slate-900">학습 리포트</h1>
          <p className="text-slate-500">나의 학습 상태를 한눈에 보여주는 개인 대시보드</p>
        </header>

        {/* SECTION 6: AI Coach (Moved to Top) */}
        <CardUI className="p-6 bg-indigo-50 border-indigo-100">
          <h3 className="font-bold text-lg text-indigo-900 mb-2">AI 학습 코치</h3>
          <p className="text-indigo-700">"좋은 학습 페이스입니다!<br/>헷갈리는 단어를 조금만 더 복습하면<br/>이번 주 안에 단어장 하나를 완전히 마스터할 수 있어요."</p>
        </CardUI>

        {/* SECTION 1: Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <CardUI className="p-4 flex items-center gap-4">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl"><BookOpen className="w-6 h-6" /></div>
            <div>
              <div className="text-sm text-slate-500">총 학습 단어</div>
              <div className="text-lg font-bold text-slate-900">총 {totalWords}개 학습</div>
            </div>
          </CardUI>
          <CardUI className="p-4 flex items-center gap-4">
            <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Trophy className="w-6 h-6" /></div>
            <div>
              <div className="text-sm text-slate-500">마스터 단어</div>
              <div className="text-lg font-bold text-slate-900">{easyWords}개 마스터!</div>
            </div>
          </CardUI>
          <CardUI className="p-4 flex items-center gap-4">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><AlertCircle className="w-6 h-6" /></div>
            <div>
              <div className="text-sm text-slate-500">복습 필요</div>
              <div className="text-lg font-bold text-slate-900">{reviewNeeded}개 연습</div>
            </div>
          </CardUI>
          <CardUI className="p-4 flex items-center gap-4">
            <div className="p-3 bg-orange-100 text-orange-600 rounded-xl"><Flame className="w-6 h-6" /></div>
            <div>
              <div className="text-sm text-slate-500">연속 학습</div>
              <div className="text-lg font-bold text-slate-900">🔥 {streak}일 연속</div>
            </div>
          </CardUI>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* SECTION 2: Distribution Chart (Improved) */}
          <CardUI className="p-6 lg:col-span-1">
            <h3 className="font-bold text-lg text-slate-900 mb-4">나의 단어 이해도</h3>
            <div className="space-y-4">
              {data.map((item) => {
                const count = item.value;
                const percentage = totalWords > 0 ? Math.round((count / totalWords) * 100) : 0;
                return (
                  <div key={item.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-700">{item.name}</span>
                      <span className="text-slate-600">{percentage}% ({count}개)</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${percentage}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-center text-sm text-slate-600 mt-6">"좋아요! 절반 이상의 단어를 이해하고 있어요."</div>
          </CardUI>

          {/* SECTION 3: Top 5 Hard Words */}
          <CardUI className="p-6 lg:col-span-2">
            <h3 className="font-bold text-lg text-slate-900 mb-4">다시 보면 좋은 단어</h3>
            <div className="space-y-3">
              {reviewBuckets.hard.slice(0, 5).map((card, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                  <span className="font-medium text-slate-800">{card.term}</span>
                  <Button size="sm" variant="outline" onClick={() => startStudy(card.deckId)}>복습하기</Button>
                </div>
              ))}
              {reviewBuckets.hard.length === 0 && <div className="text-slate-500 text-sm">복습할 단어가 없습니다.</div>}
            </div>
          </CardUI>
        </div>

        {/* SECTION 4: Activity Heatmap (Improved) */}
        <CardUI className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-lg text-slate-900">나의 학습 활동</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => changeMonth(-1)}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="font-medium text-slate-700">{currentMonth.getFullYear()}년 {currentMonth.getMonth() + 1}월</span>
              <Button variant="outline" size="sm" onClick={() => changeMonth(1)}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs text-slate-500 mb-2">
            {['월', '화', '수', '목', '금', '토', '일'].map(day => <div key={day}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarCells.map((cell, i) => (
              <div 
                key={i} 
                className={cn(
                  "h-8 rounded-md flex items-center justify-center text-xs",
                  cell.day ? "bg-slate-100" : "bg-transparent",
                  cell.isStudied ? "bg-purple-600 text-white" : "text-slate-700"
                )}
              >
                {cell.day}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-6 text-sm text-slate-500">
            <div className="flex items-center gap-1"><div className="w-4 h-4 bg-slate-100 rounded" /> 학습 없음</div>
            <div className="flex items-center gap-1"><div className="w-4 h-4 bg-purple-600 rounded" /> 학습한 날</div>
          </div>
          <div className="text-sm text-slate-600 mt-4 font-medium">"이번 달에 {studiedDaysInMonth}일 동안 학습했어요!"</div>
        </CardUI>
      </div>
    );
  };

  function DeckDetailsContent({ deck, onClose, onUpdate }: { deck: Deck; onClose: () => void; onUpdate: () => void }) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(deck.title);
    const [description, setDescription] = useState(deck.description);
    const [cards, setCards] = useState<Card[]>([]);

    useEffect(() => {
      const previewCards = (deck.previewCards || []).map((c, index) => ({
        id: index + 1,
        term: c.term,
        meaning: '',
      }));
      setCards(previewCards);
    }, [deck]);

    const handleSave = async () => {
      onUpdate();
      setIsEditing(false);
    };

    return (
      <div className="flex flex-col h-[80vh]">
        {isEditing ? (
          <div className="space-y-4 flex-1 overflow-y-auto">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full font-bold text-xl text-slate-900 border border-slate-200 rounded-lg p-2"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-slate-600 border border-slate-200 rounded-lg p-2"
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditing(false)}>취소</Button>
              <Button className="flex-1" onClick={handleSave}>저장</Button>
            </div>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-slate-900 mb-2">{deck.title}</h2>
            <p className="text-slate-600 mb-4">{deck.description}</p>
            <div className="flex-1 overflow-y-auto border border-slate-100 rounded-xl mb-4">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-4 py-2">단어</th>
                    <th className="px-4 py-2">뜻</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(cards || []).map((card, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium text-slate-800">{card.term}</td>
                      <td className="px-4 py-2 text-slate-600">{card.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditing(true)}>수정</Button>
              <Button variant="danger" className="flex-1" onClick={async () => {
                await fetch(`/api/decks/${deck.id}`, { method: 'DELETE' });
                onUpdate();
                onClose();
              }}>
                삭제
              </Button>
              <Button className="flex-1" onClick={onClose}>닫기</Button>
            </div>
          </>
        )}
      </div>
    );
  }

  const downloadTemplate = () => {
    const headers = ['term', 'meaning', 'example', 'category', 'difficulty', 'source'];
    const sampleData = [
      ['Hypoxia', '저산소증', 'Cyanosis is a late sign of hypoxia.', 'Respiratory', 'hard', 'NCLEX'],
      ['Bradycardia', '서맥', 'The patient developed bradycardia.', 'Cardiac', 'easy', 'NCLEX']
    ];
    const csvContent = [headers, ...sampleData].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'vocab_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderUpload = () => (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      <CardUI className="p-6">
        <h3 className="font-bold text-slate-900 mb-4">단어장 정보 설정</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">제목</label>
            <input
              type="text"
              value={uploadMeta.title}
              onChange={(e) => setUploadMeta((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">카테고리</label>
            <select
              value={uploadMeta.category}
              onChange={(e) => setUploadMeta((prev) => ({ ...prev, category: e.target.value }))}
              className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option>General</option>
              <option>Anatomy</option>
              <option>Medication</option>
              <option>Vital Signs</option>
              <option>Nursing Intervention</option>
            </select>
          </div>
        </div>
      </CardUI>

      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">단어장 추가</h2>
        <p className="text-slate-500">엑셀 파일을 업로드하거나 직접 복사해서 붙여넣으세요.</p>
        <div className="flex items-center justify-center gap-4 mt-6">
          <button
            onClick={() => setUploadMode('paste')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-bold transition-all',
              uploadMode === 'paste' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'
            )}
          >
            직접 붙여넣기
          </button>
          <button
            onClick={() => setUploadMode('file')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-bold transition-all',
              uploadMode === 'file' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-200'
            )}
          >
            파일 업로드
          </button>
        </div>
      </div>

      {uploadMode === 'file' ? (
        <CardUI className="p-8 border-dashed border-2 border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/30 transition-all duration-200">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6">
              <Upload className="w-10 h-10 text-indigo-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">파일을 드래그하거나 클릭하세요</h3>
            <p className="text-slate-500 text-sm mb-8">.xlsx, .csv 파일만 지원합니다 (최대 10MB)</p>
            <input
              type="file"
              id="file-upload"
              className="hidden"
              accept=".xlsx, .csv"
              onChange={handleFileUpload}
            />
            <Button size="lg" className="w-full max-w-xs" onClick={() => document.getElementById('file-upload')?.click()}>
              파일 선택하기
            </Button>
            <button
              onClick={downloadTemplate}
              className="mt-6 text-sm text-indigo-600 font-medium hover:underline flex items-center gap-1.5"
            >
              <Upload className="w-4 h-4" /> 템플릿 다운로드 (.csv)
            </button>
          </div>
        </CardUI>
      ) : (
        <CardUI className="p-8">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-slate-900">단어 직접 입력</h3>
                <p className="text-slate-500 text-sm">표에서 복사한 데이터를 아래에 붙여넣으세요.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setUploadData([
                    ...uploadData,
                    { term: '', meaning: '', example: '', category: '', difficulty: 'medium', source: '' }
                  ]);
                }}
              >
                <Plus className="w-4 h-4 mr-1.5" /> 행 추가
              </Button>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">단어</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">뜻</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">예문</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">카테고리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {uploadData.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      {['term', 'meaning', 'example', 'category'].map((field) => (
                        <td key={field} className="p-2">
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder={field === 'term' ? '단어' : field === 'meaning' ? '뜻' : field === 'example' ? '예문' : '카테고리'}
                            value={(row as any)[field]}
                            onChange={(e) => {
                              const newData = [...uploadData];
                              (newData[i] as any)[field] = e.target.value;
                              setUploadData(newData);
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              const pastedData = e.clipboardData.getData('text');
                              const rows = pastedData.split('\n').filter(r => r.trim() !== '');
                              const newData = [...uploadData];

                              rows.forEach((rowStr, rowIndex) => {
                                const cols = rowStr.split('\t');
                                const targetIndex = i + rowIndex;

                                if (!newData[targetIndex]) {
                                  newData[targetIndex] = {
                                    term: '',
                                    meaning: '',
                                    example: '',
                                    category: '',
                                    difficulty: 'medium',
                                    source: ''
                                  };
                                }

                                if (cols[0] !== undefined) newData[targetIndex].term = cols[0].trim();
                                if (cols[1] !== undefined) newData[targetIndex].meaning = cols[1].trim();
                                if (cols[2] !== undefined) newData[targetIndex].example = cols[2].trim();
                                if (cols[3] !== undefined) newData[targetIndex].category = cols[3].trim();
                              });
                              setUploadData(newData);
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex gap-3 items-start">
              <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
              <div className="text-sm text-indigo-800">
                <p className="font-semibold mb-1">팁: 엑셀에서 데이터를 복사하세요</p>
                <p>단어, 뜻, 예문, 카테고리 순서로 된 데이터를 복사하여 붙여넣으면 자동으로 채워집니다.</p>
              </div>
            </div>
          </div>
        </CardUI>
      )}

      {uploadData.length > 0 && (
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setUploadData([])}>취소</Button>
          <Button className="flex-1" onClick={saveDeck}>단어장 생성하기</Button>
        </div>
      )}
    </div>
  );

  const renderStudy = () => {
    if (studyCards.length === 0) {
      return (
        <div className="max-w-xl mx-auto py-10 text-center">
          <h2 className="text-2xl font-bold">학습할 카드가 없습니다.</h2>
          <Button className="mt-4" onClick={() => setView('home')}>대시보드로</Button>
        </div>
      );
    }

    const card = studyCards[currentCardIndex];
    if (!card) return null;

    if (isFiltering) {
      return (
        <div className="max-w-xl mx-auto py-10 space-y-8">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setIsFiltering(false)}>
              <ArrowLeft className="w-4 h-4 mr-2" /> 요약으로 돌아가기
            </Button>
          </div>
          <h2 className="text-2xl font-bold text-center">선택된 단어들</h2>
          <div className="space-y-4">
            {filteredCards.map((c) => (
              <div key={c.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div className="font-bold text-lg text-slate-900">{c.term}</div>
                <div className="text-slate-600">{c.meaning}</div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-xl mx-auto py-10 space-y-8">
        {showSummary ? (
          <div className="text-center space-y-6">
            <h2 className="text-3xl font-bold">학습 완료!</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-rose-50 p-4 rounded-xl text-rose-600 cursor-pointer hover:bg-rose-100 transition-colors" onClick={() => showFilteredCards('hard')}>
                <div className="text-2xl font-bold">{feedbackStats.hard}</div>
                <div className="text-xs">모르겠음</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl text-amber-600 cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => showFilteredCards('medium')}>
                <div className="text-2xl font-bold">{feedbackStats.medium}</div>
                <div className="text-xs">헷갈림</div>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl text-emerald-600 cursor-pointer hover:bg-emerald-100 transition-colors" onClick={() => showFilteredCards('easy')}>
                <div className="text-2xl font-bold">{feedbackStats.easy}</div>
                <div className="text-xs">알겠음</div>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => { setView('home'); }}>대시보드로</Button>
              {(feedbackStats.hard > 0 || feedbackStats.medium > 0) && (
                <Button className="flex-1" onClick={() => restartStudy(false)}>다시 학습하기</Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setView('home')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> 학습 종료
              </Button>
              <div className="flex-1 mx-8">
                <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
                  <span>{currentCardIndex + 1} / {studyCards.length}</span>
                  <span>남은 단어: {studyCards.length - currentCardIndex}</span>
                </div>
                <ProgressBar progress={((currentCardIndex + 1) / studyCards.length) * 100} />
              </div>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex justify-center gap-6 py-2">
              <div className="text-sm text-rose-600 font-bold">모르겠음: {feedbackStats.hard}</div>
              <div className="text-sm text-amber-600 font-bold">헷갈림: {feedbackStats.medium}</div>
              <div className="text-sm text-emerald-600 font-bold">알겠음: {feedbackStats.easy}</div>
            </div>

            <div className="perspective-1000 h-[400px]">
              <motion.div
                className="relative w-full h-full cursor-pointer preserve-3d"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                <div
                  className={cn(
                    'absolute inset-0 backface-hidden bg-white rounded-3xl border-2 border-slate-100 shadow-xl flex flex-col items-center justify-center p-10 text-center',
                    isFlipped && 'pointer-events-none'
                  )}
                >
                  <h2 className="text-6xl font-bold text-slate-900 mb-8">{card.term}</h2>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        speak(card.term);
                      }}
                    >
                      <Volume2 className="w-5 h-5" />
                      음성 듣기
                    </Button>
                  </div>
                  <div className="absolute bottom-8 text-slate-500 text-lg font-bold flex items-center gap-2">
                    <HelpCircle className="w-5 h-5" /> 클릭하여 뜻 확인
                  </div>
                </div>

                <div
                  className={cn(
                    'absolute inset-0 backface-hidden bg-indigo-50 rounded-3xl border-2 border-indigo-100 shadow-xl flex flex-col items-center justify-center p-10 text-center rotate-y-180',
                    !isFlipped && 'pointer-events-none'
                  )}
                >
                  <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-4">MEANING</div>
                  <h2 className="text-5xl font-bold text-slate-900 mb-6">{card.meaning}</h2>
                  {card.example && (
                    <div className="bg-white/60 p-6 rounded-2xl border border-indigo-100 max-w-sm">
                      <p className="text-slate-700 italic text-lg">"{card.example}"</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            <AnimatePresence>
              {isFlipped ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-3 gap-4"
                >
                  <Button variant="outline" className="flex-col h-24 gap-2 border-rose-100 text-rose-600 hover:bg-rose-50" onClick={() => handleFeedback('hard')}>
                    <XCircle className="w-6 h-6" />
                    <span className="text-xs font-bold">모르겠음</span>
                  </Button>
                  <Button variant="outline" className="flex-col h-24 gap-2 border-amber-100 text-amber-600 hover:bg-amber-50" onClick={() => handleFeedback('medium')}>
                    <AlertCircle className="w-6 h-6" />
                    <span className="text-xs font-bold">헷갈림</span>
                  </Button>
                  <Button variant="outline" className="flex-col h-24 gap-2 border-emerald-100 text-emerald-600 hover:bg-emerald-50" onClick={() => handleFeedback('easy')}>
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="text-xs font-bold">알겠음</span>
                  </Button>
                </motion.div>
              ) : (
                <div className="flex justify-between gap-4">
                  <Button variant="outline" className="flex-1" onClick={() => setCurrentCardIndex(Math.max(0, currentCardIndex - 1))} disabled={currentCardIndex === 0}>
                    이전 단어
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => setCurrentCardIndex(Math.min(studyCards.length - 1, currentCardIndex + 1))} disabled={currentCardIndex === studyCards.length - 1}>
                    다음 단어
                  </Button>
                </div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0">
      {token && (
        <>
          <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 z-50 hidden md:flex flex-col">
            <div className="p-6 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl">P</div>
                <span className="font-black text-xl tracking-tight text-slate-900">PulleyVocab</span>
              </div>
            </div>

            <div className="flex-1 px-4 space-y-2">
              {[
                { id: 'home', icon: BarChart2, label: '홈' },
                { id: 'decks', icon: BookOpen, label: '단어장' },
                { id: 'reports', icon: BarChart2, label: '학습 리포트' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setView(item.id as any)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all',
                    view === item.id ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-50'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <div className="p-4 mt-auto border-t border-slate-100">
              <button 
                onClick={() => { localStorage.removeItem('token'); setToken(null); setView('auth'); }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50"
              >
                <Settings className="w-5 h-5" />
                <span>로그아웃</span>
              </button>
            </div>
          </nav>

          <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex md:hidden justify-around p-2">
            {[
              { id: 'home', icon: BarChart2, label: '홈' },
              { id: 'decks', icon: BookOpen, label: '단어장' },
              { id: 'reports', icon: BarChart2, label: '리포트' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id as any)}
                className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-xl transition-all',
                  view === item.id ? 'text-indigo-600' : 'text-slate-400'
                )}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-[10px] font-bold">{item.label}</span>
              </button>
            ))}
          </nav>
        </>
      )}

      <main className={cn(token ? "md:ml-64 p-4 md:p-10 max-w-7xl mx-auto" : "p-4")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'auth' && renderAuth()}
            {view === 'home' && renderHome()}
            {view === 'decks' && renderDecks()}
            {view === 'upload' && renderUpload()}
            {view === 'study' && renderStudy()}
            {view === 'reports' && renderReports()}
          </motion.div>
        </AnimatePresence>
      </main>

      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      {isLoading && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-indigo-600 font-bold">학습 데이터를 불러오는 중...</p>
          </div>
        </div>
      )}
    </div>
  );
}