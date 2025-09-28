import { test, expect } from '@playwright/test';

test.describe('Basic API Tests', () => {
  const baseURL = 'http://localhost:3001';

  test('should respond to health check', async ({ request }) => {
    const response = await request.get(`${baseURL}/health`);
    expect(response.status()).toBe(200);
  });

  test('should fetch invoices list', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/invoices`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('data');
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('should create invoice successfully', async ({ request }) => {
    const invoiceData = {
      supplierName: 'Test Supplier',
      supplierEmail: 'supplier@test.com',
      amount: 1000,
      description: 'Test Invoice'
    };

    const response = await request.post(`${baseURL}/api/invoices`, {
      data: invoiceData
    });

    expect(response.status()).toBe(201);
    
    const invoice = await response.json();
    expect(invoice).toHaveProperty('id');
    expect(invoice.supplierName).toBe(invoiceData.supplierName);
    expect(invoice.amount).toBe(invoiceData.amount);
    expect(invoice.status).toBe('ISSUED');
  });

  test('should fetch single invoice', async ({ request }) => {
    // First create an invoice
    const createResponse = await request.post(`${baseURL}/api/invoices`, {
      data: {
        supplierName: 'Fetch Test Supplier',
        supplierEmail: 'fetch@test.com',
        amount: 1500,
        description: 'Fetch Test Invoice'
      }
    });
    
    const createdInvoice = await createResponse.json();
    
    // Then fetch it
    const fetchResponse = await request.get(`${baseURL}/api/invoices/${createdInvoice.id}`);
    
    expect(fetchResponse.status()).toBe(200);
    
    const fetchedInvoice = await fetchResponse.json();
    expect(fetchedInvoice.id).toBe(createdInvoice.id);
    expect(fetchedInvoice.supplierName).toBe('Fetch Test Supplier');
  });

  test('should handle invalid invoice ID', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/invoices/invalid-id`);
    expect(response.status()).toBe(404);
  });

  test('should validate required fields on invoice creation', async ({ request }) => {
    const invalidData = {
      supplierName: 'Test Supplier'
      // Missing required fields
    };

    const response = await request.post(`${baseURL}/api/invoices`, {
      data: invalidData
    });

    expect(response.status()).toBe(400);
  });

  test('should fund invoice if implemented', async ({ request }) => {
    // Create invoice first
    const invoiceResponse = await request.post(`${baseURL}/api/invoices`, {
      data: {
        supplierName: 'Fund Test Supplier',
        supplierEmail: 'fund@test.com',
        amount: 2000,
        description: 'Fund Test Invoice'
      }
    });
    
    const invoice = await invoiceResponse.json();
    
    // Try to fund it
    const fundingData = {
      investorName: 'Test Investor',
      investorEmail: 'investor@test.com',
      amount: 1600,
      walletAddress: '0.0.123456'
    };

    const fundResponse = await request.post(`${baseURL}/api/invoices/${invoice.id}/fund`, {
      data: fundingData
    });

    // Accept either success or not implemented
    expect([200, 201, 404, 501]).toContain(fundResponse.status());
    
    if (fundResponse.status() === 200 || fundResponse.status() === 201) {
      const fundData = await fundResponse.json();
      expect(fundData).toHaveProperty('status');
    }
  });

  test('should handle CORS properly', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/invoices`, {
      headers: {
        'Origin': 'http://localhost:3000'
      }
    });
    
    expect(response.status()).toBe(200);
    
    const headers = response.headers();
    expect(headers['access-control-allow-origin']).toBeDefined();
  });

  test('should return proper content-type', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/invoices`);
    
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
  });

  test('should handle pagination if implemented', async ({ request }) => {
    const response = await request.get(`${baseURL}/api/invoices?page=1&limit=5`);
    
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('data');
    
    // Check if pagination is implemented
    if (data.pagination) {
      expect(data.pagination).toHaveProperty('page');
      expect(data.pagination).toHaveProperty('limit');
      expect(data.pagination).toHaveProperty('total');
    }
  });
});