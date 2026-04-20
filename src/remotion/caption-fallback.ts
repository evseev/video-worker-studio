/**
 * Resolve the on-screen caption text for a scene.
 *
 * Epic 23 introduced a dedicated `captionText` field separate from `scriptText`
 * (which is reserved for voiceover narration). Legacy scenes persisted before
 * the migration don't carry `captionText`, so we fall back to `scriptText` to
 * preserve their original rendered caption instead of showing an empty overlay.
 *
 * An empty-or-whitespace `captionText` is treated the same as missing, because
 * the Preview step defaults new scenes to `""` and we don't want a blank scene
 * to erase an otherwise-useful narration.
 */
export function resolveCaption(
  captionText: string | null | undefined,
  scriptText: string
): string {
  if (typeof captionText === "string" && captionText.trim().length > 0) {
    return captionText;
  }
  return scriptText;
}
