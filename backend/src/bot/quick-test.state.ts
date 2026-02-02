/** In-memory state for the /quick-test conversation flow. */
export interface QuickTestState {
  step: number;
  answers: string[];
}

export const quickTestSessions = new Map<string, QuickTestState>();

export type SessionKeyContext = { chat?: { id: number }; from?: { id: number } };

export function getSessionKey(ctx: SessionKeyContext): string {
  const id = ctx.chat?.id ?? ctx.from?.id;
  return id != null ? String(id) : '';
}

export interface QuickTestQuestion {
  text: string;
  options?: string[];
}

export const QUICK_TEST_QUESTIONS: QuickTestQuestion[] = [
  {
    text: 'Какова ваша главная цель?',
    options: ['Освоить основы', 'Получить сертификат', 'Сменить карьеру'],
  },
  {
    text: 'Сколько часов в неделю можете уделять?',
    options: ['1–2 часа', '3–5 часов', '6–10 часов', 'Более 10 часов'],
  },
  {
    text: 'Ваш уровень опыта?',
    options: ['Начинающий', 'Средний', 'Продвинутый'],
  },
  {
    text: 'Что предпочитаете: видео, текст или интерактив?',
    options: ['Видео', 'Текст', 'Интерактив'],
  },
  {
    text: 'Какая тема интереснее? (например: программирование, дизайн, маркетинг)',
  },
  {
    text: 'Учитесь в одиночку или в команде?',
    options: ['Один', 'В команде'],
  },
  {
    text: 'Бюджет на обучение?',
    options: ['Бесплатно', 'Низкий', 'Средний', 'Высокий'],
  },
  {
    text: 'Нужен сертификат или credential?',
    options: ['Да', 'Нет', 'Не важно'],
  },
  {
    text: 'Чем пользуетесь чаще: ПК или телефон?',
    options: ['ПК', 'Телефон', 'Оба'],
  },
  {
    text: 'Что ещё важно учесть? (напишите текстом)',
  },
];

export interface MockCourse {
  id: string;
  name: string;
  description: string;
  tags: string[];
}

export const MOCK_COURSES: MockCourse[] = [
  { id: 'c1', name: 'Starter Course', description: 'Beginner-friendly intro. Short videos, no prior experience needed.', tags: ['beginner', 'video', 'free', 'basics'] },
  { id: 'c2', name: 'Pro Track', description: 'Deep dive for intermediate learners. Text + exercises.', tags: ['intermediate', 'text', 'medium', 'certificate'] },
  { id: 'c3', name: 'Expert Masterclass', description: 'Advanced level. Live sessions and team projects.', tags: ['advanced', 'interactive', 'high', 'team'] },
  { id: 'c4', name: 'Quick Wins', description: 'Short lessons for busy people. Mobile-first.', tags: ['beginner', 'mobile', 'low', 'basics'] },
  { id: 'c5', name: 'Career Switch', description: 'Full program with certificate and job prep.', tags: ['intermediate', 'video', 'high', 'certificate', 'career'] },
  { id: 'c6', name: 'Learn Together', description: 'Group cohorts and peer learning.', tags: ['team', 'interactive', 'medium'] },
];

const TAG_ALIASES: Record<string, string> = {
  beginner: 'beginner',
  basics: 'basics',
  intermediate: 'intermediate',
  advanced: 'advanced',
  video: 'video',
  text: 'text',
  interactive: 'interactive',
  free: 'free',
  low: 'low',
  medium: 'medium',
  high: 'high',
  certificate: 'certificate',
  credential: 'certificate',
  mobile: 'mobile',
  desktop: 'desktop',
  team: 'team',
  career: 'career',
  // Русские варианты с кнопок
  начинающий: 'beginner',
  средний: 'intermediate',
  продвинутый: 'advanced',
  основы: 'basics',
  сертификат: 'certificate',
  карьеру: 'career',
  видео: 'video',
  текст: 'text',
  интерактив: 'interactive',
  один: 'beginner',
  команде: 'team',
  бесплатно: 'free',
  низкий: 'low',
  высокий: 'high',
  да: 'certificate',
  нет: 'beginner',
  пк: 'desktop',
  телефон: 'mobile',
  оба: 'medium',
};

function extractTagsFromAnswers(answers: string[]): Set<string> {
  const tags = new Set<string>();
  const lower = (s: string) => s.toLowerCase().trim();
  for (const a of answers) {
    const words = a.split(/\s+|,|\./).map(lower).filter(Boolean);
    for (const w of words) {
      if (TAG_ALIASES[w]) tags.add(TAG_ALIASES[w]);
    }
  }
  return tags;
}

/** Pick 3 courses that best match the user's answers (mock selection). */
export function selectCourses(answers: string[]): MockCourse[] {
  const userTags = extractTagsFromAnswers(answers);
  const scored = MOCK_COURSES.map((course) => {
    let score = 0;
    for (const tag of course.tags) {
      if (userTags.has(tag)) score += 1;
    }
    return { course, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3).map((s) => s.course);
  if (top.length < 3) {
    const used = new Set(top.map((c) => c.id));
    for (const { course } of scored) {
      if (top.length >= 3) break;
      if (!used.has(course.id)) {
        used.add(course.id);
        top.push(course);
      }
    }
  }
  return top;
}
