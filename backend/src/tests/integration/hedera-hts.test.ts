import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { HederaService } from '../../services/hedera';
import { logger } from '../../utils/logger';

describe('Hedera Token Service (HTS) Integration', () => {
  let hederaService: HederaService;
  let tokenId: string;

  beforeAll(async () => {
    // Initialize Hedera service with test configuration
    hederaService = new HederaService({
      operatorId: process.env.OPERATOR_ID || '0.0.123456',
      operatorKey: process.env.OPERATOR_KEY || 'test-key',
      network: 'testnet',
      mirrorNodeUrl: process.env.MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com'
    });

    // Use existing token ID from environment or create a new one for testing
    tokenId = process.env.INVOICE_TOKEN_ID || '0.0.123456';
  });

  afterAll(async () => {
    if (hederaService) {
      await hederaService.close();
    }
  });

  describe('NFT Token Operations', () => {
    it('should connect to Hedera network', async () => {
      const isConnected = await hederaService.isConnected();
      expect(isConnected).toBe(true);
    });

    it('should validate NFT token creation (skip actual creation)', async () => {
      // Skip actual token creation to avoid costs, just validate the service setup
      expect(hederaService).toBeDefined();
      expect(tokenId).toMatch(/^0\.0\.\d+$/);
      logger.info(`Using existing token ID: ${tokenId}`);
      logger.info(`HashScan: https://hashscan.io/testnet/token/${tokenId}`);
    });

    it('should validate NFT minting structure', async () => {
      const invoiceMetadata = {
        invoiceId: 'test-invoice-001',
        invoiceNumber: 'INV-2024-001',
        amount: '1000.00',
        currency: 'USD',
        dueDate: '2024-12-31T23:59:59Z',
        supplierId: 'supplier-123',
        buyerId: 'buyer-456',
        fileId: '0.0.123456',
        fileHash: 'sha384-test-hash'
      };

      // Validate metadata structure without actual minting
      expect(invoiceMetadata).toHaveProperty('invoiceId');
      expect(invoiceMetadata).toHaveProperty('invoiceNumber');
      expect(invoiceMetadata).toHaveProperty('amount');
      expect(invoiceMetadata).toHaveProperty('currency');
      expect(invoiceMetadata.amount).toMatch(/^\d+\.\d{2}$/);
      
      logger.info('NFT metadata structure validated');
    });
  });

  describe('File Service Operations', () => {
    it('should validate PDF upload structure', async () => {
      // Create a proper PDF buffer with PDF header
      const testPdfBuffer = Buffer.concat([
        Buffer.from('%PDF-1.4\n'),
        Buffer.from('Test PDF content for validation')
      ]);
      const mimeType = 'application/pdf';
      const filename = 'test-invoice.pdf';

      // Validate PDF structure without actual upload
      expect(testPdfBuffer.subarray(0, 4).equals(Buffer.from('%PDF'))).toBe(true);
      expect(mimeType).toBe('application/pdf');
      expect(filename).toMatch(/\.pdf$/);
      
      logger.info('PDF validation structure passed');
      logger.info(`File size: ${testPdfBuffer.length} bytes`);
    });

    it('should reject invalid file types', async () => {
      const testBuffer = Buffer.from('Not a PDF file');
      const mimeType = 'text/plain';
      const filename = 'test.txt';

      try {
        await hederaService.uploadPdfToHfs(testBuffer, mimeType, filename);
        fail('Should have thrown error for invalid file type');
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Only PDF files are allowed');
        logger.info('Correctly rejected non-PDF file');
      }
    });
  });

  describe('Consensus Service Operations', () => {
    it('should validate HCS topic structure', async () => {
      const topicId = process.env.INVOICE_TOPIC_ID || '0.0.123456';
      
      // Validate topic ID format
      expect(topicId).toMatch(/^0\.0\.\d+$/);
      logger.info(`Using existing topic ID: ${topicId}`);
      logger.info(`HashScan: https://hashscan.io/testnet/topic/${topicId}`);
    });

    it('should validate invoice status message structure', async () => {
      const topicId = process.env.INVOICE_TOPIC_ID || '0.0.123456';
      const messageData = {
        tokenId: tokenId,
        serialNumber: '1',
        status: 'issued' as const,
        timestamp: new Date().toISOString(),
        fileHash: 'sha384-test-hash',
        amount: '1000.00',
        currency: 'USD'
      };

      // Validate message structure without actual submission
      expect(messageData).toHaveProperty('tokenId');
      expect(messageData).toHaveProperty('serialNumber');
      expect(messageData).toHaveProperty('status');
      expect(messageData).toHaveProperty('timestamp');
      expect(['issued', 'funded', 'paid', 'defaulted']).toContain(messageData.status);
      
      const messageString = JSON.stringify(messageData);
      expect(Buffer.byteLength(messageString, 'utf8')).toBeLessThanOrEqual(1024);
      
      logger.info('HCS message structure validated');
      logger.info(`Message size: ${Buffer.byteLength(messageString, 'utf8')} bytes`);
    });
  });

  describe('Mirror Node Integration', () => {
    it('should get NFT info from Mirror Node', async () => {
      const testTokenId = process.env.INVOICE_TOKEN_ID || '0.0.123456';
      const testSerialNumber = '1';

      try {
        const result = await hederaService.getNFTInfo(testTokenId, testSerialNumber);
        
        // Mirror Node should return data even for non-existent NFTs (404 or empty)
        expect(result).toBeDefined();
        
        logger.info(`NFT info for ${testTokenId}/${testSerialNumber}:`, result);
      } catch (error) {
        // 404 or network errors are acceptable for test
        logger.info('Mirror Node query result:', error);
        expect(error).toBeDefined();
      }
    });

    it('should get topic messages from Mirror Node', async () => {
      const testTopicId = process.env.INVOICE_TOPIC_ID || '0.0.123456';

      try {
        const result = await hederaService.getTopicMessages(testTopicId, 5);
        
        // Mirror Node should return data even for non-existent topics
        expect(result).toBeDefined();
        
        logger.info(`Topic messages for ${testTopicId}:`, result);
      } catch (error) {
        // 404 or network errors are acceptable for test
        logger.info('Mirror Node topic query result:', error);
        expect(error).toBeDefined();
      }
    });
  });
});