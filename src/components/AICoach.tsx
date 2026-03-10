import React, { useMemo } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { Button, CardUI } from './UI';

export type CoachStats = {
  dailyGoal: number;
  completedToday: number;
  remainingWords?: number;
  streak: number;
  hardWords: number;
  mediumWords: number;
  easyWords: number;
  reviewNeeded: number;
  lastStudyDate?: string;
  userName?: string;
};

type AICoachCardProps = {
  stats: CoachStats;
  onAction?: (action: 'study' | 'upload' | 'decks') => void;
};

const coachMessages = {
  start: [
    '지금 한 세트만 시작해볼까요?',
    '오늘 목표를 향해 첫 단어부터 시작해보세요.',
    '지금 시작하면 오늘 목표 달성 가능합니다.',
    '지금 한 번 시작해볼까요?',
    '첫 단어부터 가볍게 시작해봅시다.',
    '작은 시작이 큰 성과로 이어집니다.',
    '오늘 학습을 아직 시작하지 않았어요.',
    '지금 시작하면 충분히 목표 달성 가능합니다.',
    '단어 하나부터 시작해보세요.',
    '지금 시작하면 학습 흐름이 만들어집니다.',
    '오늘 목표를 채울 좋은 타이밍이에요.',
    '가볍게 시작하면 금방 흐름이 생겨요.',
    '오늘도 한 걸음 시작해봐요.',
    '지금 시작하면 내일이 더 쉬워져요.',
    '오늘 학습, 지금 시작해볼까요?',
    '첫 단어를 열면 공부가 시작됩니다.',
    '잠깐만 집중해서 시작해봐요.',
    '지금이 학습 시작하기 가장 좋은 순간이에요.',
    '오늘 목표, 충분히 해낼 수 있어요.',
    '한 문제만 풀어도 흐름이 바뀝니다.'
  ],
  progress: [
    '좋아요! 학습 흐름이 만들어지고 있어요.',
    '지금 페이스가 아주 좋아요.',
    '계속 이어가 볼까요?',
    '지금 학습이 잘 진행되고 있어요.',
    '꾸준히 잘하고 있어요.',
    '학습 흐름이 좋습니다.',
    '지금 집중력이 좋네요.',
    '좋은 학습 페이스입니다.',
    '조금만 더 해볼까요?',
    '계속 이어가면 목표에 가까워집니다.',
    '지금처럼만 가면 충분해요.',
    '좋은 리듬으로 공부하고 있어요.',
    '계속하면 오늘 목표가 보여요.',
    '잘하고 있어요. 이 흐름 유지해봐요.',
    '조금씩 확실하게 쌓이고 있어요.',
    '좋은 출발이었어요. 계속 가볼까요?',
    '학습이 차곡차곡 쌓이고 있어요.',
    '지금의 집중이 큰 차이를 만들어요.',
    '멋져요. 계속 진행해봐요.',
    '오늘 흐름, 꽤 좋아요.'
  ],
  almostDone: [
    '거의 다 왔어요!',
    '조금만 더 하면 목표 달성입니다.',
    '이제 거의 끝났어요.',
    '마지막까지 힘내봅시다.',
    '목표가 바로 앞입니다.',
    '마무리 단계입니다.',
    '이제 몇 개만 더 하면 됩니다.',
    '마지막 스퍼트입니다.',
    '이제 조금만 더!',
    '거의 완료입니다.',
    '마지막 몇 개만 정리하면 끝이에요.',
    '조금만 더 하면 오늘 목표 완료!',
    '거의 성공했어요.',
    '끝이 보이고 있어요.',
    '딱 조금만 더 하면 됩니다.',
    '오늘 목표까지 아주 가까워요.',
    '마지막 힘만 내보면 돼요.',
    '조금만 더 집중해봐요.',
    '이제 마무리만 남았어요.',
    '오늘 목표, 거의 손에 잡혔어요.'
  ],
  completed: [
    '🎉 오늘 목표를 달성했습니다!',
    '정말 잘했어요!',
    '오늘 학습을 완료했습니다.',
    '멋져요! 오늘 목표 완료!',
    '대단해요! 오늘 학습 성공!',
    '오늘 목표를 완벽히 달성했어요.',
    '정말 훌륭합니다.',
    '오늘 학습 완료!',
    '꾸준함이 대단해요.',
    '멋진 학습입니다!',
    '오늘도 해냈어요. 정말 좋아요!',
    '목표 달성 성공! 아주 잘했어요.',
    '오늘의 공부를 멋지게 끝냈어요.',
    '완료했어요! 스스로 칭찬해도 좋아요.',
    '오늘도 한 걸음 크게 나아갔어요.',
    '학습 목표 달성! 최고예요.',
    '오늘의 노력이 잘 쌓였어요.',
    '끝까지 해낸 게 정말 멋져요.',
    '오늘 목표 클리어!',
    '완료했어요! 내일도 이어가봐요.'
  ],
  review: [
    '복습이 필요한 단어가 있습니다.',
    '헷갈리는 단어를 먼저 복습해볼까요?',
    '어제 어려웠던 단어를 다시 보면 좋아요.',
    '복습하면 기억이 더 오래갑니다.',
    '복습을 시작해볼까요?',
    '헷갈리는 단어부터 다시 학습해보세요.',
    '복습이 학습의 핵심입니다.',
    '지금 복습하기 좋은 타이밍입니다.',
    '복습으로 기억을 강화해보세요.',
    '복습을 통해 완전히 익혀봅시다.',
    '지금은 새 단어보다 복습이 더 효과적이에요.',
    '어려웠던 단어를 다시 보면 실력이 빨리 늘어요.',
    '복습하면 헷갈림이 줄어듭니다.',
    '먼저 복습부터 해보는 게 좋아요.',
    '복습이 쌓이면 자신감도 올라가요.',
    '기억을 단단하게 만들 시간이에요.',
    '복습할 단어부터 정리해봐요.',
    '헷갈리는 단어를 지금 잡아두면 좋아요.',
    '복습은 가장 확실한 공부예요.',
    '복습 추천! 지금 보면 더 잘 외워져요.'
  ],
  streak: [
    '🔥 연속 학습 기록을 이어가고 있어요.',
    '연속 학습이 계속되고 있습니다.',
    '오늘도 기록을 이어가 볼까요?',
    '연속 학습 멋집니다!',
    '지금 연속 학습 중입니다.',
    '꾸준함이 정말 대단합니다.',
    '연속 학습 기록이 유지되고 있어요.',
    '오늘도 이어가 봅시다.',
    '기록을 계속 유지해봅시다.',
    '연속 학습이 실력을 만듭니다.',
    '지금 좋은 학습 습관이 만들어지고 있어요.',
    '기록이 이어지는 중이에요. 아주 좋아요.',
    '꾸준함이 큰 힘이 되고 있어요.',
    '오늘도 기록을 지켜볼까요?',
    '연속 학습, 정말 멋진 흐름이에요.',
    '좋은 습관이 쌓이고 있습니다.',
    '오늘도 이어가면 기록이 더 길어져요.',
    '연속 학습은 최고의 자산이에요.',
    '지금처럼 꾸준히 가면 정말 강해져요.',
    '학습 기록을 이어가는 중이에요.'
  ]
};

