// Turns document text into chunks for embedding. Pure functions, no I/O, so
// they're easy to unit-test (see test/chunker.test.ts).
//
// Strategy: split by markdown headings into sections, then cut each section
// into windows of at most CHUNK_SIZE characters. Each window ends at the best
// natural break (paragraph > line > sentence > word), and the next window starts
// about CHUNK_OVERLAP characters earlier, so a fact that crosses a cut still
// appears whole in at least one chunk.

export const CHUNK_SIZE = 800;
export const CHUNK_OVERLAP = 150;

export type Chunk = {
  content: string;
  /** Nearest heading for markdown/text, "page N" for PDFs, or null. */
  section: string | null;
};

const HEADING = /^#{1,6}\s+(.+)$/;

// Same text → same hash, whatever the line endings or trailing spaces.
// Also removes NUL bytes, which Postgres text columns can't store.
export function normalizeText(text: string): string {
  return text
    .replace(/^﻿/, '') // byte-order mark
    .replace(/\r\n?/g, '\n')
    .replace(/\u0000/g, '')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Markdown and plain text. Each heading starts a new section; the heading line
// stays in the chunk text so its words are embedded too.
export function chunkMarkdown(text: string): Chunk[] {
  const sections: { title: string | null; lines: string[] }[] = [{ title: null, lines: [] }];

  for (const line of text.split('\n')) {
    const heading = line.match(HEADING);
    const current = sections[sections.length - 1];

    if (!heading) {
      current.lines.push(line);
      continue;
    }

    const title = heading[1].trim().slice(0, 200);
    // Headings with nothing between them ("# Guide" then "## Setup") form one
    // section, named after the last (most specific) heading.
    if (current.lines.every((l) => l.trim() === '' || HEADING.test(l))) {
      current.title = title;
      current.lines.push(line);
    } else {
      sections.push({ title, lines: [line] });
    }
  }

  return sections.flatMap((s) => toChunks(s.lines.join('\n'), s.title));
}

// PDFs: no reliable headings, so each page is a section named "page N".
export function chunkPages(pages: { num: number; text: string }[]): Chunk[] {
  return pages.flatMap((page) => toChunks(normalizeText(page.text), `page ${page.num}`));
}

function toChunks(text: string, section: string | null): Chunk[] {
  const body = text.trim();
  if (!body) return [];
  return splitIntoWindows(body).map((content) => ({ content, section }));
}

// Cuts text into pieces of at most CHUNK_SIZE characters with ~CHUNK_OVERLAP
// characters repeated between neighbours.
export function splitIntoWindows(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const pieces: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + CHUNK_SIZE, text.length);
    if (end < text.length) end = findBreak(text, start, end);

    pieces.push(text.slice(start, end).trim());
    if (end >= text.length) break;

    // Step back ~CHUNK_OVERLAP characters, then forward to the next word start
    // so the overlap doesn't begin mid-word.
    let next = end - CHUNK_OVERLAP;
    const space = text.slice(next, end).search(/\s/);
    if (space !== -1) next += space + 1;
    start = next;
  }

  return pieces.filter(Boolean);
}

// The best place to end a window that runs from start to end: the last
// paragraph break, else line break, else sentence end, else space. Only breaks
// in the second half of the window count, so chunks don't come out tiny.
function findBreak(text: string, start: number, end: number): number {
  const earliest = start + CHUNK_SIZE / 2;
  for (const separator of ['\n\n', '\n', '. ', ' ']) {
    const at = text.lastIndexOf(separator, end - separator.length);
    if (at >= earliest) return at + separator.length;
  }
  return end; // one very long word: hard cut
}
