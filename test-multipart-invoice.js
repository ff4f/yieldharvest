const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

async function testMultipartInvoice() {
  console.log('🧪 Testing multipart invoice creation...');
  
  try {
    // Create a simple PDF buffer for testing
    const pdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n174\n%%EOF');
    
    // Create form data
    const form = new FormData();
    form.append('invoiceNumber', 'TEST-' + Date.now());
    form.append('supplierId', 'cmfn93uxu0000jsunc3hcqtqf');
    form.append('buyerId', 'cmfn93uy10002jsunreadnd6r');
    form.append('amount', '1000');
    form.append('currency', 'USD');
    form.append('dueDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    form.append('description', 'Test invoice with multipart');
    form.append('pdfFile', pdfBuffer, {
      filename: 'test-invoice.pdf',
      contentType: 'application/pdf'
    });
    
    console.log('📤 Sending multipart request...');
    
    const response = await fetch('http://localhost:3001/api/invoices', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📥 Raw response text:', responseText.substring(0, 500) + (responseText.length > 500 ? '...' : ''));
    
    try {
      const responseData = JSON.parse(responseText);
      console.log('📥 Parsed response:', JSON.stringify(responseData, null, 2));
      
      if (responseData.data && responseData.data.invoice) {
        console.log('✅ Invoice object found in response');
        console.log('📋 Invoice ID:', responseData.data.invoice.id);
        console.log('📋 Invoice Number:', responseData.data.invoice.invoiceNumber);
      } else {
        console.log('❌ No invoice object in response data');
      }
    } catch (parseError) {
      console.log('❌ Failed to parse response as JSON:', parseError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testMultipartInvoice();