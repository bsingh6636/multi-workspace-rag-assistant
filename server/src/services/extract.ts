import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { HttpError } from '../lib/httpError';

export type ExtractedText =
  | { kind: 'pdf'; pages: { num: number; text: string }[] }
  | { kind: 'text'; text: string };

// Gets the raw text out of an uploaded file. PDFs keep their pages so chunks can
// cite "page N". Only text-based PDFs work: scanned ones have no text (no OCR).
export async function extractText(file: { originalname: string; buffer: Buffer }): Promise<ExtractedText> {
  if (path.extname(file.originalname).toLowerCase() !== '.pdf') {
    return { kind: 'text', text: file.buffer.toString('utf8') };
  }

  const parser = new PDFParse({ data: file.buffer });
  try {
    const result = await parser.getText();
    return { kind: 'pdf', pages: result.pages.map((p) => ({ num: p.num, text: p.text })) };
  } catch {
    throw new HttpError(400, "Couldn't read this PDF. It may be damaged or password-protected.");
  } finally {
    await parser.destroy();
  }
}
