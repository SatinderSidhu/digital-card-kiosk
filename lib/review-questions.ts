export type ReviewQuestion = {
  id: string;
  prompt: string;
  /** Seconds the question stays on screen before auto-advancing. */
  durationSec: number;
};

export const REVIEW_QUESTIONS: ReviewQuestion[] = [
  {
    id: "intro",
    prompt: "Introduce yourself and your business?",
    durationSec: 20,
  },
  {
    id: "expo",
    prompt: "How do you like Small Business Expo? Why did you come?",
    durationSec: 20,
  },
  {
    id: "outcome",
    prompt: "How did our services contribute to the success of your project?",
    durationSec: 25,
  },
  {
    id: "challenges",
    prompt:
      "What specific challenges were you facing that our services helped to overcome?",
    durationSec: 25,
  },
  {
    id: "favorite",
    prompt:
      "What features or aspects of our services do you appreciate the most?",
    durationSec: 25,
  },
  {
    id: "communication",
    prompt:
      "How effective was our communication throughout the duration of the project?",
    durationSec: 20,
  },
];

export const REVIEW_TOTAL_SECONDS = REVIEW_QUESTIONS.reduce(
  (sum, q) => sum + q.durationSec,
  0,
);
