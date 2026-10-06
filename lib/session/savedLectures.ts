// "My lectures": ended sessions saved in this browser on this device (localStorage).
// Every storage access is guarded — private mode or a full disk means "not saved", never a crash.
// See spec.md > Saved Lectures.

import type { Question } from "./types";

export type SavedLecture = {
  id: string;
  /** Epoch ms when the lecture was saved (session end). */
  savedAt: number;
  durationSec: number;
  transcript: string;
  questions: Question[];
};

const KEY = "lectureloop.lectures.v1";
export const MAX_SAVED_LECTURES = 30;

function read(): SavedLecture[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SavedLecture[]) : [];
  } catch {
    return [];
  }
}

function write(lectures: SavedLecture[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(lectures));
    return true;
  } catch {
    return false;
  }
}

/** Newest first. */
export function loadLectures(): SavedLecture[] {
  return read().sort((a, b) => b.savedAt - a.savedAt);
}

/** Insert or replace by id, keeping only the newest MAX_SAVED_LECTURES. */
export function upsertLecture(lecture: SavedLecture): SavedLecture[] {
  const others = read().filter((l) => l.id !== lecture.id);
  const next = [lecture, ...others].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_SAVED_LECTURES);
  write(next);
  return next;
}

export function deleteLecture(id: string): SavedLecture[] {
  const next = read().filter((l) => l.id !== id);
  write(next);
  return next.sort((a, b) => b.savedAt - a.savedAt);
}

/** Record an answer to a question in a saved lecture (answers are final per question). */
export function answerInLecture(lecture: SavedLecture, questionId: string, choiceIndex: number): SavedLecture {
  return {
    ...lecture,
    questions: lecture.questions.map((q) =>
      q.id === questionId && q.answerIndex === null
        ? {
            ...q,
            answerIndex: choiceIndex,
            result: choiceIndex === q.correctIndex ? "correct" : "incorrect",
            answeredFrom: "summary",
          }
        : q,
    ),
  };
}

/** "Try again": append a fresh, unanswered copy so a later correct answer counts as understood after review. */
export function retryInLecture(lecture: SavedLecture, questionId: string, newId: string): SavedLecture {
  const q = lecture.questions.find((x) => x.id === questionId);
  if (!q) return lecture;
  const copy: Question = { ...q, id: newId, kind: "recheck", answerIndex: null, result: "unanswered", answeredFrom: undefined };
  return { ...lecture, questions: [...lecture.questions, copy] };
}
