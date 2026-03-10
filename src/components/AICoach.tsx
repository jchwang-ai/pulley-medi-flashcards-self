import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, BookOpen, BrainCircuit, ChevronRight, Target, Flame, AlertCircle } from 'lucide-react';
import { Button, CardUI } from './UI';

export interface CoachStats {
  dailyGoal: number;
  completedToday: number;
  remainingWords: number;
  streak: number;
  hardWords: number;
  mediumWords: number;
  easyWords: number;
  reviewNeeded: number;
  lastStudyDate: string;
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
const getRandomMessage = (messages: string[]) => {
  return messages[Math.floor(Math.random() * messages.length)];
};

export const generateCoachMessage = (stats: CoachStats): string => {
  const {
    dailyGoal,
    completedToday,
    remainingWords,
    streak,
    hardWords,
    mediumWords,
    reviewNeeded,
  } = stats;

  // Priority 1: Goal completed
  if (completedToday >= dailyGoal && dailyGoal > 0) {
    return getRandomMessage([
      "🎉 오늘 목표를 달성했어요! 정말 잘했어요.",
      "오늘 목표 완료! 꾸준함이 실력을 만듭니다.",
      "멋져요! 오늘 학습을 모두 완료했습니다."
    ]);
  }

  // Priority 2: Progress motivation
  if (completedToday > 0) {
    return getRandomMessage([
      `좋아요! 지금 ${remainingWords}개만 더 학습하면 오늘 목표를 달성할 수 있어요.`,
      `거의 다 왔어요. ${remainingWords}개만 더 학습하면 오늘 목표 완료!`,
      `지금 학습 흐름이 좋아요. ${remainingWords}개만 더 해볼까요?`
    ]);
  }

  // Priority 3: Streak motivation
  if (streak > 0) {
    return getRandomMessage([
      `🔥 ${streak}일 연속 학습 중이에요. 오늘도 이어가 볼까요?`,
      `${streak}일 연속 학습 기록이 유지되고 있어요!`,
      `오늘 학습하면 ${streak + 1}일 연속 기록이 됩니다.`
    ]);
  }

  // Priority 4: Review recommendation
  if (mediumWords > 0 || reviewNeeded > 0 || hardWords > 0) {
    if (mediumWords > 0) {
      return getRandomMessage([
        `헷갈리는 단어 ${mediumWords}개가 있어요. 먼저 복습해볼까요?`,
        "어제 어려웠던 단어부터 다시 보면 좋아요."
      ]);
    }
    return getRandomMessage([
      `복습이 필요한 단어 ${reviewNeeded}개가 있습니다.`,
      "어제 어려웠던 단어부터 다시 보면 좋아요."
    ]);
  }

  // Priority 5: Start motivation
  return getRandomMessage([
    "오늘 학습을 아직 시작하지 않았어요. 지금 5분만 투자해볼까요?",
    "지금 한 세트만 시작해보세요. 학습 흐름이 만들어질 거예요.",
    `오늘 목표 ${dailyGoal}단어, 지금 시작하면 충분히 달성할 수 있어요.`
  ]);
};

export const getCoachAction = (stats: CoachStats) => {
  if (stats.completedToday >= stats.dailyGoal && stats.dailyGoal > 0) return { label: "더 학습하기", action: 'decks' };
  if (stats.completedToday > 0) return { label: "이어서 학습하기", action: 'study' };
  if (stats.mediumWords > 0 || stats.reviewNeeded > 0) return { label: "복습 시작하기", action: 'study' };
  return { label: "학습 시작하기", action: 'study' };
};

// 3. AICoachCard Component
export const AICoachCard = ({ stats, onAction }: { stats: CoachStats; onAction: (action: string) => void }) => {
  const [message, setMessage] = useState('');
  
  // Update message whenever stats change
  useEffect(() => {
    setMessage(generateCoachMessage(stats));
  }, [stats.completedToday, stats.streak, stats.dailyGoal, stats.reviewNeeded, stats.mediumWords]);

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
        <div className="px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-600 border border-slate-200">오늘 {stats.completedToday}/{stats.dailyGoal}</div>
        <div className="px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-600 border border-slate-200">복습 필요 {stats.reviewNeeded}개</div>
        <div className="px-3 py-1 bg-white rounded-full text-xs font-medium text-slate-600 border border-slate-200">헷갈림 {stats.mediumWords}개</div>
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
