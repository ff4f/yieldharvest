import hre from 'hardhat';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { ethers } = hre;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('🚀 Deploying EscrowPool contract to Hedera...');
  
  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log('Deploying with account:', deployer.address);
  
  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log('Account balance:', ethers.formatEther(balance), 'HBAR');
  
  // Set fee recipient (can be the deployer for now)
  const feeRecipient = process.env.FEE_RECIPIENT_ADDRESS || deployer.address;
  console.log('Fee recipient:', feeRecipient);
  
  // Deploy the contract
  console.log('\n📄 Deploying EscrowPool contract...');
  const EscrowPool = await ethers.getContractFactory('EscrowPool');
  
  const escrowPool = await EscrowPool.deploy(feeRecipient, deployer.address, {
    gasLimit: 3000000, // Set explicit gas limit for Hedera
  });
  
  console.log('⏳ Waiting for deployment...');
  await escrowPool.waitForDeployment();
  
  const contractAddress = await escrowPool.getAddress();
  const deploymentTx = escrowPool.deploymentTransaction();
  
  console.log('\n✅ EscrowPool deployed successfully!');
  console.log('📍 Contract address:', contractAddress);
  console.log('🔗 Transaction hash:', deploymentTx.hash);
  console.log('⛽ Gas used:', deploymentTx.gasLimit.toString());
  
  // Wait for a few confirmations
  console.log('\n⏳ Waiting for confirmations...');
  await deploymentTx.wait(2);
  
  // Verify contract deployment
  console.log('\n🔍 Verifying deployment...');
  const code = await ethers.provider.getCode(contractAddress);
  if (code === '0x') {
    throw new Error('Contract deployment failed - no code at address');
  }
  
  // Test basic contract functions
  console.log('\n🧪 Testing contract functions...');
  
  try {
    const owner = await escrowPool.owner();
    const feeRate = await escrowPool.platformFeeRate();
    const feeRecipientAddr = await escrowPool.feeRecipient();
    const balance = await escrowPool.getBalance();
    
    console.log('Contract owner:', owner);
    console.log('Platform fee rate:', feeRate.toString(), 'basis points');
    console.log('Fee recipient:', feeRecipientAddr);
    console.log('Contract balance:', ethers.formatEther(balance), 'HBAR');
    
  } catch (error) {
    console.error('❌ Error testing contract functions:', error.message);
  }
  
  // Save deployment info
  const deploymentInfo = {
    network: process.env.HARDHAT_NETWORK || 'hederaTestnet',
    contractName: 'EscrowPool',
    contractAddress: contractAddress,
    deployerAddress: deployer.address,
    feeRecipient: feeRecipient,
    transactionHash: deploymentTx.hash,
    gasUsed: deploymentTx.gasLimit.toString(),
    timestamp: new Date().toISOString(),
    blockNumber: deploymentTx.blockNumber,
    platformFeeRate: '250', // 2.5%
    hashScanUrl: `https://hashscan.io/testnet/contract/${contractAddress}`,
  };
  
  // Create deployments directory if it doesn't exist
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  
  // Save deployment info to file
  const deploymentFile = path.join(
    deploymentsDir,
    `escrow-deployment-${Date.now()}.json`
  );
  
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  
  console.log('\n💾 Deployment info saved to:', deploymentFile);
  console.log('\n🔗 HashScan URL:', deploymentInfo.hashScanUrl);
  
  // Update environment variables template
  const envTemplate = `
# EscrowPool Contract Deployment
ESCROW_CONTRACT_ADDRESS=${contractAddress}
ESCROW_DEPLOYMENT_TX=${deploymentTx.hash}
ESCROW_FEE_RECIPIENT=${feeRecipient}
`;
  
  console.log('\n📝 Add these to your .env file:');
  console.log(envTemplate);
  
  return {
    contractAddress,
    transactionHash: deploymentTx.hash,
    deploymentInfo,
  };
}

// Handle errors
main()
  .then((result) => {
    console.log('\n🎉 Deployment completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Deployment failed:', error);
    process.exit(1);
  });