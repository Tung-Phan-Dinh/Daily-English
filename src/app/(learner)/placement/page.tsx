import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { PlacementFlow } from "./placement-flow";

export const metadata: Metadata = { title: "Placement" };

export default async function PlacementPage() {
  await requireViewer(["learner"]);
  return <PlacementFlow />;
}
