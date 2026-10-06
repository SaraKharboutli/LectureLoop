import { Suspense } from "react";
import { LectureLoopApp } from "@/components/LectureLoopApp";

export default function Home() {
  return (
    <Suspense>
      <LectureLoopApp />
    </Suspense>
  );
}
