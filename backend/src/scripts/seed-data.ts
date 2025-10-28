import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedData() {
  console.log('🌱 Starting database seeding...');

  try {
    // Create test users
    const supplier = await prisma.user.upsert({
      where: { email: 'supplier@test.com' },
      update: {},
      create: {
        accountId: '0.0.1001',
        email: 'supplier@test.com',
        name: 'Test Supplier',
        roles: JSON.stringify(['SUPPLIER']),
        isActive: true,
      },
    });

    const buyer = await prisma.user.upsert({
      where: { email: 'buyer@test.com' },
      update: {},
      create: {
        accountId: '0.0.1002',
        email: 'buyer@test.com',
        name: 'Test Buyer',
        roles: JSON.stringify(['BUYER']),
        isActive: true,
      },
    });

    const agent = await prisma.user.upsert({
      where: { email: 'agent@test.com' },
      update: {},
      create: {
        accountId: '0.0.1003',
        email: 'agent@test.com',
        name: 'Test Agent',
        roles: JSON.stringify(['AGENT']),
        isActive: true,
      },
    });

    console.log('✅ Users created:', { supplier: supplier.id, buyer: buyer.id, agent: agent.id });

    // Create test invoices with Hedera integration
    const invoice1 = await prisma.invoice.upsert({
      where: { invoiceNumber: 'INV-001' },
      update: {},
      create: {
        invoiceNumber: 'INV-001',
        supplierId: supplier.id,
        buyerId: buyer.id,
        agentId: agent.id,
        amount: 1000.00,
        currency: 'USD',
        dueDate: new Date('2024-12-31'),
        description: 'Test invoice with Hedera integration',
        status: 'ISSUED',
        nftTokenId: '0.0.123456',
        nftSerialNumber: '1',
        fileId: '0.0.789012',
        fileHash: 'abc123def456',
        topicId: '0.0.6984577',
      },
    });

    const invoice2 = await prisma.invoice.upsert({
      where: { invoiceNumber: 'INV-002' },
      update: {},
      create: {
        invoiceNumber: 'INV-002',
        supplierId: supplier.id,
        buyerId: buyer.id,
        amount: 2500.00,
        currency: 'USD',
        dueDate: new Date('2024-11-30'),
        description: 'Second test invoice',
        status: 'FUNDED',
        nftTokenId: '0.0.123457',
        nftSerialNumber: '2',
        fileId: '0.0.789013',
        fileHash: 'def456ghi789',
        topicId: '0.0.6984577',
      },
    });

    console.log('✅ Invoices created:', { invoice1: invoice1.id, invoice2: invoice2.id });

    // Create invoice events
    await prisma.invoiceEvent.create({
      data: {
        invoiceId: invoice1.id,
        eventType: 'CREATED',
        description: 'Invoice created',
        hcsMessageId: 'msg-001',
        hcsTimestamp: new Date(),
        transactionId: '0.0.1001@1234567890.123456789',
      },
    });

    await prisma.invoiceEvent.create({
      data: {
        invoiceId: invoice1.id,
        eventType: 'NFT_MINTED',
        description: 'NFT minted for invoice',
        hcsMessageId: 'msg-002',
        hcsTimestamp: new Date(),
        transactionId: '0.0.1001@1234567891.123456789',
      },
    });

    await prisma.invoiceEvent.create({
      data: {
        invoiceId: invoice2.id,
        eventType: 'CREATED',
        description: 'Invoice created',
        hcsMessageId: 'msg-003',
        hcsTimestamp: new Date(),
        transactionId: '0.0.1001@1234567892.123456789',
      },
    });

    await prisma.invoiceEvent.create({
      data: {
        invoiceId: invoice2.id,
        eventType: 'FUNDED',
        description: 'Invoice funded',
        hcsMessageId: 'msg-004',
        hcsTimestamp: new Date(),
        transactionId: '0.0.1001@1234567893.123456789',
      },
    });

    console.log('✅ Invoice events created');

    console.log('🎉 Database seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
if (require.main === module) {
  seedData()
    .then(() => {
      console.log('Seeding finished');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedData };