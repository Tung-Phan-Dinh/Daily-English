import { redirect } from "next/navigation";
import { getViewer, homeFor } from "@/lib/auth";

export default async function Home() {
  const viewer = await getViewer();
  redirect(viewer ? homeFor(viewer.role) : "/login");
}
