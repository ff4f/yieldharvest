#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';

const prisma = new PrismaClient();

interface DemoUser {
  id: string;
  name: string;
  email: string;
  accountId: string;
  role: 'SUPPLIER' | 'BUYER' | 'AGENT' | 'INVESTOR';
}

interface DemoInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  buyerId?: string;
  agentId?: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: string;
  description: string;
  nftTokenId?: string;
  nftSerialNumber?: string;
  fileId?: string;
  fileHash?: string;
  topicId?: string;
}

async function clearExistingData() {
  console.log('🧹 Clearing existing demo data...');
  
  await prisma.funding.deleteMany();
  await prisma.invoiceEvent.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.investor.deleteMany();
  await prisma.user.deleteMany();
  
  console.log('✅ Existing data cleared');
}

async function createDemoUsers(): Promise<DemoUser[]> {
  console.log('👥 Creating demo users...');
  
  const users: DemoUser[] = [
    // Suppliers
    {
      id: '',
      name: 'TechCorp Solutions',
      email: 'supplier@techcorp.com',
      accountId: '0.0.1001',
      role: 'SUPPLIER'
    },
    {
      id: '',
      name: 'Global Manufacturing Ltd',
      email: 'supplier@globalmanuf.com',
      accountId: '0.0.1002',
      role: 'SUPPLIER'
    },
    {
      id: '',
      name: 'Green Energy Systems',
      email: 'supplier@greenenergy.com',
      accountId: '0.0.1003',
      role: 'SUPPLIER'
    },
    
    // Buyers
    {
      id: '',
      name: 'Retail Giant Corp',
      email: 'buyer@retailgiant.com',
      accountId: '0.0.2001',
      role: 'BUYER'
    },
    {
      id: '',
      name: 'Construction Mega Inc',
      email: 'buyer@constructionmega.com',
      accountId: '0.0.2002',
      role: 'BUYER'
    },
    
    // Agents/Investors
    {
      id: '',
      name: 'FinTech Ventures',
      email: 'agent@fintechventures.com',
      accountId: '0.0.3001',
      role: 'AGENT'
    },
    {
      id: '',
      name: 'Capital Growth Partners',
      email: 'investor@capitalgrowth.com',
      accountId: '0.0.3002',
      role: 'INVESTOR'
    },
    {
      id: '',
      name: 'Blockchain Investment Fund',
      email: 'investor@blockchainfund.com',
      accountId: '0.0.3003',
      role: 'INVESTOR'
    }
  ];

  const createdUsers: DemoUser[] = [];
  
  for (const userData of users) {
    const user = await prisma.user.create({
      data: {
        name: userData.name,
        email: userData.email,
        accountId: userData.accountId,
        roles: JSON.stringify([userData.role])
      }
    });
    
    createdUsers.push({
      ...userData,
      id: user.id
    });
    
    // Create investor profiles for agents and investors
    if (userData.role === 'AGENT' || userData.role === 'INVESTOR') {
      await prisma.investor.create({
        data: {
          userId: user.id,
          availableBalance: faker.number.float({ min: 10000, max: 100000, fractionDigits: 2 }),
          totalInvested: faker.number.float({ min: 0, max: 50000, fractionDigits: 2 })
        }
      });
    }
  }
  
  console.log(`✅ Created ${createdUsers.length} demo users`);
  return createdUsers;
}

