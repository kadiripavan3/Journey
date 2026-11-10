/** "Maya" from "Maya Okafor": what to call someone in a sentence. Empty when there is no name. */
export function firstName(displayName: string | null | undefined): string {
  return displayName?.trim().split(/\s+/)[0] ?? '';
}
