const NON_ALNUM_SPACE_REGEX = /[^a-z0-9\s]/g;
const MULTI_SPACE_REGEX = /\s+/g;

export function normalizeSubject(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(NON_ALNUM_SPACE_REGEX, " ")
    .replace(MULTI_SPACE_REGEX, " ")
    .trim();
}
