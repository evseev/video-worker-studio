"use client";

import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";
import type { WizardStoreApi } from "@/lib/stores/wizard-store";
import type { Tables } from "@/lib/supabase/types";
import { parseScenePresetSettingsJson, scenePresetPayloadToWizardState } from "@/lib/channels/scene-preset-settings";
import { absoluteAppUrl } from "@/lib/client-url";

type Preset = Tables<"channel_scene_presets">;

export function ApplyPresetButton({ store }: { store: WizardStoreApi }) {
  const channelId = useStore(store, (s) => s.channelId);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(absoluteAppUrl(`/api/channels/${channelId}/scene-presets`));
    const body = (await res.json()) as { presets?: Preset[] };
    if (res.ok) {
      setPresets(body.presets ?? []);
    }
  }, [channelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyAndSaveDraft() {
    const preset = presets.find((p) => p.id === selected);
    if (!preset) return;
    const parsed = parseScenePresetSettingsJson(preset.settings_json);
    if (!parsed) {
      setErr("Invalid preset data");
      return;
    }
    const next = scenePresetPayloadToWizardState(parsed);
    setBusy(true);
    setErr(null);
    try {
      const st = store.getState();
      st.setSelectedTemplate(next.selectedTemplate);
      st.setSettings(next.settings);
      const after = store.getState();
      await after.saveProgress({
        template: after.selectedTemplate,
        draft_scenes: {
          scenes: after.scenes,
          settings: after.settings,
          refinedIdea: after.refinedIdea,
        },
      });
    } catch {
      setErr("Could not save draft");
    } finally {
      setBusy(false);
    }
  }

  if (presets.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-violet-500/50"
      >
        <option value="">Apply preset…</option>
        {presets.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        disabled={!selected || busy}
        onClick={() => void applyAndSaveDraft()}
        className="rounded-lg border border-violet-500/40 bg-violet-600/20 px-3 py-1.5 text-xs font-medium text-violet-100 hover:bg-violet-600/30 disabled:opacity-50"
      >
        Apply
      </button>
      {err ? <span className="text-xs text-red-400">{err}</span> : null}
    </div>
  );
}
