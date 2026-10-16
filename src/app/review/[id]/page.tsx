import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOwnedAutopilotProject } from "@/lib/autopilot/access";
import { ReviewClient } from "./client";

export default async function ReviewPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const project = await getOwnedAutopilotProject(supabase, user.id, id);
  if (!project) notFound();
  return <ReviewClient projectId={project.id} />;
}
