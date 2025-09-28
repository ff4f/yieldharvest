// Basic test to verify invoice creation flow
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

// Test invoice creation endpoint
async function testInvoiceCreation() {
  console.log('Testing invoice creation flow...');
  
  try {
    // Use the proper PDF file we created
    if (!fs.existsSync('test-invoice.pdf')) {
      console.error('test-invoice.pdf not found. Run: node create-test-pdf.js first');
      return;
    }
    
    // Create form data
    const form = new FormData();
    form.append('invoiceNumber', `INV-${Date.now()}`);
    form.append('supplierId', 'cmfn93uxu0000jsunc3hcqtqf');
    form.append('buyerId', 'cmfn93uy10002jsunreadnd6r');
    form.append('amount', '1000');
    form.append('currency', 'USD');
    form.append('dueDate', '2024-12-31T23:59:59.000Z');
    form.append('description', 'Test invoice for Hedera hackathon demo');
    form.append('pdfFile', fs.createReadStream('test-invoice.pdf'), {
      filename: 'test-invoice.pdf',
      contentType: 'application/pdf'
    });
    
    // Make request to backend
    const response = await fetch('http://localhost:3001/api/invoices', {
      method: 'POST',
      body: form,
      headers: {
        ...form.getHeaders()
      }
    });
    
    const result = await response.json();
    
    if (response.ok && result.data) {
      console.log('✅ Invoice creation successful!');
      console.log('Full invoice object:', JSON.stringify(result.data.invoice, null, 2));
      console.log('Invoice ID:', result.data.invoice.id);
      console.log('NFT Token ID:', result.data.nft.tokenId);
      console.log('NFT Serial Number:', result.data.nft.serialNumber);
      console.log('File ID:', result.data.file.fileId);
      console.log('HCS Transaction ID:', result.data.hcs.transactionId);
      console.log('HashScan URLs:', result.data.hashScanUrls);
      
      // Test HashScan links
      if (result.data.nft.tokenId && result.data.nft.serialNumber) {
        const nftUrl = `https://hashscan.io/testnet/token/${result.data.nft.tokenId}?nftSerial=${result.data.nft.serialNumber}`;
        console.log('🔗 NFT HashScan URL:', nftUrl);
      }
      
      if (result.data.file.fileId) {
        const fileUrl = `https://hashscan.io/testnet/file/${result.data.file.fileId}`;
        console.log('🔗 File HashScan URL:', fileUrl);
      }
      
      if (result.data.hcs.transactionId) {
        const topicUrl = `https://hashscan.io/testnet/transaction/${result.data.hcs.transactionId}`;
        console.log('🔗 HCS Transaction HashScan URL:', topicUrl);
      }
      
      return result.data.invoice;
    } else {
      console.error('❌ Invoice creation failed:', result);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

// Test invoice retrieval
async function testInvoiceRetrieval(invoiceId) {
  console.log('\nTesting invoice retrieval...');
  
  try {
    const response = await fetch(`http://localhost:3001/api/invoices/${invoiceId}`);
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Invoice retrieval successful!');
      console.log('Invoice:', JSON.stringify(result, null, 2));
      return result;
    } else {
      console.error('❌ Invoice retrieval failed:', result);
      return null;
    }
  } catch (error) {
    console.error('❌ Retrieval test failed:', error.message);
    return null;
  }
}

// Test invoice list
async function testInvoiceList() {
  console.log('\nTesting invoice list...');
  
  try {
    const response = await fetch('http://localhost:3001/api/invoices?limit=5');
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Invoice list successful!');
      console.log(`Found ${result.data.length} invoices`);
      console.log('Pagination:', result.pagination);
      return result;
    } else {
      console.error('❌ Invoice list failed:', result);
      return null;
    }
  } catch (error) {
    console.error('❌ List test failed:', error.message);
    return null;
  }
}

// Run all tests
async function runTests() {
  console.log('🚀 Starting YieldHarvest API Tests\n');
  
  // Test invoice creation
  const createdInvoice = await testInvoiceCreation();
  
  if (createdInvoice) {
    // Test invoice retrieval
    await testInvoiceRetrieval(createdInvoice.id);
  }
  
  // Test invoice list
  await testInvoiceList();
  
  console.log('\n🏁 Tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testInvoiceCreation,
  testInvoiceRetrieval,
  testInvoiceList,
  runTests
};