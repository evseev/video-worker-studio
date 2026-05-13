import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: projects } = await supabase
    .from("projects")
    .select("*, channels(id, name, logo_url)")
    .order("created_at", { ascending: false });

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f]" aria-hidden />}>
      <Dashboard user={user} projects={projects ?? []} />
    </Suspense>
  );
}
