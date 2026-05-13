import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChannelSettingsClient } from "@/components/channel-settings/channel-settings-client";

export default async function ChannelSettingsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: channel } = await supabase.from("channels").select("*").eq("id", id).maybeSingle();
  if (!channel) {
    notFound();
  }

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("channel_id", id);

  return <ChannelSettingsClient channel={channel} projectCount={count ?? 0} />;
}
