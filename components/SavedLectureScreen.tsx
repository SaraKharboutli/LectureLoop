"use client";

import { answerInLecture, retryInLecture, type SavedLecture } from "@/lib/session/savedLectures";
import { formatClock } from "@/lib/checkpoints/window";
import { formatLectureDate } from "./MyLectures";
import { SummaryScreen } from "./SummaryScreen";

type Props = {
  lecture: SavedLecture;
  onChange: (lecture: SavedLecture) => void;
  onDelete: () => void;
  onBack: () => void;
  newId: () => string;
};

export function SavedLectureScreen({ lecture, onChange, onDelete, onBack, newId }: Props) {
  const words = lecture.transcript.split(/\s+/).filter(Boolean).length;
  return (
    <SummaryScreen
      questions={lecture.questions}
      wordCount={words}
      subtitle={`${formatLectureDate(lecture.savedAt)} · ${formatClock(lecture.durationSec)} of lecture`}
      onAnswer={(qid, i) => onChange(answerInLecture(lecture, qid, i))}
      onRetry={(qid) => onChange(retryInLecture(lecture, qid, newId()))}
      footer={
        <>
          <button
            type="button"
            onClick={onBack}
            className="min-h-14 w-full rounded-2xl bg-primary px-6 text-lg font-semibold text-white shadow-sm transition hover:bg-primary-dark"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Delete this lecture from this device?")) onDelete();
            }}
            className="min-h-12 w-full rounded-2xl px-6 text-sm font-semibold text-muted transition hover:bg-tint"
          >
            Delete this lecture
          </button>
        </>
      }
    >
      {lecture.transcript && (
        <details className="mt-8 rounded-2xl bg-tint p-4">
          <summary className="cursor-pointer font-semibold">Lecture text</summary>
          <p className="mt-3 whitespace-pre-wrap text-[15px] leading-7">{lecture.transcript}</p>
        </details>
      )}
    </SummaryScreen>
  );
}
