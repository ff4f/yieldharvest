#!/usr/bin/env ts-node

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Demo data for YieldHarvest platform
 */
const DEMO_DATA = {
  // Demo users
  users: [
    {
      email: 'supplier1@yieldharvest.com',
      name: 'AgriSupply Indonesia',
      role: 'SUPPLIER',
      hederaAccountId: '0.0.6435668'
    },
    {
      email: 'supplier2@yieldharvest.com',
      name: 'Farm Equipment Co.',
      role: 'SUPPLIER',
      hederaAccountId: '0.0.6496392'
    },
    {
      email: 'buyer1@yieldharvest.com',
      name: 'Global Food Corp',
      role: 'BUYER',
      hederaAccountId: '0.0.100002'
    },
    {
      email: 'investor1@yieldharvest.com',
      name: 'AgriFinance Partners',
      role: 'INVESTOR',
      hederaAccountId: '0.0.100007'
    },
    {
      email: 'agent1@yieldharvest.com',
      name: 'Budi Santoso',
      role: 'AGENT',
      hederaAccountId: '0.0.100008'
    }
  ],

  // Demo invoices (NFTs)
  invoices: [
    {
      invoiceNumber: 'INV-2024-001',
      amount: 5000.00,
      currency: 'USD',
      dueDate: new Date('2024-03-15'),
      status: 'ISSUED',
      description: 'Agricultural equipment purchase',
      nftTokenId: '0.0.123456',
      nftSerialNumber: '1',
      fileId: '0.0.200001',
      fileHash: 'bafkreiabcd1234567890abcdef1234567890abcdef1234567890abcdef12',
      topicId: '0.0.300001'
    },
    {
      invoiceNumber: 'INV-2024-002',
      amount: 12500.00,
      currency: 'USD',
      dueDate: new Date('2024-04-01'),
      status: 'FUNDED',
      description: 'Seed and fertilizer supply',
      nftTokenId: '0.0.123457',
      nftSerialNumber: '1',
      fileId: '0.0.200002',
      fileHash: 'bafkreiefgh1234567890abcdef1234567890abcdef1234567890abcdef34',
      topicId: '0.0.300001'
    }
  ],

  // Demo invoice events
  events: [
    {
      eventType: 'CREATED',
      description: 'Invoice created and issued to buyer',
      metadata: JSON.stringify({
        location: 'Farm Office, Indonesia',
        agent: 'Budi Santoso'
      }),
      hcsMessageId: 'msg-001',
      hcsTimestamp: new Date('2024-01-15T10:00:00Z'),
      transactionId: '0.0.123456@1705320000.123456789'
    },
    {
      eventType: 'FILE_UPLOADED',
      description: 'Invoice PDF uploaded to Hedera File Service',
      metadata: JSON.stringify({
        fileId: '0.0.200001',
        fileHash: 'bafkreiabcd1234567890abcdef1234567890abcdef1234567890abcdef12'
      }),
      hcsMessageId: 'msg-002',
      hcsTimestamp: new Date('2024-01-15T10:05:00Z'),
      transactionId: '0.0.123456@1705320300.123456789'
    }
  ],

  // Demo investors
  investors: [
    {
      availableBalance: 50000.00,
      totalInvested: 0.00,
      totalReturns: 0.00,
      riskTolerance: 'MEDIUM'
    }
  ]
};

/**
 * Clear all existing data
 */
async function clearData() {
  logger.info('Clearing existing data...');
  
  await prisma.invoiceEvent.deleteMany();
  await prisma.funding.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.investor.deleteMany();
  await prisma.user.deleteMany();
  
  logger.info('Data cleared successfully');
}

/**
 * Seed users
 */
async function seedUsers() {
  logger.info('Seeding users...');
  
  for (const user of DEMO_DATA.users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: user,
      create: user
    });
  }
  
  logger.info(`Seeded ${DEMO_DATA.users.length} users`);
}

/**
 * Seed invoices
 */
async function seedInvoices() {
  logger.info('Seeding invoices...');
  
  const users = await prisma.user.findMany();
  const supplier1 = users.find(u => u.role === 'SUPPLIER' && u.email === 'supplier1@yieldharvest.com');
  const supplier2 = users.find(u => u.role === 'SUPPLIER' && u.email === 'supplier2@yieldharvest.com');
  const agent = users.find(u => u.role === 'AGENT');
  
  if (!supplier1 || !supplier2 || !agent) {
    throw new Error('Required users not found for invoice seeding');
  }
  
  const invoicesWithSuppliers = [
    {
      ...DEMO_DATA.invoices[0],
      supplierId: supplier1.id,
      agentId: agent.id
    },
    {
      ...DEMO_DATA.invoices[1],
      supplierId: supplier2.id,
      agentId: agent.id
    }
  ];
  
  for (const invoice of invoicesWithSuppliers) {
    await prisma.invoice.upsert({
      where: { invoiceNumber: invoice.invoiceNumber },
      update: invoice,
      create: invoice
    });
  }
  
  logger.info(`Seeded ${invoicesWithSuppliers.length} invoices`);
}

/**
 * Seed invoice events
 */
async function seedInvoiceEvents() {
  logger.info('Seeding invoice events...');
  
  const invoices = await prisma.invoice.findMany();
  const invoice1 = invoices.find(i => i.invoiceNumber === 'INV-2024-001');
  
  if (!invoice1) {
    throw new Error('Invoice not found for event seeding');
  }
  
  for (const event of DEMO_DATA.events) {
    await prisma.invoiceEvent.create({
      data: {
        ...event,
        invoiceId: invoice1.id
      }
    });
  }
  
  logger.info(`Seeded ${DEMO_DATA.events.length} invoice events`);
}

/**
 * Seed investors
 */
async function seedInvestors() {
  logger.info('Seeding investors...');
  
  const investorUser = await prisma.user.findFirst({
    where: { role: 'INVESTOR' }
  });
  
  if (!investorUser) {
    throw new Error('Investor user not found');
  }
  
  await prisma.investor.create({
    data: {
      ...DEMO_DATA.investors[0],
      userId: investorUser.id
    }
  });
  
  logger.info('Seeded 1 investor profile');
}

async function main() {
  try {
    logger.info('🌱 Starting YieldHarvest database seeding...');
    
    // Clear existing data
    await clearData();
    
    // Seed new data
    await seedUsers();
    await seedInvoices();
    await seedInvoiceEvents();
    await seedInvestors();
    
    logger.info('Database seeding completed successfully!');
    
    // Print summary
    const counts = {
      users: await prisma.user.count(),
      invoices: await prisma.invoice.count(),
      events: await prisma.invoiceEvent.count(),
      investors: await prisma.investor.count()
    };
    
    logger.info('Database summary:', counts);
    
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
main().catch((error) => {
  logger.error('Failed to run seeder:', error);
  process.exit(1);
});