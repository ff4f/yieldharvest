const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function testMultipartDebug() {
  console.log('🔍 Debugging multipart form data...');
  
  // Use the proper PDF file we created
  if (!fs.existsSync('test-invoice.pdf')) {
    console.error('test-invoice.pdf not found. Run: node create-test-pdf.js first');
    return;
  }
  
  const form = new FormData();
  
  // Add form fields
  form.append('invoiceNumber', `INV-DEBUG-${Date.now()}`);
  form.append('supplierId', 'cmfn93uxu0000jsunc3hcqtqf');
  form.append('buyerId', 'cmfn93uy10002jsunreadnd6r');
  form.append('amount', '1500');
  form.append('currency', 'USD');
  form.append('dueDate', '2024-12-31T23:59:59.000Z');
  form.append('description', 'Debug test invoice');
  
  // Add file
  form.append('pdfFile', fs.createReadStream('test-invoice.pdf'), {
    filename: 'test-invoice.pdf',
    contentType: 'application/pdf'
  });
  
  console.log('Form headers:', form.getHeaders());
  console.log('Form boundary:', form.getBoundary());
  
  try {
    const response = await fetch('http://localhost:3001/api/invoices', {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders()
      }
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Request failed:', error.message);
  } finally {
    // Note: keeping test-invoice.pdf for reuse
  }
}

testMultipartDebug();