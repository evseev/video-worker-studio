"use client";

import { useState } from "react";
import { useStore } from "zustand";
import type { WizardStoreApi } from "@/lib/stores/wizard-store";
import { wizardStateToScenePresetPayload } from "@/lib/channels/scene-preset-settings";
import { absoluteAppUrl } from "@/lib/client-url";

export function SavePresetButton({ store }: { store: WizardStoreApi }) {
  const channelId = useStore(store, (s) => s.channelId);
  const selectedTemplate = useStore(store, (s) => s.selectedTemplate);
  const settings = useStore(store, (s) => s.settings);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    setOk(null);
    try {
      const settings_json = wizardStateToScenePresetPayload(selectedTemplate, settings);
      const res = await fetch(absoluteAppUrl(`/api/channels/${channelId}/scene-presets`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          template_id: selectedTemplate,
          settings_json,
        }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(body.error ?? "Save failed");
        return;
      }
      setOk("Saved");
      setName("");
      setOpen(false);
    } catch {
      setErr("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setErr(null);
          setOk(null);
        }}
        className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/10"
      >
        Save as preset
      </button>
      {open ? (
        <form
          onSubmit={save}
          className="absolute right-0 z-20 mt-2 w-72 rounded-xl border border-white/10 bg-[#12121a] p-3 shadow-xl"
        >
          <label className="mb-1 block text-xs text-zinc-400">Preset name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white outline-none focus:border-violet-500/50"
            placeholder="e.g. Fast facts 9:16"
          />
          {err ? <p className="mb-2 text-xs text-red-400">{err}</p> : null}
          {ok ? <p className="mb-2 text-xs text-emerald-400">{ok}</p> : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-1 text-xs text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
