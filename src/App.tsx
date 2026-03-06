import React, { useState, useEffect, useRef } from 'react';
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
  Search,
  Filter,
  MoreVertical,
  ArrowLeft,
  Check,
  X,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Card {
  id?: number;
  term: string;
  meaning: string;
  example?: string;
  category?: string;
  difficulty?: string;
  source?: string;
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
}

interface User {
  id: number;
  name: string;
  xp: number;
  streak: number;
}

// --- Components ---

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

const CardUI = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn('bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden', className)}>
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

// --- Main App ---

export default function App() {
  const [view, setView] = useState<'dashboard' | 'decks' | 'study' | 'groups' | 'reports' | 'upload'>('dashboard');
  const [uploadMode, setUploadMode] = useState<'file' | 'paste'>('paste');
  const [pastedText, setPastedText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [studyCards, setStudyCards] = useState<Card[]>([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [uploadData, setUploadData] = useState<Card[]>([]);
  const [uploadMeta, setUploadMeta] = useState({ title: '', category: 'General' });
  const [activeMenuDeck, setActiveMenuDeck] = useState<Deck | null>(null);
  const [feedbackStats, setFeedbackStats] = useState({ hard: 0, medium: 0, easy: 0 });
  const [sessionFeedback, setSessionFeedback] = useState<Map<number, 'easy' | 'medium' | 'hard'>>(new Map());
  const [originalStudyCards, setOriginalStudyCards] = useState<any[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [globalFeedbackStats, setGlobalFeedbackStats] = useState({ hard: 0, medium: 0, easy: 0 });

  useEffect(() => {
    if (uploadData.length > 0 && uploadMeta.title === '') {
      const generateTitle = async () => {
        const prompt = `다음 단어들을 보고 적절한 단어장 제목을 하나만 추천해줘: ${uploadData.slice(0, 5).map(c => c.term).join(', ')}`;
        const response = await fetch('/api/ai/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt })
        });
        
        if (!response.ok) {
          console.error('Failed to generate title:', response.statusText);
          return;
        }

        const data = await response.json();
        if (data && data.text) {
          setUploadMeta(prev => ({ ...prev, title: data.text.trim() }));
        }
      };
      generateTitle();
    }
  }, [uploadData]);

  useEffect(() => {
    fetchUser();
    fetchDecks();
  }, []);

  const fetchUser = async () => {
    const res = await fetch('/api/user');
    const data = await res.json();
    setUser(data);
  };

  const fetchDecks = async () => {
    const res = await fetch('/api/decks');
    const data = await res.json();
    setDecks(data);
  };

  const startStudy = async (deckId?: number) => {
    try {
      setIsLoading(true);
      const url = deckId ? `/api/decks/${deckId}/cards` : '/api/study/today';
      
      const res = await fetch(url);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch cards: ${res.statusText} (${res.status})`);
      }

      const data = await res.json();

      if (data && data.length > 0) {
        setStudyCards(data);
        setOriginalStudyCards(data);
        setCurrentCardIndex(0);
        setIsFlipped(false);
        setView('study');
        setFeedbackStats({ hard: 0, medium: 0, easy: 0 });
        setSessionFeedback(new Map());
        setShowSummary(false);
      } else {
        alert('공부할 단어가 없습니다! 단어장을 추가해보세요.');
      }
    } catch (error) {
      console.error('[DEBUG] Study start error:', error);
      alert(`학습을 시작하는 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (feedback: 'easy' | 'medium' | 'hard') => {
    const card = studyCards[currentCardIndex];
    setFeedbackStats(prev => ({ ...prev, [feedback]: prev[feedback] + 1 }));
    setGlobalFeedbackStats(prev => ({ ...prev, [feedback]: prev[feedback] + 1 }));
    setSessionFeedback(prev => new Map(prev).set(card.id, feedback));
    
    await fetch('/api/study/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardId: card.id, feedback }),
    });

    if (currentCardIndex < studyCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      setShowSummary(true);
    }
  };

  const restartStudy = (onlyReview: boolean) => {
    let cardsToStudy = onlyReview 
      ? originalStudyCards.filter(card => {
          const feedback = sessionFeedback.get(card.id);
          return feedback === 'hard' || feedback === 'medium';
        })
      : originalStudyCards;
    
    setStudyCards(cardsToStudy);
    setCurrentCardIndex(0);
    setFeedbackStats({ hard: 0, medium: 0, easy: 0 });
    setSessionFeedback(new Map());
    setShowSummary(false);
    setIsFlipped(false);
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
      
      // Map columns
      const mapped = data.map(item => ({
        term: item.term || item.word || item['영단어'] || '',
        meaning: item.meaning || item.definition || item['뜻'] || '',
        example: item.example || item['예문'] || '',
        category: item.category || item['카테고리'] || '',
        difficulty: item.difficulty || item['난이도'] || 'medium',
        source: item.source || item['출처'] || '',
      })).filter(c => c.term && c.meaning);

      setUploadData(mapped);
      setUploadMeta(prev => ({ ...prev, title: file.name.split('.')[0] }));
    };
    reader.readAsBinaryString(file);
  };

  const saveDeck = async () => {
    if (!uploadMeta.title) return alert('단어장 제목을 입력해주세요.');
    const res = await fetch('/api/decks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: uploadMeta.title,
        description: `${uploadData.length}개의 단어가 포함된 단어장`,
        category: uploadMeta.category,
        cards: uploadData
      }),
    });
    if (res.ok) {
      fetchDecks();
      setView('decks');
      setUploadData([]);
    }
  };

  const speak = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // --- Render Views ---

  const renderDashboard = () => (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">안녕하세요, {user?.name}!</h1>
          <p className="text-slate-500">오늘도 간호학 마스터를 향해 한 걸음 더.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-orange-50 text-orange-600 px-3 py-1.5 rounded-full font-bold">
            <Flame className="w-4 h-4" />
            {user?.streak}일
          </div>
          <div className="flex items-center gap-1 bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold">
            <Trophy className="w-4 h-4" />
            {user?.xp} XP
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <CardUI className="md:col-span-2 p-6 bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none">
          <div className="flex flex-col h-full justify-between">
            <div>
              <h2 className="text-xl font-bold mb-2">학습 현황</h2>
              <p className="text-indigo-100 mb-6">총 {decks.length}개의 단어장을 학습하고 있습니다.</p>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-white/10 p-3 rounded-xl">
                  <div className="text-2xl font-bold">{globalFeedbackStats.hard}</div>
                  <div className="text-xs text-indigo-200">모르겠음</div>
                </div>
                <div className="bg-white/10 p-3 rounded-xl">
                  <div className="text-2xl font-bold">{globalFeedbackStats.medium}</div>
                  <div className="text-xs text-indigo-200">헷갈림</div>
                </div>
                <div className="bg-white/10 p-3 rounded-xl">
                  <div className="text-2xl font-bold">{globalFeedbackStats.easy}</div>
                  <div className="text-xs text-indigo-200">알겠음</div>
                </div>
              </div>
            </div>
            <Button variant="secondary" size="lg" className="w-full md:w-auto self-start mt-6" onClick={() => setView('decks')}>
              학습 시작하기
            </Button>
          </div>
        </CardUI>

        <CardUI className="p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            취약 단어 Top 5
          </h3>
          <div className="space-y-3">
            {['Hypoxia', 'Bradycardia', 'PRN', 'Auscultation', 'Triage'].map((word, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 cursor-pointer group">
                <span className="text-slate-700 font-medium">{word}</span>
                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500" />
              </div>
            ))}
          </div>
        </CardUI>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CardUI className="p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-500" />
            스터디 그룹 랭킹
          </h3>
          <div className="space-y-4">
            {[
              { name: '김간호', xp: 1250, rank: 1 },
              { name: '이학생', xp: 1100, rank: 2 },
              { name: '나(본인)', xp: 980, rank: 3 },
            ].map((m, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                  m.rank === 1 ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-600"
                )}>
                  {m.rank}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-slate-800">{m.name}</div>
                  <div className="text-xs text-slate-500">{m.xp} XP</div>
                </div>
                <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: `${(m.xp / 1500) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </CardUI>

        <CardUI className="p-6">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            진행 중인 퀘스트
          </h3>
          <div className="space-y-4">
            {[
              { title: '심혈관 파트 마스터', desc: '20개 단어 정답 맞히기', progress: 80 },
              { title: '3일 연속 복습', desc: '꾸준함이 생명!', progress: 66 },
            ].map((q, i) => (
              <div key={i} className="p-4 border border-slate-100 rounded-xl bg-slate-50/50">
                <div className="flex justify-between mb-2">
                  <span className="font-medium text-slate-800">{q.title}</span>
                  <span className="text-xs text-indigo-600 font-bold">{q.progress}%</span>
                </div>
                <ProgressBar progress={q.progress} />
              </div>
            ))}
          </div>
        </CardUI>
      </div>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {decks.map(deck => (
          <div key={deck.id}>
            <CardUI className="group hover:border-indigo-200 hover:shadow-md transition-all cursor-pointer" onClick={() => startStudy(deck.id)}>
              <div className="p-5">
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
                
                <div className="mb-4 text-xs text-slate-400">
                  {deck.previewCards.map(c => c.term).join(', ')}
                  {deck.cardCount > 3 && '...'}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      마스터한 단어: {deck.easyCount} / {deck.cardCount}
                    </span>
                    <span className="font-bold text-emerald-600">
                      {deck.cardCount > 0 ? Math.round((deck.easyCount / deck.cardCount) * 100) : 0}%
                    </span>
                  </div>
                  <ProgressBar progress={deck.cardCount > 0 ? (deck.easyCount / deck.cardCount) * 100 : 0} color="bg-emerald-500" />
                </div>

                <div className="pt-4 border-t border-slate-50">
                  <Button className="w-full" onClick={() => startStudy(deck.id)}>
                    학습하기 <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>
            </CardUI>
          </div>
        ))}
      </div>

      {/* Deck Details Modal */}
      <AnimatePresence>
        {activeMenuDeck && (
          <div className="fixed inset-0 bg-black/20 z-[60] flex items-center justify-center p-4" onClick={() => setActiveMenuDeck(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <DeckDetailsContent deck={activeMenuDeck} onClose={() => setActiveMenuDeck(null)} onUpdate={fetchDecks} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  function DeckDetailsContent({ deck, onClose, onUpdate }: { deck: Deck, onClose: () => void, onUpdate: () => void }) {
    const [isEditing, setIsEditing] = useState(false);
    const [title, setTitle] = useState(deck.title);
    const [description, setDescription] = useState(deck.description);

    const handleSave = async () => {
      await fetch(`/api/decks/${deck.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
      onUpdate();
      setIsEditing(false);
    };

    return (
      <>
        {isEditing ? (
          <div className="space-y-4">
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              className="w-full font-bold text-xl text-slate-900 border border-slate-200 rounded-lg p-2"
            />
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
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
            <div className="text-sm text-slate-500 mb-6 space-y-1">
              <p>카테고리: {deck.category}</p>
              <p>총 단어 수: {deck.cardCount}개</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditing(true)}>수정</Button>
              <Button className="flex-1" onClick={onClose}>닫기</Button>
            </div>
          </>
        )}
      </>
    );
  }

  const downloadTemplate = () => {
    const headers = ['term', 'meaning', 'example', 'category', 'difficulty', 'source'];
    const sampleData = [
      ['Hypoxia', '저산소증', 'Cyanosis is a late sign of hypoxia.', 'Respiratory', 'hard', 'NCLEX'],
      ['Bradycardia', '서맥', 'The patient developed bradycardia.', 'Cardiac', 'easy', 'NCLEX']
    ];
    const csvContent = [headers, ...sampleData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "vocab_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePaste = (text: string) => {
    setPastedText(text);
    if (!text.trim()) return;

    // Excel paste is usually tab-separated
    const rows = text.trim().split('\n');
    const mapped = rows.map(row => {
      const cols = row.split('\t');
      return {
        term: cols[0]?.trim() || '',
        meaning: cols[1]?.trim() || '',
        example: cols[2]?.trim() || '',
        category: cols[3]?.trim() || '',
        difficulty: cols[4]?.trim() || 'medium',
        source: cols[5]?.trim() || '',
      };
    }).filter(c => c.term && c.meaning);

    setUploadData(mapped);
    if (!uploadMeta.title) {
      setUploadMeta(prev => ({ ...prev, title: '붙여넣은 단어장' }));
    }
  };

  const renderUpload = () => (
    <div className="max-w-2xl mx-auto space-y-8 py-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">단어장 추가</h2>
        <p className="text-slate-500">엑셀 파일을 업로드하거나 직접 복사해서 붙여넣으세요.</p>
        <div className="flex items-center justify-center gap-4 mt-6">
          <button 
            onClick={() => setUploadMode('paste')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-bold transition-all",
              uploadMode === 'paste' ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200"
            )}
          >
            직접 붙여넣기
          </button>
          <button 
            onClick={() => setUploadMode('file')}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-bold transition-all",
              uploadMode === 'file' ? "bg-indigo-600 text-white shadow-md" : "bg-white text-slate-500 border border-slate-200"
            )}
          >
            파일 업로드
          </button>
        </div>
      </div>

      {uploadMode === 'file' ? (
        <CardUI className="p-8 border-dashed border-2 border-slate-200 bg-slate-50/50">
          <div className="flex flex-col items-center justify-center py-10">
            <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
              <Upload className="w-8 h-8 text-indigo-600" />
            </div>
            <p className="text-slate-600 font-medium mb-1">파일을 드래그하거나 클릭하여 선택</p>
            <p className="text-slate-400 text-sm mb-6">.xlsx, .csv 지원 (최대 10MB)</p>
            <input 
              type="file" 
              id="file-upload" 
              className="hidden" 
              accept=".xlsx, .csv" 
              onChange={handleFileUpload}
            />
            <Button onClick={() => document.getElementById('file-upload')?.click()}>
              파일 선택하기
            </Button>
            <button 
              onClick={downloadTemplate}
              className="mt-6 text-xs text-indigo-600 font-medium hover:underline flex items-center gap-1"
            >
              <Upload className="w-3 h-3" /> 템플릿 다운로드 (.csv)
            </button>
          </div>
        </CardUI>
      ) : (
        <CardUI className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">단어 직접 입력</h3>
              <Button size="sm" variant="outline" onClick={() => setUploadData([...uploadData, { term: '', meaning: '', example: '', category: '', difficulty: 'medium', source: '' }])}>
                <Plus className="w-4 h-4 mr-1" /> 행 추가
              </Button>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">단어</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">뜻</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">예문</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">카테고리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(uploadData.length === 0 ? [{ term: '', meaning: '', example: '', category: '', difficulty: 'medium', source: '' }] : uploadData).map((row, i) => (
                    <tr key={i}>
                      {['term', 'meaning', 'example', 'category'].map((field) => (
                        <td key={field} className="p-1">
                          <input
                            type="text"
                            className="w-full px-2 py-1.5 border border-slate-200 rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                            value={(row as any)[field]}
                            onChange={(e) => {
                              const newData = [...uploadData];
                              if (!newData[i]) newData[i] = { term: '', meaning: '', example: '', category: '', difficulty: 'medium', source: '' };
                              (newData[i] as any)[field] = e.target.value;
                              setUploadData(newData);
                            }}
                            onPaste={(e) => {
                              if (field === 'term') {
                                e.preventDefault();
                                const pastedData = e.clipboardData.getData('text');
                                const rows = pastedData.split('\n').filter(r => r.trim() !== '');
                                const newData = [...uploadData];
                                rows.forEach((rowStr, rowIndex) => {
                                  const cols = rowStr.split('\t');
                                  const targetIndex = i + rowIndex;
                                  if (!newData[targetIndex]) {
                                    newData[targetIndex] = { term: '', meaning: '', example: '', category: '', difficulty: 'medium', source: '' };
                                  }
                                  newData[targetIndex].term = cols[0] || '';
                                  newData[targetIndex].meaning = cols[1] || '';
                                  newData[targetIndex].example = cols[2] || '';
                                  newData[targetIndex].category = cols[3] || newData[targetIndex].category;
                                });
                                setUploadData(newData);
                              }
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                엑셀에서 범위를 복사(Ctrl+C)한 후, 첫 번째 단어 칸에 붙여넣기(Ctrl+V)하면 자동으로 행이 채워집니다.
              </p>
            </div>
          </div>
        </CardUI>
      )}

      {uploadData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <CardUI className="p-6">
            <h3 className="font-bold text-slate-900 mb-4">단어장 정보 설정</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">제목</label>
                <input 
                  type="text" 
                  value={uploadMeta.title}
                  onChange={e => setUploadMeta(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">카테고리</label>
                <select 
                  value={uploadMeta.category}
                  onChange={e => setUploadMeta(prev => ({ ...prev, category: e.target.value }))}
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

          <CardUI className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">미리보기 ({uploadData.length}개 단어)</h3>
              <span className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">검수 완료</span>
            </div>
            <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-xl">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 font-medium">단어</th>
                    <th className="px-4 py-2 font-medium">뜻</th>
                    <th className="px-4 py-2 font-medium">예문</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {uploadData.slice(0, 10).map((c, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium text-slate-800">{c.term}</td>
                      <td className="px-4 py-2 text-slate-600">{c.meaning}</td>
                      <td className="px-4 py-2 text-slate-400 italic truncate max-w-[400px]">{c.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {uploadData.length > 10 && (
                <div className="p-3 text-center text-slate-400 bg-slate-50/50 text-xs">
                  외 {uploadData.length - 10}개의 단어가 더 있습니다.
                </div>
              )}
            </div>
          </CardUI>

          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setUploadData([])}>취소</Button>
            <Button className="flex-1" onClick={saveDeck}>단어장 생성하기</Button>
          </div>
        </motion.div>
      )}
    </div>
  );

  const renderStudy = () => {
    const card = studyCards[currentCardIndex];
    if (!card) return null;

    return (
      <div className="max-w-xl mx-auto py-10 space-y-8">
        {showSummary ? (
          <div className="text-center space-y-6">
            <h2 className="text-3xl font-bold">학습 완료!</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-rose-50 p-4 rounded-xl text-rose-600">
                <div className="text-2xl font-bold">{feedbackStats.hard}</div>
                <div className="text-xs">모르겠음</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl text-amber-600">
                <div className="text-2xl font-bold">{feedbackStats.medium}</div>
                <div className="text-xs">헷갈림</div>
              </div>
              <div className="bg-emerald-50 p-4 rounded-xl text-emerald-600">
                <div className="text-2xl font-bold">{feedbackStats.easy}</div>
                <div className="text-xs">알겠음</div>
              </div>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => setView('dashboard')}>대시보드로</Button>
              {(feedbackStats.hard > 0 || feedbackStats.medium > 0) && (
                <Button className="flex-1" onClick={() => restartStudy(true)}>다시 학습하기</Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setView('dashboard')}>
                <ArrowLeft className="w-4 h-4 mr-2" /> 학습 종료
              </Button>
              <div className="flex-1 mx-8">
                <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
                  <span>{currentCardIndex + 1} / {studyCards.length}</span>
                  <span>남은 단어: {studyCards.length - currentCardIndex - 1}</span>
                </div>
                <ProgressBar progress={((currentCardIndex + 1) / studyCards.length) * 100} />
              </div>
              <Button variant="ghost" size="sm">
                <Settings className="w-4 h-4" />
              </Button>
            </div>

            {/* 학습 통계 표시 영역 */}
            <div className="flex justify-center gap-4 py-2">
              <div className="text-xs text-rose-600 font-bold">모르겠음: {feedbackStats.hard}</div>
              <div className="text-xs text-amber-600 font-bold">헷갈림: {feedbackStats.medium}</div>
              <div className="text-xs text-emerald-600 font-bold">알겠음: {feedbackStats.easy}</div>
            </div>

            <div className="perspective-1000 h-[400px]">
              <motion.div 
                className="relative w-full h-full cursor-pointer preserve-3d"
                animate={{ rotateY: isFlipped ? 180 : 0 }}
                transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 20 }}
                onClick={() => setIsFlipped(!isFlipped)}
              >
                {/* Front */}
                <div className={cn(
                  "absolute inset-0 backface-hidden bg-white rounded-3xl border-2 border-slate-100 shadow-xl flex flex-col items-center justify-center p-10 text-center",
                  isFlipped && "pointer-events-none"
                )}>
                  <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-4">TERM</div>
                  <h2 className="text-5xl font-bold text-slate-900 mb-8">{card.term}</h2>
                  <Button variant="ghost" size="sm" className="text-slate-400" onClick={(e) => { e.stopPropagation(); speak(card.term); }}>
                    <Volume2 className="w-5 h-5" />
                  </Button>
                  <div className="absolute bottom-8 text-slate-300 text-sm flex items-center gap-2">
                    <HelpCircle className="w-4 h-4" /> 클릭하여 뜻 확인
                  </div>
                </div>

                {/* Back */}
                <div className={cn(
                  "absolute inset-0 backface-hidden bg-indigo-50 rounded-3xl border-2 border-indigo-100 shadow-xl flex flex-col items-center justify-center p-10 text-center rotate-y-180",
                  !isFlipped && "pointer-events-none"
                )}>
                  <div className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-4">MEANING</div>
                  <h2 className="text-3xl font-bold text-slate-900 mb-6">{card.meaning}</h2>
                  {card.example && (
                    <div className="bg-white/60 p-4 rounded-2xl border border-indigo-100 max-w-sm">
                      <p className="text-slate-600 italic text-sm">"{card.example}"</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            <AnimatePresence>
              {isFlipped && (
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
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20 md:pb-0">
      {/* Sidebar / Nav */}
      <nav className="fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-slate-200 z-50 hidden md:flex flex-col">
        <div className="p-6 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl">P</div>
            <span className="font-black text-xl tracking-tight text-slate-900">PulleyVocab</span>
          </div>
        </div>

        <div className="flex-1 px-4 space-y-2">
          {[
            { id: 'dashboard', icon: BarChart2, label: '대시보드' },
            { id: 'decks', icon: BookOpen, label: '단어장' },
            { id: 'groups', icon: Users, label: '스터디 그룹' },
            { id: 'reports', icon: BarChart2, label: '학습 리포트' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setView(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                view === item.id ? "bg-indigo-50 text-indigo-600 font-bold" : "text-slate-500 hover:bg-slate-50"
              )}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 mt-auto border-t border-slate-100">
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 hover:bg-slate-50">
            <Settings className="w-5 h-5" />
            <span>설정</span>
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 flex md:hidden justify-around p-2">
        {[
          { id: 'dashboard', icon: BarChart2, label: '홈' },
          { id: 'decks', icon: BookOpen, label: '단어장' },
          { id: 'groups', icon: Users, label: '그룹' },
          { id: 'reports', icon: BarChart2, label: '리포트' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setView(item.id as any)}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
              view === item.id ? "text-indigo-600" : "text-slate-400"
            )}
          >
            <item.icon className="w-6 h-6" />
            <span className="text-[10px] font-bold">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Main Content */}
      <main className="md:ml-64 p-4 md:p-10 max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'dashboard' && renderDashboard()}
            {view === 'decks' && renderDecks()}
            {view === 'upload' && renderUpload()}
            {view === 'study' && renderStudy()}
            {view === 'groups' && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Users className="w-16 h-16 text-slate-200 mb-4" />
                <h2 className="text-xl font-bold text-slate-900">스터디 그룹 기능 준비 중</h2>
                <p className="text-slate-500">동료들과 함께 학습하고 경쟁하는 기능을 곧 만나보실 수 있습니다.</p>
              </div>
            )}
            {view === 'reports' && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <BarChart2 className="w-16 h-16 text-slate-200 mb-4" />
                <h2 className="text-xl font-bold text-slate-900">학습 리포트 준비 중</h2>
                <p className="text-slate-500">나의 학습 패턴과 성취도를 분석한 리포트를 곧 제공할 예정입니다.</p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Global Styles for Flip Card */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      {/* Loading Overlay */}
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
