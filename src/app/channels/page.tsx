import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function ChannelsListPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: channels } = await supabase
    .from("channels")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-white/10 bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-sm text-zinc-400 hover:text-white">
            ← Dashboard
          </Link>
          <h1 className="text-lg font-semibold">Channels</h1>
          <span className="w-16" />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8 flex items-center justify-between gap-4">
          <p className="text-zinc-400 text-sm">
            Each channel is a brand hub: identity, defaults, and AI context.
          </p>
          <Link
            href="/channels/new"
            className="shrink-0 rounded-lg bg-linear-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500"
          >
            Create channel
          </Link>
        </div>
        <ul className="space-y-3">
          {(channels ?? []).map((c) => (
            <li key={c.id}>
              <Link
                href={`/channels/${c.id}/settings`}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/10"
              >
                {c.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-lg bg-linear-to-br from-violet-500/40 to-indigo-600/40" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-xs text-zinc-500 truncate">{c.slug}</p>
                </div>
                <span className="text-xs text-violet-400">Settings</span>
              </Link>
            </li>
          ))}
        </ul>
        {channels?.length === 0 ? (
          <p className="mt-6 text-center text-sm text-zinc-500">No channels yet.</p>
        ) : null}
      </main>
    </div>
  );
}
