// Text layout of an Upwork freelancer profile, learned from the live page (Oct 2026).
// The rate line anchors the title and overview. Section headings anchor skills and employment.

const RATE_LINE = /^\$\d+\.\d\d\/hr/;

const OVERVIEW_STOP = new Set([
  'more',
  'Skills',
  'Employment history',
  'Your project catalog',
  'Portfolio',
  'Work history',
  'Other experiences',
]);

export interface ProfileSnapshot {
  title: string;
  rate: string;
  overview: string;
  skills: string[];
  employment: string[];
}

function previousNonEmpty(lines: readonly string[], index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    const line = lines[i]?.trim() ?? '';
    if (line) return line;
  }
  return '';
}

function collectUntil(lines: readonly string[], start: number, stops: ReadonlySet<string>): string {
  const out: string[] = [];
  for (let i = start; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (stops.has(line.trim())) break;
    out.push(line);
  }
  return out.join('\n').trim();
}

function sectionLines(text: string, head: string, until: readonly string[]): string[] {
  const marker = `${head}\n`;
  const at = text.lastIndexOf(marker);
  if (at < 0) return [];
  const rest = text.slice(at + marker.length);
  let cut = rest.length;
  for (const end of until) {
    const atBreak = rest.indexOf(`\n${end}\n`);
    const atStart = rest.startsWith(`${end}\n`) ? 0 : -1;
    const boundary = atStart === 0 ? 0 : atBreak === -1 ? -1 : atBreak + 1;
    if (boundary >= 0 && boundary < cut) cut = boundary;
    if (rest === end || rest.endsWith(`\n${end}`)) {
      const tail = rest.length - end.length;
      if (tail >= 0 && tail < cut) cut = tail;
    }
  }
  return rest
    .slice(0, cut)
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

export function parseProfileText(text: string): ProfileSnapshot {
  const lines = text.split('\n');
  const rateIndex = lines.findIndex(line => RATE_LINE.test(line.trim()));
  const skills = sectionLines(text, 'Skills', [
    'Your project catalog',
    'Employment history',
    'Portfolio',
    'Work history',
  ]);
  const employment = sectionLines(text, 'Employment history', [
    'Other experiences',
    'Skills',
    'Portfolio',
    'Your project catalog',
  ]).filter(line => !/^(more|Show more|Show less|\(\d+\))$/.test(line));
  if (rateIndex < 0) return { title: '', rate: '', overview: '', skills, employment };
  return {
    title: previousNonEmpty(lines, rateIndex),
    rate: (lines[rateIndex] ?? '').trim(),
    overview: collectUntil(lines, rateIndex + 1, OVERVIEW_STOP),
    skills,
    employment,
  };
}

export function profileTextError(section: 'title' | 'overview', text: string): string | null {
  if (section === 'title' && text.length > 70) return 'Title is limited to 70 characters.';
  if (section === 'overview' && text.length > 5000) return 'Overview is limited to 5000 characters.';
  if (section === 'overview' && /(?:https?:\/\/|www\.)/i.test(text)) {
    return 'Upwork rejects links in the overview. Put links in Portfolio.';
  }
  return null;
}
