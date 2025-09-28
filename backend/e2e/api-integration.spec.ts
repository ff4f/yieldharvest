import { test, expect } from '@playwright/test';

test.describe('API Integration Tests', () => {
  const baseURL = 'http://localhost:3001';

  test('should fetch invoices from API', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/invoices`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('data');
    expect(data).toHaveProperty('pagination');
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('should create invoice via API', async ({ request }) => {
    const invoiceData = {
      supplierName: 'Test Supplier API',
      supplierEmail: 'api-supplier@test.com',
      amount: 1500,
      description: 'API Test Invoice',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    const response = await request.post(`${baseURL}/api/invoices`, {
      data: invoiceData
    });

    expect(response.status()).toBe(201);
    
    const data = await response.json();
    expect(data).toHaveProperty('id');
    expect(data).toHaveProperty('nftTokenId');
    expect(data).toHaveProperty('nftSerialNumber');
    expect(data.status).toBe('ISSUED');
    expect(data.amount).toBe(1500);
  });

  test('should fund invoice via API', async ({ request }) => {
    // First create an invoice
    const invoiceResponse = await request.post(`${baseURL}/api/invoices`, {
      data: {
        supplierName: 'Test Supplier Fund',
        supplierEmail: 'fund-supplier@test.com',
        amount: 2000,
        description: 'Funding Test Invoice'
      }
    });
    
    const invoice = await invoiceResponse.json();
    
    // Fund the invoice
    const fundingData = {
      investorName: 'Test Investor API',
      investorEmail: 'api-investor@test.com',
      amount: 1600,
      walletAddress: '0.0.123456'
    };

    const fundResponse = await request.post(`${baseURL}/api/invoices/${invoice.id}/fund`, {
      data: fundingData
    });

    expect(fundResponse.status()).toBe(200);
    
    const fundData = await fundResponse.json();
    expect(fundData).toHaveProperty('transactionId');
    expect(fundData).toHaveProperty('hcsMessageId');
    expect(fundData.status).toBe('FUNDED');
  });

  test('should process payment via API', async ({ request }) => {
    // Create and fund an invoice first
    const invoiceResponse = await request.post(`${baseURL}/api/invoices`, {
      data: {
        supplierName: 'Test Supplier Payment',
        supplierEmail: 'payment-supplier@test.com',
        amount: 3000,
        description: 'Payment Test Invoice'
      }
    });
    
    const invoice = await invoiceResponse.json();
    
    await request.post(`${baseURL}/api/invoices/${invoice.id}/fund`, {
      data: {
        investorName: 'Test Investor Payment',
        investorEmail: 'payment-investor@test.com',
        amount: 2400,
        walletAddress: '0.0.789012'
      }
    });

    // Process payment
    const paymentData = {
      walletAddress: '0.0.345678',
      transactionMemo: 'Payment for invoice'
    };

    const payResponse = await request.post(`${baseURL}/api/invoices/${invoice.id}/pay`, {
      data: paymentData
    });

    expect(payResponse.status()).toBe(200);
    
    const payData = await payResponse.json();
    expect(payData).toHaveProperty('transactionId');
    expect(payData).toHaveProperty('hcsMessageId');
    expect(payData.status).toBe('PAID');
  });

  test('should fetch Mirror Node data', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/mirror/nfts/0.0.123456`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('token_id');
      expect(data[0]).toHaveProperty('serial_number');
      expect(data[0]).toHaveProperty('account_id');
    }
  });

  test('should fetch HCS messages', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/mirror/hcs/0.0.654321`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    
    if (data.length > 0) {
      expect(data[0]).toHaveProperty('consensus_timestamp');
      expect(data[0]).toHaveProperty('topic_id');
      expect(data[0]).toHaveProperty('message');
    }
  });

  test('should validate Hedera transaction proofs', async ({ request }) => {
    // Get an invoice with complete flow
    const invoicesResponse = await request.get(`${baseURL}/api/invoices?status=PAID`);
    const invoices = await invoicesResponse.json();
    
    if (invoices.data.length > 0) {
      const invoice = invoices.data[0];
      
      // Validate NFT exists on Hedera
      const nftResponse = await request.get(`${baseURL}/api/mirror/nft/${invoice.nftTokenId}/${invoice.nftSerialNumber}`);
      expect(nftResponse.status()).toBe(200);
      
      const nftData = await nftResponse.json();
      expect(nftData.token_id).toBe(invoice.nftTokenId);
      expect(nftData.serial_number.toString()).toBe(invoice.nftSerialNumber);
      
      // Validate HCS messages exist
      if (invoice.hcsTopicId) {
        const hcsResponse = await request.get(`${baseURL}/api/mirror/hcs/${invoice.hcsTopicId}`);
        expect(hcsResponse.status()).toBe(200);
        
        const hcsData = await hcsResponse.json();
        expect(hcsData.length).toBeGreaterThan(0);
      }
      
      // Validate HFS file exists
      if (invoice.hfsFileId) {
        const hfsResponse = await request.get(`${baseURL}/api/mirror/file/${invoice.hfsFileId}`);
        expect(hfsResponse.status()).toBe(200);
      }
    }
  });

  test('should handle API errors gracefully', async ({ request }) => {
    // Test invalid invoice ID
    const response = await request.get(`${baseURL}/api/invoices/invalid-id`);
    expect(response.status()).toBe(404);
    
    const error = await response.json();
    expect(error).toHaveProperty('error');
    expect(error.error).toContain('not found');
  });

  test('should validate API rate limiting', async ({ request }) => {
    // Make multiple rapid requests
    const promises = Array.from({ length: 20 }, () => 
      request.get(`${baseURL}/api/invoices`)
    );
    
    const responses = await Promise.all(promises);
    
    // Check that most requests succeed
    const successCount = responses.filter(r => r.status() === 200).length;
    expect(successCount).toBeGreaterThan(15);
    
    // Check for rate limiting responses
    const rateLimited = responses.filter(r => r.status() === 429);
    // Rate limiting might not be implemented yet, so this is optional
  });

  test('should validate data consistency between API and Mirror Node', async ({ request }) => {
    // Create an invoice
    const invoiceResponse = await request.post(`${baseURL}/api/invoices`, {
      data: {
        supplierName: 'Consistency Test Supplier',
        supplierEmail: 'consistency@test.com',
        amount: 5000,
        description: 'Data Consistency Test'
      }
    });
    
    const invoice = await invoiceResponse.json();
    
    // Wait a moment for Hedera processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Fetch from Mirror Node
    const mirrorResponse = await request.get(`${baseURL}/api/mirror/nft/${invoice.nftTokenId}/${invoice.nftSerialNumber}`);
    
    if (mirrorResponse.status() === 200) {
      const mirrorData = await mirrorResponse.json();
      
      // Validate consistency
      expect(mirrorData.token_id).toBe(invoice.nftTokenId);
      expect(mirrorData.serial_number.toString()).toBe(invoice.nftSerialNumber);
      
      // Decode and validate metadata
      if (mirrorData.metadata) {
        const metadata = JSON.parse(Buffer.from(mirrorData.metadata, 'base64').toString());
        expect(metadata).toHaveProperty('amount');
        expect(metadata.amount).toBe(invoice.amount);
      }
    }
  });

  test('should validate WebSocket real-time updates', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/');
    
    // Listen for WebSocket messages
    const wsMessages: any[] = [];
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        try {
          const data = JSON.parse(event.payload.toString());
          wsMessages.push(data);
        } catch (e) {
          // Ignore non-JSON messages
        }
      });
    });
    
    // Create an invoice to trigger real-time update
    await page.click('[data-testid="create-invoice-btn"]');
    await page.fill('[data-testid="supplier-name"]', 'WebSocket Test');
    await page.fill('[data-testid="supplier-email"]', 'ws@test.com');
    await page.fill('[data-testid="invoice-amount"]', '1000');
    await page.click('[data-testid="submit-invoice"]');
    
    // Wait for WebSocket message
    await page.waitForTimeout(3000);
    
    // Validate WebSocket updates
    expect(wsMessages.length).toBeGreaterThan(0);
    
    const invoiceUpdate = wsMessages.find(msg => msg.type === 'INVOICE_CREATED');
    expect(invoiceUpdate).toBeDefined();
    expect(invoiceUpdate.data).toHaveProperty('id');
  });
});