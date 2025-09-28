const fetch = require('node-fetch');

async function testSimpleInvoiceFlow() {
  console.log('🚀 Starting YieldHarvest Simple API Tests');
  console.log('');

  // Test 1: Create simple invoice
  console.log('Testing simple invoice creation...');
  try {
    const invoiceData = {
      invoiceNumber: `INV-SIMPLE-${Date.now()}`,
      supplierId: 'cmfn93uxu0000jsunc3hcqtqf', // PT Supplier Indonesia
      buyerId: 'cmfn93uy10002jsunreadnd6r', // PT Pembeli Besar
      amount: '1000.00',
      currency: 'USD',
      dueDate: '2024-12-31T23:59:59.000Z',
      description: 'Test simple invoice for Hedera hackathon demo'
    };

    const response = await fetch('http://localhost:3001/api/invoices/simple', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoiceData)
    });

    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Simple invoice creation successful!');
      console.log('Invoice ID:', result.data.id);
      console.log('Invoice Number:', result.data.invoiceNumber);
      console.log('Status:', result.data.status);
      console.log('Amount:', result.data.amount, result.data.currency);
      console.log('Full response:', JSON.stringify(result, null, 2));
    } else {
      console.log('❌ Simple invoice creation failed:', result);
    }
  } catch (error) {
    console.log('❌ Simple invoice creation error:', error.message);
  }

  console.log('');

  // Test 2: List invoices
  console.log('Testing invoice list...');
  try {
    const response = await fetch('http://localhost:3001/api/invoices?limit=5');
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Invoice list successful!');
      console.log('Found', result.data.length, 'invoices');
      console.log('Pagination:', result.pagination);
    } else {
      console.log('❌ Invoice list failed:', result);
    }
  } catch (error) {
    console.log('❌ Invoice list error:', error.message);
  }

  console.log('');
  console.log('🏁 Simple tests completed!');
}

testSimpleInvoiceFlow().catch(console.error);