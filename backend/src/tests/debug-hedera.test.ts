import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { HederaService, HederaConfig } from '../services/hedera';

describe('Debug Hedera Service', () => {
  let hederaService: HederaService;
  let config: HederaConfig;

  beforeAll(async () => {
    console.log('Environment variables:');
    console.log('HEDERA_NETWORK:', process.env['HEDERA_NETWORK']);
    console.log('OPERATOR_ID:', process.env['OPERATOR_ID']);
    console.log('OPERATOR_KEY exists:', !!process.env['OPERATOR_KEY']);
    console.log('MIRROR_NODE_URL:', process.env['MIRROR_NODE_URL']);
    console.log('INVOICE_TOKEN_ID:', process.env['INVOICE_TOKEN_ID']);
    console.log('INVOICE_TOPIC_ID:', process.env['INVOICE_TOPIC_ID']);

    config = {
      operatorId: process.env['OPERATOR_ID'] || '',
      operatorKey: process.env['OPERATOR_KEY'] || '',
      network: process.env['HEDERA_NETWORK'] || 'testnet',
      mirrorNodeUrl: process.env['MIRROR_NODE_URL'] || 'https://testnet.mirrornode.hedera.com',
    };
  });

  it('should initialize HederaService without errors', async () => {
    console.log('Config being used:', {
      operatorId: config.operatorId,
      operatorKeyExists: !!config.operatorKey,
      operatorKeyLength: config.operatorKey?.length,
      network: config.network,
      mirrorNodeUrl: config.mirrorNodeUrl,
    });
    
    try {
      hederaService = new HederaService(config);
      expect(hederaService).toBeDefined();
      console.log('HederaService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize HederaService:', error);
      throw error;
    }
  });

  it('should be able to call uploadPdfToHfs method', async () => {
    if (!hederaService) {
      hederaService = new HederaService(config);
    }

    // Create a minimal valid PDF buffer
    const testBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n179\n%%EOF');
    const testMimetype = 'application/pdf';
    const testFilename = 'test.pdf';

    try {
      const result = await hederaService.uploadPdfToHfs(testBuffer, testMimetype, testFilename);
      console.log('uploadPdfToHfs result:', result);
      expect(result).toHaveProperty('fileId');
      expect(result).toHaveProperty('fileHashSha384');
      expect(result).toHaveProperty('transactionId');
    } catch (error) {
      console.error('uploadPdfToHfs failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    // Cleanup if needed
  });
});