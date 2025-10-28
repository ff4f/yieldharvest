#!/usr/bin/env ts-node

import 'dotenv/config';
import hre from 'hardhat';
const { ethers } = hre;
import fs from 'fs';
import path from 'path';

async function deployViaHardhat(): Promise<void> {
  console.log('🚀 Starting MinimalEscrow deployment via Hardhat...');
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with account: ${deployer.address}`);
  
  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Account balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance === 0n) {
    throw new Error('Insufficient balance for deployment');
  }
  
  // Deploy contract
  console.log('🔨 Deploying MinimalEscrow contract...');
  
  const MinimalEscrow = await ethers.getContractFactory('MinimalEscrow');
  
  // Constructor parameters
  const feeRecipient = deployer.address; // Use deployer as fee recipient
  const owner = deployer.address; // Use deployer as owner
  
  console.log(`Fee Recipient: ${feeRecipient}`);
  console.log(`Owner: ${owner}`);
  
  const contract = await MinimalEscrow.deploy(feeRecipient, owner, {
    gasLimit: 1500000,
    gasPrice: ethers.parseUnits('450', 'gwei') // 450 gwei as per Hedera requirements
  });
  
  console.log('⏳ Waiting for deployment confirmation...');
  await contract.waitForDeployment();
  
  const contractAddress = await contract.getAddress();
  const deploymentTx = contract.deploymentTransaction();
  
  console.log('\n🎉 MinimalEscrow Deployment Complete!');
  console.log('=====================================');
  console.log(`Contract Address: ${contractAddress}`);
  console.log(`Deployment Tx: ${deploymentTx?.hash}`);
  console.log(`Gas Used: ${deploymentTx?.gasLimit.toString()}`);
  
  // Convert EVM address to Hedera contract ID format (approximate)
  // Note: This is a rough conversion, actual contract ID should be obtained from Mirror Node
  const addressBigInt = BigInt(contractAddress);
  const contractId = `0.0.${addressBigInt.toString()}`;
  
  console.log('\n📋 Proof Links:');
  console.log(`HashScan: https://hashscan.io/testnet/contract/${contractAddress}`);
  console.log(`Mirror Node: https://testnet.mirrornode.hedera.com/api/v1/contracts/${contractAddress}`);
  
  // Update .env file
  const envPath = path.join(__dirname, '../.env');
  let envContent = fs.readFileSync(envPath, 'utf8');
  
  // Update or add contract configuration
  if (envContent.includes('ESCROW_CONTRACT_ADDRESS=')) {
    envContent = envContent.replace(/ESCROW_CONTRACT_ADDRESS=.*/, `ESCROW_CONTRACT_ADDRESS="${contractAddress}"`);
  } else {
    envContent += `\nESCROW_CONTRACT_ADDRESS="${contractAddress}"`;
  }
  
  if (envContent.includes('ESCROW_DEPLOYMENT_TX=')) {
    envContent = envContent.replace(/ESCROW_DEPLOYMENT_TX=.*/, `ESCROW_DEPLOYMENT_TX="${deploymentTx?.hash}"`);
  } else {
    envContent += `\nESCROW_DEPLOYMENT_TX="${deploymentTx?.hash}"`;
  }
  
  fs.writeFileSync(envPath, envContent);
  console.log('\n✅ Environment file updated with contract details');
  
  // Test contract interaction
  console.log('\n🧪 Testing contract interaction...');
  
  const contractOwner = await contract.owner();
  const feeRecipientFromContract = await contract.feeRecipient();
  const platformFeeRate = await contract.platformFeeRate();
  
  console.log(`Contract Owner: ${contractOwner}`);
  console.log(`Fee Recipient: ${feeRecipientFromContract}`);
  console.log(`Platform Fee Rate: ${platformFeeRate.toString()} (${Number(platformFeeRate) / 100}%)`);
  
  console.log('\n✅ Contract deployment and verification completed successfully!');
}

// Run deployment if this script is executed directly
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (import.meta.url === `file://${process.argv[1]}`) {
  deployViaHardhat()
    .then(() => {
      console.log('✅ Deployment completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}

export { deployViaHardhat };