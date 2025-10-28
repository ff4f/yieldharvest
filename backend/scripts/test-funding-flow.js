import hre from 'hardhat';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { ethers } = hre;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Contract address from environment
const ESCROW_CONTRACT_ADDRESS = process.env.ESCROW_CONTRACT_ADDRESS || '0x75e3c67F65a1a7671a4438F2d6ec7d755Ab5D36A';

async function main() {
  console.log('🧪 Testing Complete Funding Flow on Hedera Testnet');
  console.log('================================================\n');
  
  // Get signers (we'll use the same account for all roles in this test)
  const [deployer] = await ethers.getSigners();
  const investor = deployer; // Same account acts as investor
  const supplier = deployer; // Same account acts as supplier
  
  console.log('👥 Test Accounts:');
  console.log('Deployer/Investor/Supplier:', deployer.address);
  console.log('(Note: Using same account for all roles in this test)');
  
  // Get balance
  const deployerBalance = await ethers.provider.getBalance(deployer.address);
  
  console.log('\n💰 Initial Balance:');
  console.log('Account:', ethers.formatEther(deployerBalance), 'HBAR');
  
  // Connect to deployed contract
  console.log('\n🔗 Connecting to EscrowPool contract...');
  const EscrowPool = await ethers.getContractFactory('EscrowPool');
  const escrowPool = EscrowPool.attach(ESCROW_CONTRACT_ADDRESS);
  
  // Verify contract connection
  try {
    const owner = await escrowPool.owner();
    const feeRate = await escrowPool.platformFeeRate();
    const contractBalance = await escrowPool.getBalance();
    
    console.log('✅ Contract connected successfully');
    console.log('Contract owner:', owner);
    console.log('Platform fee rate:', feeRate.toString(), 'basis points');
    console.log('Contract balance:', ethers.formatEther(contractBalance), 'HBAR');
  } catch (error) {
    console.error('❌ Failed to connect to contract:', error.message);
    return;
  }
  
  // Test data
  const testInvoiceId = 'INV-TEST-' + Date.now();
  const testNftTokenId = '0.0.6861251'; // From env
  const testNftSerialNumber = 1;
  const fundingAmount = ethers.parseEther('10'); // 10 HBAR
  const dueDate = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 days from now
  const fileHash = 'QmTestFileHash123456789';
  
  // Transaction variables
  let depositTx, releaseTx, netChange;
  
  console.log('\n📋 Test Invoice Details:');
  console.log('Invoice ID:', testInvoiceId);
  console.log('NFT Token ID:', testNftTokenId);
  console.log('NFT Serial Number:', testNftSerialNumber);
  console.log('Funding Amount:', ethers.formatEther(fundingAmount), 'HBAR');
  console.log('Due Date:', new Date(dueDate * 1000).toISOString());
  console.log('File Hash:', fileHash);
  
  // Step 1: Create and Fund Escrow (single transaction)
  console.log('\n🏗️  Step 1: Creating and Funding Escrow...');
  try {
    depositTx = await escrowPool.connect(investor).deposit(
      testInvoiceId,
      testNftTokenId,
      testNftSerialNumber,
      supplier.address,
      dueDate,
      fileHash,
      {
        value: fundingAmount,
        gasLimit: 500000
      }
    );
    
    console.log('⏳ Waiting for escrow creation and funding...');
    const depositReceipt = await depositTx.wait();
    
    console.log('✅ Escrow created and funded successfully!');
    console.log('Transaction hash:', depositTx.hash);
    console.log('Gas used:', depositReceipt.gasUsed.toString());
    console.log('HashScan URL:', `https://hashscan.io/testnet/transaction/${depositTx.hash}`);
    
    // Get escrow details
    const escrowId = await escrowPool.invoiceToEscrowId(testInvoiceId);
    const escrow = await escrowPool.escrows(escrowId);
    console.log('\n📄 Escrow Details:');
    console.log('Escrow ID:', escrowId);
    console.log('Invoice ID:', escrow.invoiceId);
    console.log('NFT Token ID:', escrow.nftTokenId);
    console.log('NFT Serial Number:', escrow.nftSerialNumber.toString());
    console.log('Investor:', escrow.investor);
    console.log('Supplier:', escrow.supplier);
    console.log('Amount:', ethers.formatEther(escrow.amount), 'HBAR');
    console.log('Status:', escrow.status); // 1 = FUNDED
    console.log('Deposited At:', new Date(Number(escrow.depositedAt) * 1000).toISOString());
    
    // Check contract balance
    const contractBalance = await escrowPool.getBalance();
    console.log('Contract balance after deposit:', ethers.formatEther(contractBalance), 'HBAR');
    
  } catch (error) {
    console.error('❌ Failed to create and fund escrow:', error.message);
    return;
  }
  
  // Step 2: Release Funds (Simulate successful invoice payment)
  console.log('\n🚀 Step 2: Releasing Funds to Supplier...');
  try {
    // Get account balance before release
    const balanceBefore = await ethers.provider.getBalance(supplier.address);
    
    releaseTx = await escrowPool.connect(investor).release(testInvoiceId, {
      gasLimit: 500000
    });
    
    console.log('⏳ Waiting for fund release...');
    const releaseReceipt = await releaseTx.wait();
    
    console.log('✅ Funds released successfully!');
    console.log('Transaction hash:', releaseTx.hash);
    console.log('Gas used:', releaseReceipt.gasUsed.toString());
    console.log('HashScan URL:', `https://hashscan.io/testnet/transaction/${releaseTx.hash}`);
    
    // Check account balance after release (note: will be lower due to gas costs)
    const balanceAfter = await ethers.provider.getBalance(supplier.address);
    netChange = balanceAfter - balanceBefore;
    
    console.log('\n💰 Payment Summary:');
    console.log('Balance before release:', ethers.formatEther(balanceBefore), 'HBAR');
    console.log('Balance after release:', ethers.formatEther(balanceAfter), 'HBAR');
    console.log('Net change (after gas):', ethers.formatEther(netChange), 'HBAR');
    
    // Check final escrow status
    const finalEscrowId = await escrowPool.invoiceToEscrowId(testInvoiceId);
    const finalEscrow = await escrowPool.escrows(finalEscrowId);
    console.log('Final escrow status:', finalEscrow.status); // 2 = RELEASED
    
    // Check final contract balance
    const finalContractBalance = await escrowPool.getBalance();
    console.log('Final contract balance:', ethers.formatEther(finalContractBalance), 'HBAR');
    
  } catch (error) {
    console.error('❌ Failed to release funds:', error.message);
    return;
  }
  
  // Generate test report
  const testReport = {
    testName: 'Complete Funding Flow Test',
    timestamp: new Date().toISOString(),
    network: 'hederaTestnet',
    contractAddress: ESCROW_CONTRACT_ADDRESS,
    testInvoiceId: testInvoiceId,
    participants: {
      deployer: deployer.address,
      investor: investor.address,
      supplier: supplier.address
    },
    transactions: {
      createAndFundEscrow: `https://hashscan.io/testnet/transaction/${depositTx?.hash}`,
      releaseFunds: `https://hashscan.io/testnet/transaction/${releaseTx?.hash}`
    },
    amounts: {
      fundingAmount: ethers.formatEther(fundingAmount),
      netChange: ethers.formatEther(netChange || 0)
    },
    status: 'SUCCESS'
  };
  
  // Save test report
  const reportsDir = path.join(__dirname, '..', 'test-reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportFile = path.join(reportsDir, `funding-flow-test-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(testReport, null, 2));
  
  console.log('\n📊 Test Report saved to:', reportFile);
  console.log('\n🎉 Complete Funding Flow Test PASSED!');
  console.log('✅ All escrow operations completed successfully on Hedera testnet');
  
  return testReport;
}

main()
  .then((result) => {
    console.log('\n🏁 Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test failed:', error);
    process.exit(1);
  });