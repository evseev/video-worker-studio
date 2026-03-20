import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { WizardClient } from "./client";

export default async function WizardPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  if (!project) {
    notFound();
  }

  if (project.status === "completed") {
    redirect(`/projects/${project.id}`);
  }

  return <WizardClient project={project} />;
}
