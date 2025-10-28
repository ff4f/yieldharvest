import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { logger } from '../utils/logger';

// File validation configuration
const FILE_VALIDATION_CONFIG = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ],
  allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.txt', '.doc', '.docx'],
  virusScanEnabled: process.env.VIRUS_SCAN_ENABLED === 'true',
  quarantineDirectory: process.env.QUARANTINE_DIR || '/tmp/quarantine'
};

// Malicious file signatures (simplified detection)
const MALICIOUS_SIGNATURES = [
  // PE executable signatures
  Buffer.from([0x4D, 0x5A]), // MZ header
  // ELF executable signatures
  Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF header
  // Script signatures
  Buffer.from('<?php', 'utf8'),
  Buffer.from('<script', 'utf8'),
  Buffer.from('javascript:', 'utf8'),
  // Archive bombs
  Buffer.from('PK\x03\x04', 'binary'), // ZIP with suspicious structure
];

// PDF-specific validation
const PDF_VALIDATION = {
  maxPages: 100,
  maxEmbeddedFiles: 5,
  allowedPdfVersion: ['1.4', '1.5', '1.6', '1.7', '2.0']
};

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fileHash: string;
  sanitizedFilename: string;
  detectedMimeType: string;
  fileSize: number;
}

export class FileValidationService {
  /**
   * Validate uploaded file for security and compliance
   */
  static async validateFile(fileBuffer: Buffer, originalFilename: string, declaredMimeType: string): Promise<FileValidationResult> {
    const result: FileValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      fileHash: '',
      sanitizedFilename: '',
      detectedMimeType: '',
      fileSize: fileBuffer.length
    };

