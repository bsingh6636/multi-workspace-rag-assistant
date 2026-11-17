import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  CHUNK_SIZE,
  chunkMarkdown,
  chunkPages,
  normalizeText,
  splitIntoWindows,
} from '../src/services/chunker';

describe('normalizeText', () => {
  test('unifies line endings, trims line ends, collapses blank lines, drops NUL and BOM', () => {
    const raw = '﻿# Title  \r\n\r\n\r\n\r\nBody\u0000 text\t\r\n';
    assert.equal(normalizeText(raw), '# Title\n\nBody text');
  });

  test('the same content with different line endings normalizes identically', () => {
    assert.equal(normalizeText('a\r\nb\r\n'), normalizeText('a\nb\n'));
  });
});

describe('chunkMarkdown', () => {
  test('one chunk per short section, labelled with its heading', () => {
    const chunks = chunkMarkdown('# Access codes\nThe Project Falcon code is 7731.\n\n# Leave\nTwenty days a year.');
    assert.deepEqual(chunks, [
      { content: '# Access codes\nThe Project Falcon code is 7731.', section: 'Access codes' },
      { content: '# Leave\nTwenty days a year.', section: 'Leave' },
    ]);
  });

  test('text before the first heading has a null section', () => {
    const chunks = chunkMarkdown('Intro line.\n\n## Details\nMore.');
    assert.equal(chunks[0].section, null);
    assert.equal(chunks[1].section, 'Details');
  });

  test('consecutive headings merge into one section named after the last one', () => {
    const chunks = chunkMarkdown('# Handbook\n\n## Setup\nInstall it.');
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].section, 'Setup');
    assert.match(chunks[0].content, /# Handbook/);
  });

  test('long sections split into chunks no longer than CHUNK_SIZE', () => {
    const sentences = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} says fact ${i * 7}.`);
    const chunks = chunkMarkdown(`# Long\n${sentences.join(' ')}`);
    assert.ok(chunks.length > 1);
    for (const chunk of chunks) {
      assert.ok(chunk.content.length <= CHUNK_SIZE, `chunk of ${chunk.content.length} chars`);
      assert.equal(chunk.section, 'Long');
    }
  });

  test('every sentence appears whole in at least one chunk (overlap works)', () => {
    const sentences = Array.from({ length: 80 }, (_, i) => `Fact ${i} is that the value equals ${i * 13}.`);
    const chunks = chunkMarkdown(sentences.join(' '));
    for (const sentence of sentences) {
      assert.ok(
        chunks.some((c) => c.content.includes(sentence)),
        `"${sentence}" was split across chunks`,
      );
    }
  });
});

describe('splitIntoWindows', () => {
  test('prefers paragraph breaks', () => {
    const para = 'word '.repeat(100).trim(); // 499 chars
    const pieces = splitIntoWindows(`${para}\n\n${para}`);
    assert.equal(pieces[0], para);
  });

  test('a single very long word still gets cut', () => {
    const pieces = splitIntoWindows('x'.repeat(2000));
    assert.ok(pieces.length >= 3);
    assert.ok(pieces.every((p) => p.length <= CHUNK_SIZE));
  });
});

describe('chunkPages', () => {
  test('labels PDF chunks with their page number', () => {
    const chunks = chunkPages([
      { num: 1, text: 'Falcon code 7731.' },
      { num: 2, text: '   ' },
      { num: 3, text: 'Refunds take 5 days.' },
    ]);
    assert.deepEqual(
      chunks.map((c) => c.section),
      ['page 1', 'page 3'],
    );
  });
});
