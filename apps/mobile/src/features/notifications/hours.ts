/** Every hour of the day, from six in the morning round to five the next, for choosing when reminders arrive. */
export const HOURS = Array.from({ length: 24 }, (_, index) => (index + 6) % 24);

/** An hour of the day the way a person says it: 19 is "7:00 pm", 0 is "12:00 am". */
export function hourLabel(hour: number): string {
  const onClock = hour % 12 === 0 ? 12 : hour % 12;
  return `${onClock}:00 ${hour < 12 ? 'am' : 'pm'}`;
}
