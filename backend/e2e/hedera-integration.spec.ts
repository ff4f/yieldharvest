import { test, expect } from '@playwright/test';
import { Client, PrivateKey, AccountId } from '@hashgraph/sdk';

test.describe('Hedera Blockchain Integration Tests', () => {
  const baseURL = 'http://localhost:3001';
  let client: Client;
  
  test.beforeAll(async () => {
    // Initialize Hedera client for testnet
    if (process.env.HEDERA_ACCOUNT_ID && process.env.HEDERA_PRIVATE_KEY) {
      client = Client.forTestnet().setOperator(
        AccountId.fromString(process.env.HEDERA_ACCOUNT_ID),
        PrivateKey.fromString(process.env.HEDERA_PRIVATE_KEY)
      );
    }
  });

  test.afterAll(async () => {
    if (client) {
      client.close();
    }
  });

  test('should create NFT on Hedera Token Service', async ({ request }) => {
    const invoiceData = {
      supplierName: 'Hedera Test Supplier',
      supplierEmail: 'hedera-supplier@test.com',
      amount: 2500,
      description: 'Hedera NFT Test Invoice',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    const response = await request.post(`${baseURL}/api/invoices`, {
      data: invoiceData
    });

    expect(response.status()).toBe(201);
    
    const invoice = await response.json();
    
    // Validate NFT creation
    expect(invoice).toHaveProperty('nftTokenId');
    expect(invoice).toHaveProperty('nftSerialNumber');
    expect(invoice.nftTokenId).toMatch(/^0\.0\.[0-9]+$/);
    expect(parseInt(invoice.nftSerialNumber)).toBeGreaterThan(0);
    
    // Wait for Mirror Node sync
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify NFT exists on Mirror Node
    const mirrorResponse = await request.get(`${baseURL}/api/mirror/nft/${invoice.nftTokenId}/${invoice.nftSerialNumber}`);
    
    if (mirrorResponse.status() === 200) {
      const nftData = await mirrorResponse.json();
      expect(nftData.token_id).toBe(invoice.nftTokenId);
      expect(nftData.serial_number.toString()).toBe(invoice.nftSerialNumber);
      
      // Validate metadata
      if (nftData.metadata) {
        const metadata = JSON.parse(Buffer.from(nftData.metadata, 'base64').toString());
        expect(metadata.amount).toBe(invoice.amount);
        expect(metadata.supplierName).toBe(invoice.supplierName);
      }
    }
  });

  test('should upload file to Hedera File Service', async ({ request }) => {
    const invoiceData = {
      supplierName: 'HFS Test Supplier',
      supplierEmail: 'hfs-supplier@test.com',
      amount: 3000,
      description: 'HFS Test Invoice'
    };

    const response = await request.post(`${baseURL}/api/invoices`, {
      data: invoiceData
    });

    const invoice = await response.json();
    
    // Validate HFS file creation
    expect(invoice).toHaveProperty('hfsFileId');
    expect(invoice).toHaveProperty('documentHash');
    expect(invoice.hfsFileId).toMatch(/^0\.0\.[0-9]+$/);
    expect(invoice.documentHash).toHaveLength(64); // SHA-256 hash
    
    // Wait for Mirror Node sync
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify file exists on Mirror Node
    const fileResponse = await request.get(`${baseURL}/api/mirror/file/${invoice.hfsFileId}`);
    
    if (fileResponse.status() === 200) {
      const fileData = await fileResponse.json();
      expect(fileData.file_id).toBe(invoice.hfsFileId);
      expect(fileData).toHaveProperty('size');
      expect(fileData.size).toBeGreaterThan(0);
    }
  });

  test('should record events to Hedera Consensus Service', async ({ request }) => {
    // Create invoice
    const invoiceResponse = await request.post(`${baseURL}/api/invoices`, {
      data: {
        supplierName: 'HCS Test Supplier',
        supplierEmail: 'hcs-supplier@test.com',
        amount: 4000,
        description: 'HCS Test Invoice'
      }
    });
    
    const invoice = await invoiceResponse.json();
    
    // Fund the invoice
    const fundResponse = await request.post(`${baseURL}/api/invoices/${invoice.id}/fund`, {
      data: {
        investorName: 'HCS Test Investor',
        investorEmail: 'hcs-investor@test.com',
        amount: 3200,
        walletAddress: '0.0.987654'
      }
    });
    
    const fundData = await fundResponse.json();
    
    // Validate HCS message creation
    expect(fundData).toHaveProperty('hcsMessageId');
    expect(fundData.hcsMessageId).toMatch(/^[0-9]+-[0-9]+-[0-9]+$/);
    
    // Wait for Mirror Node sync
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Verify HCS message exists
    if (invoice.hcsTopicId) {
      const hcsResponse = await request.get(`${baseURL}/api/mirror/hcs/${invoice.hcsTopicId}`);
      
      if (hcsResponse.status() === 200) {
        const messages = await hcsResponse.json();
        expect(messages.length).toBeGreaterThan(0);
        
        const fundingMessage = messages.find((msg: any) => {
          try {
            const decoded = JSON.parse(Buffer.from(msg.message, 'base64').toString());
            return decoded.type === 'FUNDING' && decoded.invoiceId === invoice.id;
          } catch {
            return false;
          }
        });
        
        expect(fundingMessage).toBeDefined();
      }
    }
  });

  test('should validate complete Hedera transaction flow', async ({ request }) => {
    // Create invoice (HTS + HFS + HCS)
    const invoiceResponse = await request.post(`${baseURL}/api/invoices`, {
      data: {
        supplierName: 'Complete Flow Supplier',
        supplierEmail: 'complete@test.com',
        amount: 5000,
        description: 'Complete Hedera Flow Test'
      }
    });
    
    const invoice = await invoiceResponse.json();
    
    // Fund invoice (HCS)
    const fundResponse = await request.post(`${baseURL}/api/invoices/${invoice.id}/fund`, {
      data: {
        investorName: 'Complete Flow Investor',
        investorEmail: 'investor@test.com',
        amount: 4000,
        walletAddress: '0.0.111222'
      }
    });
    
    const fundData = await fundResponse.json();
    
    // Pay invoice (HCS)
    const payResponse = await request.post(`${baseURL}/api/invoices/${invoice.id}/pay`, {
      data: {
        walletAddress: '0.0.333444',
        transactionMemo: 'Complete flow payment'
      }
    });
    
    const payData = await payResponse.json();
    
    // Wait for all Mirror Node syncs
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Validate all Hedera services were used
    expect(invoice.nftTokenId).toBeDefined();
    expect(invoice.nftSerialNumber).toBeDefined();
    expect(invoice.hfsFileId).toBeDefined();
    expect(invoice.hcsTopicId).toBeDefined();
    expect(fundData.hcsMessageId).toBeDefined();
    expect(payData.hcsMessageId).toBeDefined();
    
    // Validate NFT on Mirror Node
    const nftResponse = await request.get(`${baseURL}/api/mirror/nft/${invoice.nftTokenId}/${invoice.nftSerialNumber}`);
    if (nftResponse.status() === 200) {
      const nftData = await nftResponse.json();
      expect(nftData.token_id).toBe(invoice.nftTokenId);
    }
    
    // Validate HFS file on Mirror Node
    const fileResponse = await request.get(`${baseURL}/api/mirror/file/${invoice.hfsFileId}`);
    if (fileResponse.status() === 200) {
      const fileData = await fileResponse.json();
      expect(fileData.file_id).toBe(invoice.hfsFileId);
    }
    
    // Validate HCS messages on Mirror Node
    const hcsResponse = await request.get(`${baseURL}/api/mirror/hcs/${invoice.hcsTopicId}`);
    if (hcsResponse.status() === 200) {
      const messages = await hcsResponse.json();
      expect(messages.length).toBeGreaterThanOrEqual(3); // Created, Funded, Paid
      
      // Validate message types
      const messageTypes = messages.map((msg: any) => {
        try {
          const decoded = JSON.parse(Buffer.from(msg.message, 'base64').toString());
          return decoded.type;
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      expect(messageTypes).toContain('CREATED');
      expect(messageTypes).toContain('FUNDING');
      expect(messageTypes).toContain('PAYMENT');
    }
  });

  test('should validate HashScan links generation', async ({ request }) => {
    const invoiceResponse = await request.post(`${baseURL}/api/invoices`, {
      data: {
        supplierName: 'HashScan Test Supplier',
        supplierEmail: 'hashscan@test.com',
        amount: 1500,
        description: 'HashScan Links Test'
      }
    });
    
    const invoice = await invoiceResponse.json();
    
    // Validate HashScan links are generated
    expect(invoice).toHaveProperty('hashScanLinks');
    expect(invoice.hashScanLinks).toHaveProperty('nft');
    expect(invoice.hashScanLinks).toHaveProperty('file');
    expect(invoice.hashScanLinks).toHaveProperty('topic');
    
    // Validate link formats
    expect(invoice.hashScanLinks.nft).toContain('hashscan.io');
    expect(invoice.hashScanLinks.nft).toContain(invoice.nftTokenId);
    expect(invoice.hashScanLinks.file).toContain('hashscan.io');
    expect(invoice.hashScanLinks.file).toContain(invoice.hfsFileId);
    expect(invoice.hashScanLinks.topic).toContain('hashscan.io');
    expect(invoice.hashScanLinks.topic).toContain(invoice.hcsTopicId);
  });

  test('should handle Hedera network errors gracefully', async ({ request }) => {
    // This test simulates network issues by potentially overwhelming the testnet
    const promises = Array.from({ length: 5 }, (_, i) => 
      request.post(`${baseURL}/api/invoices`, {
        data: {
          supplierName: `Stress Test Supplier ${i}`,
          supplierEmail: `stress${i}@test.com`,
          amount: 1000 + i * 100,
          description: `Stress Test Invoice ${i}`
        }
      })
    );
    
    const responses = await Promise.allSettled(promises);
    
    // At least some should succeed
    const successful = responses.filter(r => 
      r.status === 'fulfilled' && r.value.status() === 201
    ).length;
    
    expect(successful).toBeGreaterThan(0);
    
    // Check for proper error handling
    const failed = responses.filter(r => 
      r.status === 'fulfilled' && r.value.status() >= 400
    );
    
    for (const failedResponse of failed) {
      if (failedResponse.status === 'fulfilled') {
        const errorData = await failedResponse.value.json();
        expect(errorData).toHaveProperty('error');
        expect(typeof errorData.error).toBe('string');
      }
    }
  });

  test('should validate transaction receipts and proofs', async ({ request }) => {
    const invoiceResponse = await request.post(`${baseURL}/api/invoices`, {
      data: {
        supplierName: 'Receipt Test Supplier',
        supplierEmail: 'receipt@test.com',
        amount: 2000,
        description: 'Transaction Receipt Test'
      }
    });
    
    const invoice = await invoiceResponse.json();
    
    // Validate transaction IDs are present
    expect(invoice).toHaveProperty('nftTransactionId');
    expect(invoice).toHaveProperty('hfsTransactionId');
    expect(invoice.nftTransactionId).toMatch(/^0\.0\.[0-9]+@[0-9]+\.[0-9]+$/);
    expect(invoice.hfsTransactionId).toMatch(/^0\.0\.[0-9]+@[0-9]+\.[0-9]+$/);
    
    // Wait for Mirror Node sync
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Validate transaction exists on Mirror Node
    const txResponse = await request.get(`${baseURL}/api/mirror/transaction/${invoice.nftTransactionId}`);
    
    if (txResponse.status() === 200) {
      const txData = await txResponse.json();
      expect(txData.transaction_id).toBe(invoice.nftTransactionId);
      expect(txData.result).toBe('SUCCESS');
    }
  });

  test('should validate metadata encoding and decoding', async ({ request }) => {
    const invoiceData = {
      supplierName: 'Metadata Test Supplier',
      supplierEmail: 'metadata@test.com',
      amount: 3500,
      description: 'Metadata Encoding Test',
      customFields: {
        projectCode: 'PROJ-001',
        department: 'Engineering',
        priority: 'High'
      }
    };

    const response = await request.post(`${baseURL}/api/invoices`, {
      data: invoiceData
    });
    
    const invoice = await response.json();
    
    // Wait for Mirror Node sync
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Fetch NFT metadata from Mirror Node
    const nftResponse = await request.get(`${baseURL}/api/mirror/nft/${invoice.nftTokenId}/${invoice.nftSerialNumber}`);
    
    if (nftResponse.status() === 200) {
      const nftData = await nftResponse.json();
      
      if (nftData.metadata) {
        const metadata = JSON.parse(Buffer.from(nftData.metadata, 'base64').toString());
        
        // Validate all invoice data is preserved in metadata
        expect(metadata.amount).toBe(invoiceData.amount);
        expect(metadata.supplierName).toBe(invoiceData.supplierName);
        expect(metadata.description).toBe(invoiceData.description);
        
        if (invoiceData.customFields) {
          expect(metadata.customFields).toEqual(invoiceData.customFields);
        }
      }
    }
  });
});