    try {
      // Generate file hash for integrity
      result.fileHash = createHash('sha256').update(fileBuffer).digest('hex');
      
      // Sanitize filename
      result.sanitizedFilename = this.sanitizeFilename(originalFilename);
      
      // Validate file size
      if (!this.validateFileSize(fileBuffer.length)) {
        result.errors.push(`File size ${fileBuffer.length} exceeds maximum allowed size of ${FILE_VALIDATION_CONFIG.maxFileSize} bytes`);
        result.isValid = false;
      }
      
      // Detect actual MIME type
      result.detectedMimeType = this.detectMimeType(fileBuffer);
      
      // Validate MIME type
      if (!this.validateMimeType(result.detectedMimeType, declaredMimeType)) {
        result.errors.push(`Invalid or mismatched MIME type. Detected: ${result.detectedMimeType}, Declared: ${declaredMimeType}`);
        result.isValid = false;
      }
      
      // Check for malicious signatures
      const maliciousCheck = this.scanForMaliciousContent(fileBuffer);
      if (!maliciousCheck.isClean) {
        result.errors.push(`Potentially malicious content detected: ${maliciousCheck.threats.join(', ')}`);
        result.isValid = false;
      }
      
      // PDF-specific validation
      if (result.detectedMimeType === 'application/pdf') {
        const pdfValidation = this.validatePdfContent(fileBuffer);
        if (!pdfValidation.isValid) {
          result.errors.push(...pdfValidation.errors);
          result.warnings.push(...pdfValidation.warnings);
          result.isValid = false;
        }
      }
      
      // Log validation attempt
      logger.info({
        msg: 'File validation completed',
        filename: result.sanitizedFilename,
        fileHash: result.fileHash,
        fileSize: result.fileSize,
        mimeType: result.detectedMimeType,
        isValid: result.isValid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });
      
    } catch (error) {
      result.errors.push(`File validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      result.isValid = false;
      
      logger.error({
        msg: 'File validation error',
        filename: originalFilename,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return result;
  }
  
  /**
   * Sanitize filename to prevent path traversal and injection attacks
   */
  private static sanitizeFilename(filename: string): string {
    // Remove path separators and dangerous characters
    let sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Prevent double extensions
    sanitized = sanitized.replace(/\.(exe|bat|cmd|scr|pif|com)$/i, '.txt');
    
    // Ensure reasonable length
    if (sanitized.length > 255) {
      const ext = sanitized.substring(sanitized.lastIndexOf('.'));
      sanitized = sanitized.substring(0, 255 - ext.length) + ext;
    }
    
    // Add timestamp to prevent conflicts
    const timestamp = Date.now();
    const lastDot = sanitized.lastIndexOf('.');
    if (lastDot > 0) {
      sanitized = sanitized.substring(0, lastDot) + `_${timestamp}` + sanitized.substring(lastDot);
    } else {
      sanitized += `_${timestamp}`;
    }
    
    return sanitized;
  }
  
  /**
   * Validate file size against limits
   */
  private static validateFileSize(size: number): boolean {
    return size > 0 && size <= FILE_VALIDATION_CONFIG.maxFileSize;
  }
  
  /**
   * Detect MIME type from file content
   */
  private static detectMimeType(buffer: Buffer): string {
    // PDF
    if (buffer.subarray(0, 4).toString() === '%PDF') {
      return 'application/pdf';
    }
    
    // JPEG
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
      return 'image/jpeg';
    }
    
    // PNG
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) {
      return 'image/png';
    }
    
    // GIF
    if (buffer.subarray(0, 6).toString() === 'GIF87a' || buffer.subarray(0, 6).toString() === 'GIF89a') {
      return 'image/gif';
    }
    
    // Default to text/plain for unknown types
    return 'text/plain';
  }
  
  /**
   * Validate MIME type against allowed types
   */
  private static validateMimeType(detectedType: string, declaredType: string): boolean {
    // Check if detected type is allowed
    if (!FILE_VALIDATION_CONFIG.allowedMimeTypes.includes(detectedType)) {
      return false;
    }
    
    // Check if declared and detected types match (with some tolerance)
    if (detectedType !== declaredType) {
      // Allow some common mismatches
      const allowedMismatches = [
        { detected: 'text/plain', declared: 'application/octet-stream' },
        { detected: 'image/jpeg', declared: 'image/jpg' }
      ];
      
      const mismatchAllowed = allowedMismatches.some(m => 
        m.detected === detectedType && m.declared === declaredType
      );
      
      if (!mismatchAllowed) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Scan for malicious content signatures
   */
  private static scanForMaliciousContent(buffer: Buffer): { isClean: boolean; threats: string[] } {
    const threats: string[] = [];
    
    // Check for known malicious signatures
    for (const signature of MALICIOUS_SIGNATURES) {
      if (buffer.includes(signature)) {
        threats.push(`Malicious signature detected: ${signature.toString('hex')}`);
      }
    }
    
    // Check for suspicious patterns
    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
    
    // Script injection patterns
    const scriptPatterns = [
      /<script[^>]*>/i,
      /javascript:/i,
      /vbscript:/i,
      /on\w+\s*=/i,
      /<iframe[^>]*>/i
    ];
    
    for (const pattern of scriptPatterns) {
      if (pattern.test(content)) {
        threats.push(`Suspicious script pattern detected: ${pattern.source}`);
      }
    }
    
    // Check for embedded executables in PDFs
    if (buffer.includes(Buffer.from('/EmbeddedFile', 'utf8'))) {
      threats.push('PDF contains embedded files');
    }
    
    return {
      isClean: threats.length === 0,
      threats
    };
  }
  
  /**
   * Validate PDF-specific content
   */
  private static validatePdfContent(buffer: Buffer): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      const content = buffer.toString('utf8');
      
      // Check PDF version
      const versionMatch = content.match(/%PDF-(\d+\.\d+)/);
      if (versionMatch) {
        const version = versionMatch[1];
        if (!PDF_VALIDATION.allowedPdfVersion.includes(version)) {
          warnings.push(`PDF version ${version} may not be fully supported`);
        }
      }
      
      // Check for JavaScript in PDF
      if (content.includes('/JavaScript') || content.includes('/JS')) {
        errors.push('PDF contains JavaScript which is not allowed');
      }
      
      // Check for forms
      if (content.includes('/AcroForm')) {
        warnings.push('PDF contains interactive forms');
      }
      
      // Check for external references
      if (content.includes('/URI') || content.includes('http://') || content.includes('https://')) {
        warnings.push('PDF contains external references');
      }
      
      // Estimate page count (rough)
      const pageMatches = content.match(/\/Type\s*\/Page[^s]/g);
      if (pageMatches && pageMatches.length > PDF_VALIDATION.maxPages) {
        errors.push(`PDF has too many pages: ${pageMatches.length} (max: ${PDF_VALIDATION.maxPages})`);
      }
      
    } catch (error) {
      warnings.push('Could not fully validate PDF content');
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Fastify middleware for file upload validation
 */
export async function fileValidationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Check if request has file uploads
    if (!request.isMultipart()) {
      return;
    }
    
    const parts = request.parts();
    const validatedFiles: any[] = [];
    
    for await (const part of parts) {
      if (part.type === 'file') {
        // Read file buffer
        const buffer = await part.toBuffer();
        
        // Validate file
        const validation = await FileValidationService.validateFile(
          buffer,
          part.filename || 'unknown',
          part.mimetype
        );
        
        if (!validation.isValid) {
          logger.warn({
          msg: 'File validation failed',
          filename: part.filename,
          errors: validation.errors,
          fileHash: validation.fileHash
        });
          
          return reply.status(400).send({
            error: 'File validation failed',
            details: validation.errors,
            fileHash: validation.fileHash
          });
        }
        
        // Add validation metadata to file
        validatedFiles.push({
          ...part,
          buffer,
          validation
        });
        
        // Log successful validation
        logger.info({
          msg: 'File validation successful',
          filename: validation.sanitizedFilename,
          fileHash: validation.fileHash,
          fileSize: validation.fileSize,
          warnings: validation.warnings
        });
      }
    }
    
    // Attach validated files to request
    (request as any).validatedFiles = validatedFiles;
    
  } catch (error) {
    logger.error({
      msg: 'File validation middleware error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return reply.status(500).send({
      error: 'File validation failed',
      message: 'Internal server error during file validation'
    });
  }
}

export default FileValidationService;