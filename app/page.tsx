import type { Metadata } from "next";
import DoodleyStudio from "./DoodleyStudio";

export const metadata: Metadata = {
  title: "Doodley — Dithered drawing sprints",
  description:
    "Practice fast, pixel-dithered drawing sprints from references you choose.",
};

export default function Home() {
  return <DoodleyStudio />;
}
