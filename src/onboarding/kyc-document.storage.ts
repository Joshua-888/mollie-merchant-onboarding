import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface SavedKycDocument {
  field: 'front' | 'back';
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
}

@Injectable()
export class KycDocumentStorage {
  private readonly logger = new Logger(KycDocumentStorage.name);
  private readonly baseDir = join(process.cwd(), 'uploads', 'kyc');

  save(
    merchantId: string,
    field: 'front' | 'back',
    file: Express.Multer.File,
  ): SavedKycDocument {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Kun JPEG, PNG og PDF filer er tilladt');
    }

    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('Filen må max være 5 MB');
    }

    const merchantDir = join(this.baseDir, merchantId);
    mkdirSync(merchantDir, { recursive: true });

    const extension = extname(file.originalname) || this.extensionForMime(file.mimetype);
    const storedName = `${field}-${uuidv4()}${extension}`;
    const targetPath = join(merchantDir, storedName);

    writeFileSync(targetPath, file.buffer);

    this.logger.log({
      action: 'saveKycDocument',
      merchantId,
      field,
      storedName,
      sizeBytes: file.size,
    });

    return {
      field,
      originalName: file.originalname,
      storedName,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  private extensionForMime(mimeType: string): string {
    switch (mimeType) {
      case 'image/jpeg':
        return '.jpg';
      case 'image/png':
        return '.png';
      case 'application/pdf':
        return '.pdf';
      default:
        return '.bin';
    }
  }
}
