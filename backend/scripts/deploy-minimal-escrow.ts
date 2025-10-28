#!/usr/bin/env ts-node

import 'dotenv/config';
import {
  Client,
  PrivateKey,
  AccountId,
  ContractCreateTransaction,
  ContractFunctionParameters,
  FileCreateTransaction,
  Hbar,
} from '@hashgraph/sdk';
import fs from 'fs';
import path from 'path';

async function deployMinimalEscrow(): Promise<void> {
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;
  const feeRecipient = process.env.PLATFORM_FEE_RECIPIENT || operatorId;
  
  if (!operatorId || !operatorKey) {
    throw new Error('HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY must be set');
  }

  console.log('🚀 Starting MinimalEscrow deployment...');
  console.log(`Operator ID: ${operatorId}`);
  console.log(`Fee Recipient: ${feeRecipient}`);

  // Initialize client
  const client = Client.forTestnet();
  client.setOperator(AccountId.fromString(operatorId), PrivateKey.fromStringDer(operatorKey));

  try {
    // Load contract bytecode
    const artifactPath = path.join(__dirname, '../artifacts/contracts/MinimalEscrow.sol/MinimalEscrow.json');
    
    if (!fs.existsSync(artifactPath)) {
      throw new Error('Contract artifact not found. Run "npx hardhat compile" first.');
    }
    
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const bytecode = artifact.bytecode;
    
    console.log(`📄 Contract bytecode size: ${bytecode.length / 2} bytes`);

    // Upload bytecode to HFS
    console.log('📤 Uploading contract bytecode to HFS...');
    
    const cleanBytecode = bytecode.startsWith('0x') ? bytecode.slice(2) : bytecode;
    const bytecodeBuffer = Buffer.from(cleanBytecode, 'hex');
    
    const fileCreateTx = new FileCreateTransaction()
      .setContents(bytecodeBuffer)
      .setMaxTransactionFee(Hbar.fromTinybars(200_000_000));
    
    const fileCreateResponse = await fileCreateTx.execute(client);
    const fileCreateReceipt = await fileCreateResponse.getReceipt(client);
    
    if (!fileCreateReceipt.fileId) {
      throw new Error('Failed to create file');
    }
    
    const fileId = fileCreateReceipt.fileId;
    console.log(`✅ Bytecode uploaded to HFS: ${fileId.toString()}`);

    // Deploy contract
    console.log('🔨 Deploying MinimalEscrow contract...');
    
    const feeRecipientAccountId = AccountId.fromString(feeRecipient);
    const ownerAccountId = AccountId.fromString(operatorId);
    
    const constructorParams = new ContractFunctionParameters()
      .addAddress(feeRecipientAccountId.toSolidityAddress())
      .addAddress(ownerAccountId.toSolidityAddress());
    
    const contractCreateTx = new ContractCreateTransaction()
      .setBytecodeFileId(fileId)
      .setGas(1_000_000) // Lower gas limit for minimal contract
      .setConstructorParameters(constructorParams)
      .setMaxTransactionFee(Hbar.fromTinybars(500_000_000));
    
    const contractCreateResponse = await contractCreateTx.execute(client);
    const contractCreateReceipt = await contractCreateResponse.getReceipt(client);
    
    if (!contractCreateReceipt.contractId) {
      throw new Error('Failed to deploy contract');
    }
    
    const contractId = contractCreateReceipt.contractId.toString();
    const contractAddress = contractCreateReceipt.contractId.toSolidityAddress();
    const deploymentTxId = contractCreateResponse.transactionId.toString();
    
    console.log('\n🎉 MinimalEscrow Deployment Complete!');
    console.log('=====================================');
    console.log(`Contract ID: ${contractId}`);
    console.log(`Contract Address: ${contractAddress}`);
    console.log(`File ID: ${fileId.toString()}`);
    console.log(`Deployment Tx: ${deploymentTxId}`);
    console.log('\n📋 Proof Links:');
    console.log(`HashScan: https://hashscan.io/testnet/contract/${contractId}`);
    console.log(`Mirror Node: https://testnet.mirrornode.hedera.com/api/v1/contracts/${contractId}`);
    
    // Update .env file
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Update or add contract configuration
    if (envContent.includes('ESCROW_CONTRACT_ID=')) {
      envContent = envContent.replace(/ESCROW_CONTRACT_ID=.*/, `ESCROW_CONTRACT_ID="${contractId}"`);
    } else {
      envContent += `\nESCROW_CONTRACT_ID="${contractId}"`;
    }
    
    if (envContent.includes('ESCROW_CONTRACT_ADDRESS=')) {
      envContent = envContent.replace(/ESCROW_CONTRACT_ADDRESS=.*/, `ESCROW_CONTRACT_ADDRESS="${contractAddress}"`);
    } else {
      envContent += `\nESCROW_CONTRACT_ADDRESS="${contractAddress}"`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('\n✅ Environment file updated with contract details');
    
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  } finally {
    client.close();
  }
}

// Run deployment if this script is executed directly
if (require.main === module) {
  deployMinimalEscrow()
    .then(() => {
      console.log('✅ Deployment completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}

export { deployMinimalEscrow };