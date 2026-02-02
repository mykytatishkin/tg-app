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

export const QUICK_TEST_QUESTIONS: string[] = [
  'What is your main goal? (e.g. learn basics, get certified, switch career)',
  'How much time can you spend per week? (hours)',
  'What is your experience level? (beginner / intermediate / advanced)',
  'Do you prefer video, text, or interactive content?',
  'What topic interests you most? (e.g. programming, design, marketing)',
  'Are you learning alone or with a team?',
  'What is your budget range? (free / low / medium / high)',
  'Do you need a certificate or credential?',
  'What device do you use most? (desktop / mobile / both)',
  'Anything else we should know?',
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
