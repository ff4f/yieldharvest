import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import { auditLogger } from '../utils/logger';
import crypto from 'crypto';
import path from 'path';

// Allowed MIME types for invoice documents
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
  pdf: 10 * 1024 * 1024,      // 10MB for PDFs
  image: 5 * 1024 * 1024,     // 5MB for images
  document: 8 * 1024 * 1024,  // 8MB for documents
  default: 10 * 1024 * 1024,  // 10MB default
} as const;

// Dangerous file extensions to block
const BLOCKED_EXTENSIONS = [
  '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
  '.app', '.deb', '.pkg', '.dmg', '.rpm', '.msi', '.run', '.bin',
  '.sh', '.bash', '.zsh', '.fish', '.ps1', '.psm1', '.psd1',
  '.php', '.asp', '.aspx', '.jsp', '.py', '.rb', '.pl', '.cgi',
] as const;

// Magic number signatures for file type validation
const FILE_SIGNATURES = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46], // %PDF
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
  'image/webp': [0x52, 0x49, 0x46, 0x46], // RIFF (first 4 bytes)
  'text/plain': [], // Text files don't have reliable magic numbers
  'application/msword': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4B, 0x03, 0x04], // ZIP signature
  'application/vnd.ms-excel': [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [0x50, 0x4B, 0x03, 0x04], // ZIP signature
} as const;

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
  code?: string;
  details?: any;
}

export interface ValidatedFile extends MultipartFile {
  validationHash: string;
  sanitizedFilename: string;
  detectedMimeType: string;
}

/**
 * Validates file MIME type against magic number signature
 */
async function validateFileSignature(file: MultipartFile): Promise<boolean> {
  try {
    const buffer = await file.toBuffer();
    const signature = FILE_SIGNATURES[file.mimetype as keyof typeof FILE_SIGNATURES];
    
    if (!signature || signature.length === 0) {
      return true; // Skip validation for files without reliable signatures
    }
    
    // Check if buffer starts with expected signature
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        return false;
      }
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Sanitizes filename to prevent path traversal and other attacks
 */
function sanitizeFilename(filename: string): string {
  // Remove path separators and dangerous characters
  let sanitized = filename.replace(/[\/\\:*?"<>|]/g, '_');
  
  // Remove leading dots and spaces
  sanitized = sanitized.replace(/^[.\s]+/, '');
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized);
    const name = path.basename(sanitized, ext);
    sanitized = name.substring(0, 255 - ext.length) + ext;
  }
  
  // Ensure it's not empty
  if (!sanitized || sanitized.trim() === '') {
    sanitized = `file_${Date.now()}`;
  }
  
  return sanitized;
}

/**
 * Gets appropriate file size limit based on MIME type
 */
function getFileSizeLimit(mimeType: string): number {
  if (mimeType.startsWith('image/')) {
    return FILE_SIZE_LIMITS.image;
  }
  
  if (mimeType === 'application/pdf') {
    return FILE_SIZE_LIMITS.pdf;
  }
  
  if (mimeType.includes('document') || mimeType.includes('sheet') || mimeType.includes('word') || mimeType.includes('excel')) {
    return FILE_SIZE_LIMITS.document;
  }
  
  return FILE_SIZE_LIMITS.default;
}

/**
 * Comprehensive file validation for HFS uploads
 */
export async function validateUploadedFile(file: MultipartFile, request: FastifyRequest): Promise<FileValidationResult> {
  try {
    // Check if file exists
    if (!file) {
      return {
        isValid: false,
        error: 'No file provided',
        code: 'FILE_MISSING',
      };
    }

    // Validate filename
    if (!file.filename || file.filename.trim() === '') {
      return {
        isValid: false,
        error: 'Filename is required',
        code: 'FILENAME_MISSING',
      };
    }

    // Check for blocked extensions
    const fileExtension = path.extname(file.filename).toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(fileExtension as any)) {
      auditLogger.logSecurity({
        eventType: 'blocked_file_extension',
        severity: 'high',
        details: {
          filename: file.filename,
          extension: fileExtension,
          mimeType: file.mimetype,
        },
        ip: request.ip,
      });

      return {
        isValid: false,
        error: 'File type not allowed',
        code: 'BLOCKED_FILE_TYPE',
        details: { extension: fileExtension },
      };
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as any)) {
      auditLogger.logSecurity({
        eventType: 'invalid_mime_type',
        severity: 'medium',
        details: {
          filename: file.filename,
          mimeType: file.mimetype,
          allowedTypes: ALLOWED_MIME_TYPES,
        },
        ip: request.ip,
      });

      return {
        isValid: false,
        error: 'File type not supported',
        code: 'INVALID_MIME_TYPE',
        details: { 
          provided: file.mimetype,
          allowed: ALLOWED_MIME_TYPES,
        },
      };
    }

    // Validate file size
    const sizeLimit = getFileSizeLimit(file.mimetype);
    const buffer = await file.toBuffer();
    
    if (buffer.length > sizeLimit) {
      auditLogger.logSecurity({
        eventType: 'file_size_exceeded',
        severity: 'medium',
        details: {
          filename: file.filename,
          size: buffer.length,
          limit: sizeLimit,
          mimeType: file.mimetype,
        },
        ip: request.ip,
      });

      return {
        isValid: false,
        error: 'File size exceeds limit',
        code: 'FILE_TOO_LARGE',
        details: {
          size: buffer.length,
          limit: sizeLimit,
          limitMB: Math.round(sizeLimit / (1024 * 1024)),
        },
      };
    }

    // Validate file signature (magic numbers)
    const isValidSignature = await validateFileSignature(file);
    if (!isValidSignature) {
      auditLogger.logSecurity({
        eventType: 'file_signature_mismatch',
        severity: 'high',
        details: {
          filename: file.filename,
          declaredMimeType: file.mimetype,
        },
        ip: request.ip,
      });

      return {
        isValid: false,
        error: 'File content does not match declared type',
        code: 'SIGNATURE_MISMATCH',
      };
    }

    // Check for empty files
    if (buffer.length === 0) {
      return {
        isValid: false,
        error: 'File is empty',
        code: 'EMPTY_FILE',
      };
    }

    // Generate validation hash
    const validationHash = crypto
      .createHash('sha256')
      .update(buffer)
      .update(file.filename)
      .update(Date.now().toString())
      .digest('hex');

    // Log successful validation
    auditLogger.logSecurity({
      eventType: 'file_validation_success',
      severity: 'low',
      details: {
        filename: file.filename,
        size: buffer.length,
        mimeType: file.mimetype,
        hash: validationHash.substring(0, 16), // First 16 chars for logging
      },
      ip: request.ip,
    });

    return {
      isValid: true,
      details: {
        validationHash,
        sanitizedFilename: sanitizeFilename(file.filename),
        size: buffer.length,
        mimeType: file.mimetype,
      },
    };

  } catch (error) {
    auditLogger.logSecurity({
      eventType: 'file_validation_error',
      severity: 'high',
      details: {
        filename: file?.filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      ip: request.ip,
    });

    return {
      isValid: false,
      error: 'File validation failed',
      code: 'VALIDATION_ERROR',
    };
  }
}

