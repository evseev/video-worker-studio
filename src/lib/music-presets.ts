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
  // Tracks already used on the channel (YouTube Audio Library, Aakash Gandhi). Files live in
  // /public/music/ (gitignored); copy them there on a new machine. Looped by the composition.
  {
    id: "lifting-dreams",
    name: "Lifting Dreams",
    mood: "Warm, nostalgic piano",
    url: "/music/lifting-dreams.mp3",
    duration: 188,
  },
  {
    id: "twinkle-in-the-night",
    name: "Twinkle in the Night",
    mood: "Gentle, tender",
    url: "/music/twinkle-in-the-night.mp3",
    duration: 168,
  },
  {
    id: "mysterious-sorrows",
    name: "Mysterious Sorrows",
    mood: "Wistful, reflective",
    url: "/music/mysterious-sorrows.mp3",
    duration: 146,
  },
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
