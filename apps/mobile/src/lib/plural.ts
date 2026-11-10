/** "1 entry", "3 entries". */
export function plural(count: number, one: string, many: string = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** 1200 becomes "1.2k". */
export function compact(count: number): string {
  if (count < 1000) return String(count);
  const thousands = count / 1000;
  return `${thousands >= 10 ? Math.round(thousands) : Math.round(thousands * 10) / 10}k`;
}

/** "1.2k following", or an invitation when nobody follows yet. */
export function followersLabel(count: number): string {
  return count === 0 ? 'Be the first to follow' : `${compact(count)} following`;
}
