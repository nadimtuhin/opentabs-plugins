export const COVER_MIN = 380;
export const COVER_MAX = 2000;

export function coverLetterError(text: string): string | null {
  if (text.length < COVER_MIN || text.length > COVER_MAX) {
    return `Letter must be ${COVER_MIN}-${COVER_MAX} chars, got ${text.length}.`;
  }
  return null;
}

export type ApplyStep = 'cover_letter' | 'rate' | 'other';

export function applyStep(hasPitch: boolean, hasRate: boolean): ApplyStep {
  if (hasPitch) return 'cover_letter';
  if (hasRate) return 'rate';
  return 'other';
}

export function profileSection(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  return parts.at(-1) ?? '';
}

// "Saved" is a status, not the button. "Save and Add Another" must not submit a second blank form.
export function isSaveButtonLabel(text: string): boolean {
  const label = text.trim();
  return /^Save\b/.test(label) && !/\bAnother\b/.test(label);
}

export function validationLines(text: string): string[] {
  return (text.match(/[^\n]*(you need to|is required|must be|Please (select|enter|fill))[^\n]*/gi) ?? []).slice(0, 5);
}

// The field name is what the form posts. The id is only a fallback when the control has no name.
export function fieldKey(name: string, id: string): string {
  return name || id;
}

// Type-ahead options often put a description on the following line. The label is the first line.
export function optionLabel(text: string): string {
  return (text.split('\n')[0] ?? '').trim().replace(/[ \t]+/g, ' ');
}
