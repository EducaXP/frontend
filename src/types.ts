export interface User {
  id: string;
  name: string;
  role: "teacher" | "student";
  schoolId: string;
}
export interface Classroom {
  id: string;
  name: string;
  paused: boolean;
  joinCode?: string;
}
export interface Group {
  id: string;
  classroomId: string;
  name: string;
  members: { id: string; name: string; role: string }[];
}
export interface Criterion {
  id: string;
  title: string;
  levels: string[];
}
export interface Question {
  id: string;
  topic: string;
  prompt: string;
}
export interface Answer {
  questionId: string;
  text: string;
}
export interface Content {
  questions?: Question[];
  title: string;
  objective: string;
  subject: string;
  schoolYear: string;
  durationMinutes: number;
  offlineAlternative: string;
  steps: {
    title: string;
    instructions: string;
    mode: "screen" | "off_screen";
  }[];
  rubric: Criterion[];
  bnccReference?: { code: string; sourceUrl: string };
}
export interface Mission {
  id: string;
  classroomId: string;
  status: "draft" | "published" | "closed";
  version: number;
  content: Content;
  bnccVerification: string;
}
export interface Evaluation {
  id: string;
  submissionVersion: number;
  feedback: string;
  scores: { criterionId: string; level: number }[];
}
export interface Submission {
  answers?: Answer[];
  id: string;
  missionId: string;
  groupId: string;
  version: number;
  evidence: string;
  reflection: string;
  completedSteps: number[];
  channel: "digital" | "teacher_mediated";
  receivedAfterClosure: boolean;
  evaluation?: Evaluation | null;
}
export interface Operation {
  answers?: Answer[];
  operationId: string;
  submissionId: string;
  missionId: string;
  groupId: string;
  baseVersion: number;
  evidence: string;
  reflection: string;
  completedSteps: number[];
  channel: "digital" | "teacher_mediated";
}
export interface Draft {
  answers?: Answer[];
  missionId: string;
  groupId: string;
  submissionId: string;
  baseVersion: number;
  evidence: string;
  reflection: string;
  completedSteps: number[];
  status: "local" | "queued" | "synced" | "conflict" | "error";
  pending?: Operation;
  conflict?: Submission | null;
  error?: string;
  retryAt?: number;
  attempts?: number;
}
export interface Avatar {
  itemId: string;
  ecoMode: boolean;
  xp: number;
  catalog: {
    id: string;
    name: string;
    requiredXp: number;
    unlocked: boolean;
  }[];
  rewardRule: string;
}
export interface Help {
  id: string;
  groupId: string;
  message: string;
  answer: string | null;
  resolvedAt: string | null;
}
export interface Dashboard {
  enrolledStudents: number;
  groups: number;
  submissions: number;
  awaitingReview: number;
  openHelpRequests: number;
}
export interface PlanningAssistant {
  topics?: string;
  prompt: string;
  resources: string;
  history: { role: "user" | "assistant"; content: string }[];
  proposal?: { reply: string; content: Content; baseContent: string };
}
export interface Workspace {
  user: User;
  authenticatedAt: number;
  classrooms: Classroom[];
  selectedClass: string;
  missions: Mission[];
  groups: Group[];
  drafts: Record<string, Draft>;
  avatar?: Avatar;
  planning?: {
    assistant?: PlanningAssistant;
    content: Content;
    missionId?: string;
    baseVersion?: number;
    classroomId: string;
  };
  updatedAt: number;
}
export interface Credentials {
  role: "teacher" | "student";
  login: string;
  classCode: string;
  alias: string;
  secret: string;
}
export const draftKey = (missionId: string, groupId: string) =>
  `${missionId}:${groupId}`;