function getRandomMessage(arr: string[], seedText: string) {
  if (!arr.length) return '';
  const seed = seedText
    .split('')
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return arr[seed % arr.length];
}

function generateCoachMessage(stats: CoachStats) {
  const dailyGoal = Number(stats.dailyGoal || 0);
  const completedToday = Number(stats.completedToday || 0);
  const remainingWords = Math.max(
    0,
    Number(
      stats.remainingWords ??
      Math.max(0, dailyGoal - completedToday)
    )
  );
  const streak = Number(stats.streak || 0);
  const reviewNeeded = Number(stats.reviewNeeded || 0);

  if (remainingWords <= 0 && dailyGoal > 0) {
    const main = getRandomMessage(
      coachMessages.completed,
      `completed-${completedToday}-${dailyGoal}-${streak}`
    );
    return {
      message: main,
      actionLabel: '단어장 보러가기',
      action: 'decks' as const,
      chips: [
        `오늘 목표 완료`,
        `연속 학습 ${streak}일`,
        `오늘 ${completedToday}/${dailyGoal}`
      ]
    };
  }

  if (completedToday > 0 && remainingWords <= 3) {
    return {
      message: `좋아요! 지금 ${remainingWords}개만 더 학습하면 오늘 목표를 달성할 수 있어요.`,
      actionLabel: '이어서 학습하기',
      action: 'study' as const,
      chips: [
        `오늘 ${completedToday}/${dailyGoal}`,
        `남은 단어 ${remainingWords}개`,
        `연속 학습 ${streak}일`
      ]
    };
  }

  if (completedToday > 0) {
    const main = getRandomMessage(
      coachMessages.progress,
      `progress-${completedToday}-${remainingWords}-${streak}`
    );
    return {
      message: `${main} 오늘 목표까지 ${remainingWords}개 남았어요.`,
      actionLabel: '이어서 학습하기',
      action: 'study' as const,
      chips: [
        `오늘 ${completedToday}/${dailyGoal}`,
        `남은 단어 ${remainingWords}개`,
        `복습 필요 ${reviewNeeded}개`
      ]
    };
  }

  if (reviewNeeded > 0) {
    const main = getRandomMessage(
      coachMessages.review,
      `review-${reviewNeeded}-${streak}`
    );
    return {
      message: `${main} 지금 복습이 필요한 단어는 ${reviewNeeded}개예요.`,
      actionLabel: '복습 시작하기',
      action: 'study' as const,
      chips: [
        `복습 필요 ${reviewNeeded}개`,
        `헷갈림 ${stats.mediumWords}개`,
        `모르겠음 ${stats.hardWords}개`
      ]
    };
  }

  if (streak > 0) {
    const main = getRandomMessage(
      coachMessages.streak,
      `streak-${streak}-${dailyGoal}`
    );
    return {
      message: `${main} 오늘도 이어가면 ${streak + 1}일 기록에 가까워져요.`,
      actionLabel: '오늘 학습 시작',
      action: 'study' as const,
      chips: [
        `연속 학습 ${streak}일`,
        `오늘 목표 ${dailyGoal}개`,
        `오늘 시작 전`
      ]
    };
  }

  const main = getRandomMessage(
    coachMessages.start,
    `start-${dailyGoal}-${completedToday}`
  );
  return {
    message: `${main} 오늘 목표는 ${dailyGoal}개예요.`,
    actionLabel: '오늘 학습 시작',
    action: 'study' as const,
    chips: [
      `오늘 목표 ${dailyGoal}개`,
      `복습 필요 ${reviewNeeded}개`,
      `지금 시작하기`
    ]
  };
}

export function AICoachCard({ stats, onAction }: AICoachCardProps) {
  const coach = useMemo(() => generateCoachMessage(stats), [stats]);

  const safeMessage =
    typeof coach.message === 'string'
      ? coach.message.replace(/\bundefined\b/g, '').replace(/\s+/g, ' ').trim()
      : '';

  const chips = Array.isArray(coach.chips)
    ? coach.chips.filter(Boolean)
    : [];

  return (
    <CardUI className="p-6 md:p-7 bg-indigo-50 border-indigo-100">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-black text-slate-900 mb-3">AI 학습 코치</h3>
          <p className="text-slate-700 text-base leading-7 break-keep">
            {safeMessage}
          </p>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-5">
              {chips.map((chip, index) => (
                <span
                  key={`${chip}-${index}`}
                  className="px-3 py-1 rounded-full text-xs font-bold bg-white text-slate-600 border border-slate-200"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}

          <div className="mt-5">
            <Button
              className="w-full md:w-auto gap-2 font-bold"
              onClick={() => onAction?.(coach.action)}
            >
              {coach.actionLabel}
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </CardUI>
  );
}