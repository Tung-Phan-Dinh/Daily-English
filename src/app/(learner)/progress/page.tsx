import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";
import { requireViewer } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard/stats";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My progress" };

export default async function ProgressPage() {
  const viewer = await requireViewer(["learner"]);
  const db = await createClient();
  const data = await getDashboardData(db, viewer.id, viewer.timezone);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My progress</h1>
        <p className="mt-1 text-muted-foreground">The same view your family sees — plus your lookups.</p>
      </div>
      <Dashboard data={data} lang={viewer.ui_lang} mode="learner" />
    </div>
  );
}