async function createDemoInvoices(users: DemoUser[]): Promise<DemoInvoice[]> {
  console.log('📄 Creating demo invoices...');
  
  const suppliers = users.filter(u => u.role === 'SUPPLIER');
  const buyers = users.filter(u => u.role === 'BUYER');
  const agents = users.filter(u => u.role === 'AGENT');
  
  const invoiceStatuses = ['ISSUED', 'FUNDED', 'PAID'];
  const currencies = ['USD', 'HBAR'];
  
  const invoices: DemoInvoice[] = [];
  
  // Create 15 demo invoices
  for (let i = 1; i <= 15; i++) {
    const supplier = faker.helpers.arrayElement(suppliers);
    const buyer = faker.helpers.arrayElement(buyers);
    const agent = Math.random() > 0.3 ? faker.helpers.arrayElement(agents) : undefined;
    const status = faker.helpers.arrayElement(invoiceStatuses);
    const currency = faker.helpers.arrayElement(currencies);
    
    const amount = faker.number.float({ min: 1000, max: 50000, fractionDigits: 2 });
    const dueDate = faker.date.future({ years: 1 });
    
    const invoiceData: Omit<DemoInvoice, 'id'> = {
      invoiceNumber: `INV-${String(i).padStart(3, '0')}-${faker.string.alphanumeric(4).toUpperCase()}`,
      supplierId: supplier.id,
      buyerId: buyer.id,
      agentId: agent?.id,
      amount,
      currency,
      dueDate,
      status,
      description: `${faker.commerce.productName()} - ${faker.commerce.productDescription()}`,
      nftTokenId: status !== 'ISSUED' ? `0.0.${faker.number.int({ min: 100000, max: 999999 })}` : undefined,
      nftSerialNumber: status !== 'ISSUED' ? String(faker.number.int({ min: 1, max: 1000 })) : undefined,
      fileId: status !== 'ISSUED' ? `0.0.${faker.number.int({ min: 100000, max: 999999 })}` : undefined,
      fileHash: status !== 'ISSUED' ? faker.string.hexadecimal({ length: 64, prefix: '' }) : undefined,
      topicId: `0.0.${faker.number.int({ min: 6000000, max: 7000000 })}`
    };
    
    const invoice = await prisma.invoice.create({
      data: invoiceData
    });
    
    invoices.push({
      ...invoiceData,
      id: invoice.id
    });
    
    // Create invoice events
    await createInvoiceEvents(invoice.id, status);
  }
  
  console.log(`✅ Created ${invoices.length} demo invoices`);
  return invoices;
}

async function createInvoiceEvents(invoiceId: string, status: string) {
  // Always create CREATED event
  await prisma.invoiceEvent.create({
    data: {
      invoiceId,
      eventType: 'CREATED',
      description: 'Invoice created in the system',
      metadata: JSON.stringify({
        source: 'demo_seeder',
        timestamp: new Date().toISOString()
      }),
      createdAt: faker.date.recent({ days: 30 })
    }
  });
  
  if (status === 'FUNDED' || status === 'PAID') {
    // Create NFT_MINTED event
    await prisma.invoiceEvent.create({
      data: {
        invoiceId,
        eventType: 'NFT_MINTED',
        description: 'Invoice NFT minted on Hedera',
        metadata: JSON.stringify({
          tokenId: `0.0.${faker.number.int({ min: 100000, max: 999999 })}`,
          serialNumber: faker.number.int({ min: 1, max: 1000 }),
          transactionId: `0.0.${faker.number.int({ min: 1000, max: 9999 })}@${faker.date.recent().getTime()}`
        }),
        hcsMessageId: String(faker.number.int({ min: 1, max: 1000000 })),
        hcsTimestamp: faker.date.recent({ days: 25 }),
        transactionId: `0.0.${faker.number.int({ min: 1000, max: 9999 })}@${faker.date.recent().getTime()}`,
        createdAt: faker.date.recent({ days: 25 })
      }
    });
    
    // Create FILE_UPLOADED event
    await prisma.invoiceEvent.create({
      data: {
        invoiceId,
        eventType: 'FILE_UPLOADED',
        description: 'Invoice document uploaded to Hedera File Service',
        metadata: JSON.stringify({
          fileId: `0.0.${faker.number.int({ min: 100000, max: 999999 })}`,
          fileHash: faker.string.hexadecimal({ length: 64, prefix: '' }),
          fileSize: faker.number.int({ min: 1024, max: 1048576 })
        }),
        hcsMessageId: String(faker.number.int({ min: 1, max: 1000000 })),
        hcsTimestamp: faker.date.recent({ days: 20 }),
        transactionId: `0.0.${faker.number.int({ min: 1000, max: 9999 })}@${faker.date.recent().getTime()}`,
        createdAt: faker.date.recent({ days: 20 })
      }
    });
    
    // Create FUNDED event
    await prisma.invoiceEvent.create({
      data: {
        invoiceId,
        eventType: 'FUNDED',
        description: 'Invoice funded by investor',
        metadata: JSON.stringify({
          fundingAmount: faker.number.float({ min: 500, max: 10000, fractionDigits: 2 }),
          escrowId: `escrow-${faker.string.alphanumeric(10)}`,
          investorAccountId: `0.0.${faker.number.int({ min: 3000, max: 4000 })}`
        }),
        hcsMessageId: String(faker.number.int({ min: 1, max: 1000000 })),
        hcsTimestamp: faker.date.recent({ days: 15 }),
        transactionId: `0.0.${faker.number.int({ min: 1000, max: 9999 })}@${faker.date.recent().getTime()}`,
        createdAt: faker.date.recent({ days: 15 })
      }
    });
  }
  
  if (status === 'PAID') {
    // Create PAYMENT_RECEIVED event
    await prisma.invoiceEvent.create({
      data: {
        invoiceId,
        eventType: 'PAYMENT_RECEIVED',
        description: 'Payment received from buyer',
        metadata: JSON.stringify({
          paymentAmount: faker.number.float({ min: 1000, max: 50000, fractionDigits: 2 }),
          paymentMethod: 'HBAR_TRANSFER',
          buyerAccountId: `0.0.${faker.number.int({ min: 2000, max: 3000 })}`
        }),
        hcsMessageId: String(faker.number.int({ min: 1, max: 1000000 })),
        hcsTimestamp: faker.date.recent({ days: 5 }),
        transactionId: `0.0.${faker.number.int({ min: 1000, max: 9999 })}@${faker.date.recent().getTime()}`,
        createdAt: faker.date.recent({ days: 5 })
      }
    });
  }
}

