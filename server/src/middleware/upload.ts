import path from 'node:path';
import multer from 'multer';
import { HttpError } from '../lib/httpError';

export const ALLOWED_EXTENSIONS = ['.txt', '.md', '.pdf'];
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

// One file in the form field "file", kept in memory (files are small and are
// parsed straight away; nothing is written to disk). Wrong extensions are
// rejected before the file is read.
export const uploadSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter(_req, file, accept) {
    // Browsers send the filename as UTF-8, but multer decodes it as latin1,
    // which garbles names like "résumé.pdf". Re-decode it.
    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');

    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return accept(new HttpError(400, 'Only .txt, .md and .pdf files are supported'));
    }
    accept(null, true);
  },
}).single('file');
