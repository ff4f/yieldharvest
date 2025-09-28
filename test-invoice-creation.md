# Invoice Creation Test Plan

## Test Scenario: Complete Invoice Creation Flow

### Prerequisites
- Frontend running on http://localhost:3000
- Backend running on http://localhost:3001
- HashPack wallet extension installed
- Hedera testnet account with HBAR balance

### Test Steps

1. **Navigate to Create Invoice**
   - Open http://localhost:3000
   - Click "Create Invoice" button
   - Verify form loads correctly

2. **Fill Invoice Form**
   - Enter invoice details:
     - Invoice Number: TEST-001
     - Amount: 100.00
     - Currency: USD
     - Due Date: Future date
     - Description: Test invoice for hackathon demo
   - Upload a PDF file

3. **Connect Wallet**
   - Click "Connect Wallet" button
   - Select HashPack from wallet options
   - Approve connection in HashPack extension
   - Verify wallet address appears in UI

4. **Submit Invoice**
   - Click "Create Invoice" button
   - Verify transaction signing prompt appears
   - Sign transaction in HashPack
   - Wait for transaction confirmation

5. **Verify Results**
   - Check transaction success page appears
   - Verify HashScan links are displayed
   - Click HashScan links to verify:
     - NFT minted on HTS
     - File uploaded to HFS
     - Status recorded on HCS

6. **Verify Backend Integration**
   - Check invoice appears in dashboard
   - Verify all blockchain data is populated
   - Confirm Mirror Node data enrichment

### Expected Outcomes

- ✅ Invoice NFT minted with unique token ID
- ✅ PDF file stored on HFS with file ID
- ✅ Status message recorded on HCS topic
- ✅ All data persisted in database
- ✅ Mirror Node data enrichment working
- ✅ HashScan links functional
- ✅ Wallet integration working

### Known Issues to Address

1. Mirror Node API errors for file fetching
2. Need to verify HTS token creation
3. Need to verify HCS topic setup
4. Wallet connection persistence

### Next Steps

1. Test wallet connection flow
2. Verify Hedera service configurations
3. Test complete invoice creation
4. Fix any integration issues
5. Add error handling improvements