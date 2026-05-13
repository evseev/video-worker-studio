"use client";

import { useState } from "react";
import Link from "next/link";
import type { Tables } from "@/lib/supabase/types";
import { IdentityTab } from "@/components/channel-settings/identity-tab";
import { AiContextTab } from "@/components/channel-settings/ai-context-tab";
import { YoutubeTab } from "@/components/channel-settings/youtube-tab";
import { DefaultsTab } from "@/components/channel-settings/defaults-tab";
import { WatermarkTab } from "@/components/channel-settings/watermark-tab";
import { SubjectMemoryTab } from "@/components/channel-settings/subject-memory-tab";
import { ScenePresetsTab } from "@/components/channel-settings/scene-presets-tab";
import { TopicBacklogTab } from "@/components/channel-settings/topic-backlog-tab";
import { DangerZoneTab } from "@/components/channel-settings/danger-zone-tab";

type Channel = Tables<"channels">;

const TABS = [
  { id: "identity", label: "Identity" },
  { id: "ai", label: "AI Context" },
  { id: "youtube", label: "YouTube" },
  { id: "defaults", label: "Defaults" },
  { id: "watermark", label: "Watermark" },
  { id: "memory", label: "Subject Memory" },
  { id: "presets", label: "Scene Presets" },
  { id: "topics", label: "Topic Backlog" },
  { id: "danger", label: "Danger Zone" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ChannelSettingsClient({
  channel: initialChannel,
  projectCount,
}: {
  channel: Channel;
  projectCount: number;
}) {
  const [channel, setChannel] = useState(initialChannel);
  const [tab, setTab] = useState<TabId>("identity");

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <header className="border-b border-white/10 bg-[#0a0a0f]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/channels" className="text-sm text-zinc-400 hover:text-white">
              ← Channels
            </Link>
            <h1 className="mt-2 text-xl font-bold">{channel.name}</h1>
            <p className="text-sm text-zinc-500">Settings</p>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-8 lg:flex-row">
        <nav className="flex gap-2 overflow-x-auto pb-2 lg:w-52 lg:flex-col lg:gap-1 lg:pb-0 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors cursor-pointer ${
                tab === t.id
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <section className="min-w-0 flex-1">
          {tab === "identity" ? <IdentityTab channel={channel} onSaved={setChannel} /> : null}
          {tab === "ai" ? <AiContextTab channel={channel} onSaved={setChannel} /> : null}
          {tab === "youtube" ? <YoutubeTab /> : null}
          {tab === "defaults" ? <DefaultsTab /> : null}
          {tab === "watermark" ? <WatermarkTab channel={channel} onSaved={setChannel} /> : null}
          {tab === "memory" ? <SubjectMemoryTab channel={channel} onSaved={setChannel} /> : null}
          {tab === "presets" ? <ScenePresetsTab /> : null}
          {tab === "topics" ? <TopicBacklogTab /> : null}
          {tab === "danger" ? <DangerZoneTab channel={channel} projectCount={projectCount} /> : null}
        </section>
      </div>
    </div>
  );
}