/**
 * Middleware for validating file uploads
 */
export const fileUploadValidator = async (request: FastifyRequest, reply: FastifyReply) => {
  // Only validate multipart requests
  if (!request.isMultipart()) {
    return;
  }

  try {
    const parts = request.parts();
    const validatedFiles: ValidatedFile[] = [];
    let fileCount = 0;

    for await (const part of parts) {
      if (part.type === 'file') {
        fileCount++;
        
        // Limit number of files
        if (fileCount > 5) {
          auditLogger.logSecurity({
            eventType: 'too_many_files',
            severity: 'medium',
            details: {
              fileCount,
              limit: 5,
            },
            ip: request.ip,
          });

          return reply.status(400).send({
            error: 'Too many files',
            code: 'TOO_MANY_FILES',
            message: 'Maximum 5 files allowed per request',
            limit: 5,
          });
        }

        const validation = await validateUploadedFile(part, request);
        
        if (!validation.isValid) {
          return reply.status(400).send({
            error: validation.error,
            code: validation.code,
            details: validation.details,
          });
        }

        // Add validation metadata to file
        const validatedFile = part as ValidatedFile;
        validatedFile.validationHash = validation.details!.validationHash;
        validatedFile.sanitizedFilename = validation.details!.sanitizedFilename;
        validatedFile.detectedMimeType = validation.details!.mimeType;
        
        validatedFiles.push(validatedFile);
      }
    }

    // Attach validated files to request
    (request as any).validatedFiles = validatedFiles;

  } catch (error) {
    auditLogger.logSecurity({
      eventType: 'file_upload_middleware_error',
      severity: 'high',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      ip: request.ip,
    });

    return reply.status(500).send({
      error: 'File upload validation failed',
      code: 'UPLOAD_VALIDATION_ERROR',
    });
  }
};

/**
 * Virus scanning placeholder (integrate with ClamAV or similar)
 */
export async function scanFileForViruses(buffer: Buffer, filename: string): Promise<boolean> {
  // TODO: Integrate with actual virus scanning service
  // For now, perform basic heuristic checks
  
  // Check for suspicious patterns in filename
  const suspiciousPatterns = [
    /\.exe\./, /\.scr\./, /\.bat\./, /\.cmd\./,
    /autorun/i, /setup/i, /install/i,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(filename)) {
      return false;
    }
  }
  
  // Check for embedded executables in documents (basic check)
  const executableSignatures = [
    [0x4D, 0x5A], // MZ (DOS/Windows executable)
    [0x7F, 0x45, 0x4C, 0x46], // ELF (Linux executable)
  ];
  
  for (const signature of executableSignatures) {
    for (let i = 0; i <= buffer.length - signature.length; i++) {
      let match = true;
      for (let j = 0; j < signature.length; j++) {
        if (buffer[i + j] !== signature[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        return false;
      }
    }
  }
  
  return true; // Clean
}

export {
  ALLOWED_MIME_TYPES,
  FILE_SIZE_LIMITS,
  BLOCKED_EXTENSIONS,
};