async function createDemoFundings(invoices: DemoInvoice[], users: DemoUser[]) {
  console.log('💰 Creating demo fundings...');
  
  const investors = users.filter(u => u.role === 'AGENT' || u.role === 'INVESTOR');
  const fundedInvoices = invoices.filter(inv => inv.status === 'FUNDED' || inv.status === 'PAID');
  
  let fundingCount = 0;
  
  for (const invoice of fundedInvoices) {
    // Create 1-3 fundings per funded invoice
    const numFundings = faker.number.int({ min: 1, max: 3 });
    
    for (let i = 0; i < numFundings; i++) {
      const investor = faker.helpers.arrayElement(investors);
      const fundingAmount = faker.number.float({ 
        min: invoice.amount * 0.1, 
        max: invoice.amount * 0.8, 
        fractionDigits: 2 
      });
      
      await prisma.funding.create({
        data: {
          invoiceId: invoice.id,
          investorId: investor.id,
          amount: fundingAmount,
          interestRate: faker.number.float({ min: 0.03, max: 0.12, fractionDigits: 4 }),
          status: invoice.status === 'PAID' ? 'SETTLED' : 'ACTIVE',
          escrowId: `escrow-${faker.string.alphanumeric(12)}`,
          transactionHash: `0x${faker.string.hexadecimal({ length: 64, prefix: '' })}`,
          releaseTransactionHash: invoice.status === 'PAID' ? `0x${faker.string.hexadecimal({ length: 64, prefix: '' })}` : null,
          fundedAt: faker.date.recent({ days: 20 }),
          releasedAt: invoice.status === 'PAID' ? faker.date.recent({ days: 5 }) : null,
          settledAt: invoice.status === 'PAID' ? faker.date.recent({ days: 3 }) : null,
          createdAt: faker.date.recent({ days: 25 })
        }
      });
      
      fundingCount++;
    }
  }
  
  console.log(`✅ Created ${fundingCount} demo fundings`);
}

async function generateDemoReport() {
  console.log('\n📊 Demo Data Summary:');
  
  const userCount = await prisma.user.count();
  const invoiceCount = await prisma.invoice.count();
  const fundingCount = await prisma.funding.count();
  const eventCount = await prisma.invoiceEvent.count();
  const investorCount = await prisma.investor.count();
  
  console.log(`👥 Users: ${userCount}`);
  console.log(`📄 Invoices: ${invoiceCount}`);
  console.log(`💰 Fundings: ${fundingCount}`);
  console.log(`📝 Events: ${eventCount}`);
  console.log(`🏦 Investors: ${investorCount}`);
  
  // Status breakdown
  const statusBreakdown = await prisma.invoice.groupBy({
    by: ['status'],
    _count: { status: true }
  });
  
  console.log('\n📈 Invoice Status Breakdown:');
  statusBreakdown.forEach(item => {
    console.log(`  ${item.status}: ${item._count.status}`);
  });
  
  // Total funding amounts
  const totalFunding = await prisma.funding.aggregate({
    _sum: { amount: true },
    _avg: { amount: true }
  });
  
  console.log(`\n💵 Total Funding: $${totalFunding._sum.amount?.toFixed(2) || '0.00'}`);
  console.log(`📊 Average Funding: $${totalFunding._avg.amount?.toFixed(2) || '0.00'}`);
}



async function main() {
  try {
    console.log('🚀 Starting YieldHarvest Demo Data Seeding...\n');
    
    await clearExistingData();
    const users = await createDemoUsers();
    const invoices = await createDemoInvoices(users);
    await createDemoFundings(invoices, users);
    await generateDemoReport();
    
    console.log('\n✅ Demo data seeding completed successfully!');
    console.log('🎯 Ready for hackathon demonstration!');
    
  } catch (error) {
    console.error('❌ Error seeding demo data:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeder
if (require.main === module) {
  main();
}

export { main as seedDemoData };