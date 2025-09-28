#!/bin/bash

# Test invoice creation with curl
echo "🚀 Testing invoice creation with curl..."

# Create a simple test PDF content
echo "Test PDF content for invoice" > test-invoice.pdf

# Make the POST request with curl
curl -X POST http://localhost:3001/api/invoices \
  -F "invoiceNumber=INV-CURL-001" \
  -F "supplierId=supplier-123" \
  -F "buyerId=buyer-456" \
  -F "amount=1000.00" \
  -F "currency=USD" \
  -F "dueDate=2024-12-31T23:59:59.000Z" \
  -F "description=Test invoice via curl" \
  -F "pdfFile=@test-invoice.pdf" \
  -v

echo "\n\n✅ Curl test completed!"

# Clean up
rm -f test-invoice.pdf