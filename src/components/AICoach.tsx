import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, BookOpen, BrainCircuit, ChevronRight, Target, Flame, AlertCircle } from 'lucide-react';
import { Button, CardUI } from './UI';

export interface CoachStats {
  totalWords: number;
  easy: number;
  medium: number;
  hard: number;
  todayProgress: number;
  dailyGoal: number;
  streak: number;
  completedDecks: number;
  notStartedDecks: number;
  reviewNeeded: number;
  userName: string;
}

// 1. TypewriterText Component
export const TypewriterText = ({ text, speed = 30 }: { text: string; speed?: number }) => {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    setDisplayedText('');
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayedText((prev) => prev + text.charAt(i));
        i++;
      } else {
        clearInterval(timer);
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed]);

  return (
    <span className="text-slate-700">
      {displayedText}
      <motion.span
        animate={{ opacity: [0, 1, 0] }}
        transition={{ repeat: Infinity, duration: 0.8 }}
        className="inline-block w-1 h-4 bg-indigo-500 ml-1 align-middle"
      />
    </span>
  );
};

// 2. Logic Functions
export const generateCoachMessage = (stats: CoachStats): string => {
  if (stats.totalWords === 0) return "아직 학습 데이터가 많지 않아요. 첫 단어장부터 차근차근 시작해보세요.";
  
  const remainingToday = stats.dailyGoal - stats.todayProgress;
  if (remainingToday > 0 && remainingToday <= 10) {
    return `지금 ${remainingToday}개만 더 학습하면 오늘 목표를 달성할 수 있어요. 조금만 더 힘내세요!`;
  }

  if (stats.hard > 0) {
    return `오늘은 헷갈리는 단어 ${stats.hard}개를 먼저 복습해보는 건 어떨까요? 확실히 내 것으로 만들 수 있어요.`;
  }

  if (stats.streak >= 3) return `좋은 학습 습관이 형성되고 있어요. 최근 ${stats.streak}일 이상 꾸준히 학습하고 있어 기억 유지에 유리한 흐름입니다.`;
  
  if (stats.notStartedDecks > 0) return "아직 시작하지 않은 단어장이 남아 있어요. 지금 학습 흐름이 좋을 때 하나씩 시작해보면 좋습니다.";
  
  if (stats.completedDecks > 0) return "첫 단어장을 완료했어요. 학습 루틴이 잘 잡히고 있습니다.";
  
  return `${stats.userName}님, 오늘도 즐겁게 학습해볼까요?`;
};

export const getCoachAction = (stats: CoachStats) => {
  if (stats.totalWords === 0) return { label: "단어장 만들기", action: 'upload' };
  if (stats.hard > 0) return { label: "헷갈림 복습하기", action: 'study' };
  if (stats.notStartedDecks > 0) return { label: "단어장 시작하기", action: 'decks' };
  return { label: "오늘 목표 채우기", action: 'study' };
};

// 3. AICoachCard Component
export const AICoachCard = ({ stats, onAction }: { stats: CoachStats; onAction: (action: string) => void }) => {
  const message = generateCoachMessage(stats);
  const action = getCoachAction(stats);

  return (
    <CardUI className="p-6 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-100">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-600 text-white rounded-lg">
          <BrainCircuit className="w-5 h-5" />
        </div>
        <h3 className="font-bold text-lg text-slate-900">AI 학습 코치</h3>
      </div>

      <div className="mb-6 min-h-[4rem]">
        <TypewriterText text={message} />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <div className="px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-600 border border-slate-200">연속 학습 {stats.streak}일</div>
        <div className="px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-600 border border-slate-200">오늘 {stats.todayProgress}/{stats.dailyGoal}</div>
        <div className="px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-600 border border-slate-200">복습 필요 {stats.reviewNeeded}개</div>
        <div className="px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-600 border border-slate-200">완료 {stats.completedDecks}개</div>
      </div>

      <Button 
        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
        onClick={() => onAction(action.action)}
      >
        {action.label} <ChevronRight className="w-4 h-4 ml-1" />
      </Button>
    </CardUI>
  );
};
