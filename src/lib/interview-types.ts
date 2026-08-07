export type CurriculumDay = {
  day: number;
  title: string;
  type: string;
  tools: string[];
  objectives: string[];
};

export type Module = { n: number; title: string; days: number[] };

export type Mission = {
  day: number;
  title: string;
  passed?: boolean;
  attempts?: number;
  skipped?: boolean;
};

export type Candidate = {
  member: {
    id: string;
    name: string;
    jobRole: string;
    yearsExperience: number;
    education: string;
    status: string;
  };
  missions: Mission[];
  signals?: { commitDays?: number; missionsCompleted?: number; missionsFirstTry?: number };
};

export type PlanItem = {
  day: number;
  title: string;
  tools: string[];
  objectives: string[];
  attempts: number;
  asked: number;
  skippedMention?: string;
};

export type Rubric = {
  correctness: number;
  depth: number;
  specificity: number;
  communication: number;
};

export type ScoredAnswer = {
  questionId: string;
  day: number;
  topic: string;
  question: string;
  answer: string;
  rubric: Rubric;
  note: string;
};

export type Feedback = {
  summary: string;
  strengths: string[];
  gaps: string[];
  next: string[];
};

export type Session = {
  sessionId: string;
  candidate: Candidate;
  plan: PlanItem[];
  askedQuestions: { id: string; text: string; day: number }[];
  coveredDays: number[];
  transcript: { role: "user" | "assistant"; content: string }[];
  scores: ScoredAnswer[];
  answered: number;
  done: boolean;
  feedback?: Feedback;
  updatedAt: number;
};

export type InterviewResponse = {
  reply: string;
  done: boolean;
  feedback?: Feedback;
  progress?: { answered: number; minQuestions: number; coveredDays: number[] };
  review?: { question: string; answer: string; note: string; day: number; topic: string }[];
};
