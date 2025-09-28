const {
  Client,
  PrivateKey,
  AccountId,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  TopicCreateTransaction,
  Hbar
} = require('@hashgraph/sdk');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

async function setupHederaInfrastructure() {
  console.log('🚀 Setting up Hedera infrastructure for YieldHarvest...');
  
  // Initialize Hedera client
  const operatorId = AccountId.fromString(process.env.OPERATOR_ID);
  const operatorKey = PrivateKey.fromString(process.env.OPERATOR_KEY);
  
  const client = Client.forTestnet();
  client.setOperator(operatorId, operatorKey);
  
  try {
    console.log('\n📋 Creating HCS Topic for invoice status updates...');
    
    // Create HCS Topic for invoice status messages
    const topicCreateTx = new TopicCreateTransaction()
      .setTopicMemo('YieldHarvest Invoice Status Updates')
      .setSubmitKey(operatorKey.publicKey)
      .setMaxTransactionFee(new Hbar(2));
    
    const topicCreateSubmit = await topicCreateTx.execute(client);
    const topicCreateReceipt = await topicCreateSubmit.getReceipt(client);
    const topicId = topicCreateReceipt.topicId;
    
    console.log(`✅ HCS Topic created: ${topicId}`);
    console.log(`🔗 HashScan: https://hashscan.io/testnet/topic/${topicId}`);
    
    console.log('\n🎨 Creating HTS NFT Token for invoice NFTs...');
    
    // Create HTS NFT Token for invoice NFTs
    const nftCreateTx = new TokenCreateTransaction()
      .setTokenName('YieldHarvest Invoice NFT')
      .setTokenSymbol('YHINV')
      .setTokenType(TokenType.NonFungibleUnique)
      .setDecimals(0)
      .setInitialSupply(0)
      .setTreasuryAccountId(operatorId)
      .setSupplyType(TokenSupplyType.Infinite)
      .setSupplyKey(operatorKey)
      .setAdminKey(operatorKey)
      .setTokenMemo('YieldHarvest Invoice NFTs - Each NFT represents a unique invoice')
      .setMaxTransactionFee(new Hbar(30));
    
    const nftCreateSubmit = await nftCreateTx.execute(client);
    const nftCreateReceipt = await nftCreateSubmit.getReceipt(client);
    const tokenId = nftCreateReceipt.tokenId;
    
    console.log(`✅ HTS NFT Token created: ${tokenId}`);
    console.log(`🔗 HashScan: https://hashscan.io/testnet/token/${tokenId}`);
    
    // Update .env file with new IDs
    const envPath = path.join(__dirname, 'backend', '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    
    // Replace placeholder values
    envContent = envContent.replace(/INVOICE_TOKEN_ID=".*"/, `INVOICE_TOKEN_ID="${tokenId}"`);
    envContent = envContent.replace(/INVOICE_TOPIC_ID=".*"/, `INVOICE_TOPIC_ID="${topicId}"`);
    
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n📝 Updated backend/.env with new Hedera IDs:');
    console.log(`   INVOICE_TOKEN_ID="${tokenId}"`);
    console.log(`   INVOICE_TOPIC_ID="${topicId}"`);
    
    console.log('\n🎉 Hedera infrastructure setup complete!');
    console.log('\n📋 Summary:');
    console.log(`   • HCS Topic ID: ${topicId}`);
    console.log(`   • HTS NFT Token ID: ${tokenId}`);
    console.log(`   • Operator Account: ${operatorId}`);
    console.log(`   • Network: Testnet`);
    
    console.log('\n🔗 HashScan Links:');
    console.log(`   • Topic: https://hashscan.io/testnet/topic/${topicId}`);
    console.log(`   • Token: https://hashscan.io/testnet/token/${tokenId}`);
    console.log(`   • Account: https://hashscan.io/testnet/account/${operatorId}`);
    
    console.log('\n⚠️  Please restart the backend server to use the new configuration.');
    
  } catch (error) {
    console.error('❌ Error setting up Hedera infrastructure:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Check your OPERATOR_ID and OPERATOR_KEY in backend/.env');
    console.error('2. Ensure your account has sufficient HBAR balance');
    console.error('3. Verify network connectivity to Hedera testnet');
    process.exit(1);
  } finally {
    client.close();
  }
}

if (require.main === module) {
  setupHederaInfrastructure().catch(console.error);
}

module.exports = { setupHederaInfrastructure };