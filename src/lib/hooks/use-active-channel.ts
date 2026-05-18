"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const LS_KEY = "vws.activeChannelId";
const QUERY = "channel";

export type ActiveChannelSummary = {
  id: string;
  name: string;
  logo_url: string | null;
  project_count: number;
};

export function useActiveChannel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [channels, setChannels] = useState<ActiveChannelSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChannelId, setActiveState] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/channels");
        if (!res.ok) {
          throw new Error("channels fetch failed");
        }
        const body = (await res.json()) as { channels?: ActiveChannelSummary[] };
        if (!cancelled) {
          setChannels(body.channels ?? []);
        }
      } catch {
        if (!cancelled) {
          setChannels([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const ids = new Set(channels.map((c) => c.id));
    const fromQuery = searchParams.get(QUERY);
    if (fromQuery && ids.has(fromQuery)) {
      setActiveState(fromQuery);
      try {
        localStorage.setItem(LS_KEY, fromQuery);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const fromLs = localStorage.getItem(LS_KEY);
      if (fromLs && ids.has(fromLs)) {
        setActiveState(fromLs);
        return;
      }
    } catch {
      /* ignore */
    }
    setActiveState(null);
  }, [channels, isLoading, searchParams]);

  const setActiveChannelId = useCallback(
    (id: string | null) => {
      const ids = new Set(channels.map((c) => c.id));
      setActiveState(id);
      const params = new URLSearchParams(searchParams.toString());
      if (id && ids.has(id)) {
        params.set(QUERY, id);
        try {
          localStorage.setItem(LS_KEY, id);
        } catch {
          /* ignore */
        }
      } else {
        params.delete(QUERY);
        try {
          localStorage.removeItem(LS_KEY);
        } catch {
          /* ignore */
        }
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [channels, pathname, router, searchParams]
  );

  return { activeChannelId, setActiveChannelId, channels, isLoading };
}
