import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { mirrorNodeService } from '../services/mirrorNodeService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export async function settlementsRoutes(fastify: FastifyInstance) {

  // GET /snapshot - Settlement dashboard snapshot
  fastify.get('/snapshot', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get real settlement data from database
      const [
        totalFundings,
        completedFundings,
        activeFundings,
        failedFundings,
        totalInvoices,
        paidInvoices,
        fundedInvoices,
        recentFundings
      ] = await Promise.all([
        prisma.funding.count(),
        prisma.funding.count({ where: { status: 'RELEASED' } }),
        prisma.funding.count({ where: { status: 'ACTIVE' } }),
        prisma.funding.count({ where: { status: 'REFUNDED' } }),
        prisma.invoice.count(),
        prisma.invoice.count({ where: { status: 'PAID' } }),
        prisma.invoice.count({ where: { status: 'FUNDED' } }),
        prisma.funding.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            invoice: {
              select: { invoiceNumber: true, amount: true }
            }
          }
        })
      ]);

      // Calculate aggregated amounts
      const totalValueResult = await prisma.funding.aggregate({
        _sum: { amount: true }
      });
      const totalValue = totalValueResult._sum.amount || 0;

      const completedValueResult = await prisma.funding.aggregate({
        where: { status: 'RELEASED' },
        _sum: { amount: true }
      });
      const completedValue = completedValueResult._sum.amount || 0;

      // Calculate success rate
      const settlementSuccessRate = totalFundings > 0 ? 
        Math.round((completedFundings / totalFundings) * 100 * 10) / 10 : 0;

      // Calculate percentages
      const fundedPercentage = totalInvoices > 0 ? 
        Math.round((fundedInvoices / totalInvoices) * 100 * 10) / 10 : 0;
      const paidPercentage = totalInvoices > 0 ? 
        Math.round((paidInvoices / totalInvoices) * 100 * 10) / 10 : 0;

      // Calculate distribution breakdown (80% investors, 16% operators, 4% platform)
      const distributionBreakdown = {
        investors: { 
          amount: Math.round(completedValue * 0.80 * 100) / 100, 
          percentage: 80.0, 
          count: await prisma.user.count({ where: { roles: { contains: 'INVESTOR' } } })
        },
        operators: { 
          amount: Math.round(completedValue * 0.16 * 100) / 100, 
          percentage: 16.0, 
          count: await prisma.user.count({ where: { roles: { contains: 'AGENT' } } })
        },
        platform: { 
          amount: Math.round(completedValue * 0.04 * 100) / 100, 
          percentage: 4.0, 
          count: 1 
        }
      };

      // Format recent activity
      const recentActivity = recentFundings.map(funding => ({
        id: funding.id,
        type: funding.status === 'RELEASED' ? 'PAYMENT_RELEASED' : 
              funding.status === 'ACTIVE' ? 'FUNDING_RECEIVED' : 'FUNDING_REFUNDED',
        amount: funding.amount,
        status: funding.status === 'RELEASED' ? 'COMPLETED' : 
                funding.status === 'ACTIVE' ? 'PENDING' : 'FAILED',
        timestamp: funding.createdAt.toISOString(),
        description: `${funding.status === 'RELEASED' ? 'Payment released' : 'Funding received'} for Invoice #${funding.invoice.invoiceNumber}`
      }));

      const snapshot = {
        totalSettlements: totalFundings,
        totalValue: Math.round(totalValue * 100) / 100,
        pendingSettlements: activeFundings,
        completedSettlements: completedFundings,
        failedSettlements: failedFundings,
        settlementSuccessRate,
        averageDaysToPayment: 12.5, // TODO: Calculate from actual data
        totalSettlementVolume: Math.round(totalValue * 100) / 100,
        fundedPercentage,
        paidPercentage,
        distributionBreakdown,
        recentActivity
      };

      reply.send(snapshot);
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get settlement snapshot');
      reply.code(500).send({ error: 'Failed to get settlement snapshot' });
    }
  });

  // GET / - List settlements with pagination
  fastify.get('/', async (request: FastifyRequest<{ Querystring: { page?: string; limit?: string; status?: string; startDate?: string; endDate?: string } }>, reply: FastifyReply) => {
    try {
      const { page = '1', limit = '10', status, startDate, endDate } = request.query;
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Build where clause for filtering
      const where: any = {};
      if (status) {
        where.status = status;
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      // Get settlements with real data from database
      const [settlements, totalCount] = await Promise.all([
        prisma.funding.findMany({
          where,
          skip,
          take: limitNum,
          orderBy: { createdAt: 'desc' },
          include: {
            invoice: {
              select: { 
                id: true,
                invoiceNumber: true, 
                amount: true,
                nftTokenId: true,
                nftSerialNumber: true,
                fileId: true,
                topicId: true
              }
            },
            investor: {
              select: { accountId: true }
            }
          }
        }),
        prisma.funding.count({ where })
      ]);

      // Format settlements with Hedera proof links
      const formattedSettlements = settlements.map(funding => {
        const hashScanUrl = funding.transactionHash ? 
          `https://hashscan.io/testnet/transaction/${funding.transactionHash}` : null;
        const mirrorNodeUrl = funding.transactionHash ? 
          `https://testnet.mirrornode.hedera.com/api/v1/transactions/${funding.transactionHash}` : null;

        return {
          id: funding.id,
          invoiceId: funding.invoice.id,
          amount: funding.amount,
          status: funding.status,
          createdAt: funding.createdAt.toISOString(),
          completedAt: funding.releasedAt?.toISOString() || null,
          transactionId: funding.transactionHash,
          hashScanUrl,
          mirrorNodeUrl,
          distribution: {
            investor: { amount: Math.round(funding.amount * 0.80 * 100) / 100, percentage: 80.0 },
            operator: { amount: Math.round(funding.amount * 0.16 * 100) / 100, percentage: 16.0 },
            platform: { amount: Math.round(funding.amount * 0.04 * 100) / 100, percentage: 4.0 }
          },
          proofs: {
            nftTokenId: funding.invoice.nftTokenId,
            nftSerial: funding.invoice.nftSerialNumber,
            hfsFileId: funding.invoice.fileId,
            hcsTopicId: funding.invoice.topicId,
            hcsSequenceNumber: null // TODO: Get from HCS messages
          }
        };
      });

      reply.send({
        settlements: formattedSettlements,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        }
      });
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error) }, 'Failed to get settlements list');
      reply.code(500).send({ error: 'Failed to get settlements list' });
    }
  });

  // GET /invoices/:id/proofs - Get invoice settlement proofs
  fastify.get('/invoices/:id/proofs', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const { id } = request.params;
      
      // Get invoice with Hedera proof data
      const invoice = await prisma.invoice.findUnique({
        where: { id },
        include: {
          events: {
            orderBy: { createdAt: 'desc' }
          },
          fundings: {
            include: {
              investor: {
                select: { accountId: true }
              }
            }
          }
        }
      });

      if (!invoice) {
        return reply.code(404).send({ error: 'Invoice not found' });
      }

      const proofs = [];

      // HTS NFT Proof
      if (invoice.nftTokenId && invoice.nftSerialNumber) {
        proofs.push({
          id: `proof_hts_${invoice.id}`,
          type: 'HTS',
          status: 'confirmed',
          timestamp: invoice.createdAt.toISOString(),
          amount: invoice.amount.toString(),
          description: 'Invoice NFT minted on Hedera Token Service',
          hashScanUrl: `https://hashscan.io/testnet/token/${invoice.nftTokenId}/${invoice.nftSerialNumber}`,
          mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/tokens/${invoice.nftTokenId}/nfts/${invoice.nftSerialNumber}`,
          details: {
            tokenId: invoice.nftTokenId,
            serial: invoice.nftSerialNumber
          }
        });
      }

      // HFS File Proof
      if (invoice.fileId) {
        proofs.push({
          id: `proof_hfs_${invoice.id}`,
          type: 'HFS',
          status: 'confirmed',
          timestamp: invoice.createdAt.toISOString(),
          description: 'Invoice document stored on Hedera File Service',
          hashScanUrl: `https://hashscan.io/testnet/file/${invoice.fileId}`,
          mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/files/${invoice.fileId}`,
          details: {
            fileId: invoice.fileId,
            fileHash: invoice.fileHash
          }
        });
      }

      // HCS Topic Proof
      if (invoice.topicId) {
        proofs.push({
          id: `proof_hcs_${invoice.id}`,
          type: 'HCS',
          status: 'confirmed',
          timestamp: invoice.createdAt.toISOString(),
          description: 'Invoice status updates recorded on Hedera Consensus Service',
          hashScanUrl: `https://hashscan.io/testnet/topic/${invoice.topicId}`,
          mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/topics/${invoice.topicId}/messages`,
          details: {
            topicId: invoice.topicId,
            messageCount: invoice.events.length
          }
        });
      }

      // Smart Contract Escrow Proofs
      for (const funding of invoice.fundings) {
        if (funding.transactionHash) {
          proofs.push({
            id: `proof_escrow_${funding.id}`,
            type: 'ESCROW',
            status: funding.status === 'RELEASED' ? 'confirmed' : 'pending',
            timestamp: funding.createdAt.toISOString(),
            amount: funding.amount.toString(),
            description: `Escrow ${funding.status.toLowerCase()} for funding`,
            hashScanUrl: `https://hashscan.io/testnet/transaction/${funding.transactionHash}`,
            mirrorNodeUrl: `https://testnet.mirrornode.hedera.com/api/v1/transactions/${funding.transactionHash}`,
            details: {
              escrowId: funding.escrowId,
              investorAccount: funding.investor.accountId,
              status: funding.status
            }
          });
        }
      }

      reply.send({
        invoiceId: id,
        proofs
      });
    } catch (error) {
      logger.error({ error: error instanceof Error ? error.message : String(error), invoiceId: request.params.id }, 'Failed to get invoice proofs');
      reply.code(500).send({ error: 'Failed to get invoice proofs' });
    }
  });
}