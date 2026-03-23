export interface MusicTrack {
  id: string;
  name: string;
  mood: string;
  /** URL to the audio file (Supabase Storage or /public/music/) */
  url: string;
  /** Duration in seconds (for display only) */
  duration: number;
}

/**
 * Royalty-free background music presets.
 * To add tracks: upload MP3 to Supabase Storage `music/` bucket or
 * place in `/public/music/` and reference the public path here.
 */
export const MUSIC_PRESETS: MusicTrack[] = [
  {
    id: "upbeat",
    name: "Upbeat Energy",
    mood: "Energetic, positive",
    url: "/music/upbeat.mp3",
    duration: 120,
  },
  {
    id: "chill",
    name: "Chill Vibes",
    mood: "Relaxed, ambient",
    url: "/music/chill.mp3",
    duration: 120,
  },
  {
    id: "dramatic",
    name: "Dramatic Rise",
    mood: "Cinematic, intense",
    url: "/music/dramatic.mp3",
    duration: 120,
  },
  {
    id: "corporate",
    name: "Corporate Clean",
    mood: "Professional, neutral",
    url: "/music/corporate.mp3",
    duration: 120,
  },
  {
    id: "epic",
    name: "Epic Orchestral",
    mood: "Grand, inspiring",
    url: "/music/epic.mp3",
    duration: 120,
  },
];

/** Find a track by ID, or return null */
export function getMusicTrack(id: string): MusicTrack | null {
  return MUSIC_PRESETS.find((t) => t.id === id) ?? null;
}
