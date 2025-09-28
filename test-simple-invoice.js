const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

async function testSimpleInvoiceCreation() {
  console.log('🧪 Testing simple invoice creation...');
  
  try {
    // Create form data
    const form = new FormData();
    form.append('invoiceNumber', 'TEST-' + Date.now());
    form.append('supplierId', 'cmfn93uxu0000jsunc3hcqtqf'); // PT Supplier Indonesia
    form.append('buyerId', 'cmfn93uy10002jsunreadnd6r'); // PT Pembeli Besar
    form.append('amount', '1000.00');
    form.append('currency', 'USD');
    form.append('dueDate', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
    form.append('description', 'Test invoice');
    
    // Add a simple PDF file
    const pdfPath = path.join(__dirname, 'test-invoice.pdf');
    form.append('pdfFile', fs.createReadStream(pdfPath));
    
    console.log('📤 Sending request...');
    const response = await fetch('http://localhost:3001/api/invoices', {
      method: 'POST',
      body: form,
      headers: form.getHeaders()
    });
    
    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('📥 Raw response text:', responseText);
    
    try {
      const result = JSON.parse(responseText);
      console.log('📥 Parsed response:', JSON.stringify(result, null, 2));
      
      if (result.data && result.data.invoice) {
        console.log('✅ Invoice object found in response');
        console.log('📋 Invoice ID:', result.data.invoice.id);
        console.log('📋 Invoice Number:', result.data.invoice.invoiceNumber);
      } else {
        console.log('❌ No invoice object in response data');
      }
    } catch (parseError) {
      console.log('❌ Failed to parse JSON response:', parseError.message);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

if (require.main === module) {
  testSimpleInvoiceCreation().catch(console.error);
}

module.exports = { testSimpleInvoiceCreation };