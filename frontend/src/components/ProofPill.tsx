// ProofPill component for displaying Hedera proof links

import React from 'react';
import { ExternalLink, FileText, MessageSquare, Coins, Shield, ArrowUpRight, ArrowDownLeft, Code } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ProofPillProps {
  tokenId?: string;
  serialNumber?: number;
  fileId?: string;
  topicId?: string;
  topicSequenceNumber?: number;
  mintTransactionId?: string;
  // Smart contract escrow proofs
  escrowTransactionHash?: string;
  releaseTransactionHash?: string;
  refundTransactionHash?: string;
  contractId?: string;
  className?: string;
  variant?: 'default' | 'compact';
}

const HASHSCAN_BASE_URL = import.meta.env.VITE_HASHSCAN_BASE_URL || 'https://hashscan.io/testnet';

export function ProofPill({
  tokenId,
  serialNumber,
  fileId,
  topicId,
  topicSequenceNumber,
  mintTransactionId,
  escrowTransactionHash,
  releaseTransactionHash,
  refundTransactionHash,
  contractId,
  className = '',
  variant = 'default',
}: ProofPillProps) {
  const proofs = [
    {
      type: 'NFT Mint',
      icon: Coins,
      url: tokenId && serialNumber 
        ? `${HASHSCAN_BASE_URL}/token/${tokenId}?nftSerial=${serialNumber}`
        : mintTransactionId
        ? `${HASHSCAN_BASE_URL}/transaction/${mintTransactionId}`
        : null,
      available: !!(tokenId || mintTransactionId),
      tooltip: 'View NFT on HashScan',
    },
    {
      type: 'File Storage',
      icon: FileText,
      url: fileId ? `${HASHSCAN_BASE_URL}/file/${fileId}` : null,
      available: !!fileId,
      tooltip: 'View file on Hedera File Service',
    },
    {
      type: 'Consensus',
      icon: MessageSquare,
      url: topicId && topicSequenceNumber
        ? `${HASHSCAN_BASE_URL}/topic/${topicId}?sequenceNumber=${topicSequenceNumber}`
        : topicId
        ? `${HASHSCAN_BASE_URL}/topic/${topicId}`
        : null,
      available: !!topicId,
      tooltip: 'View consensus message on HCS',
    },
    {
      type: 'Escrow Fund',
      icon: Shield,
      url: escrowTransactionHash ? `${HASHSCAN_BASE_URL}/transaction/${escrowTransactionHash}` : null,
      available: !!escrowTransactionHash,
      tooltip: 'View escrow funding transaction',
    },
    {
      type: 'Escrow Release',
      icon: ArrowUpRight,
      url: releaseTransactionHash ? `${HASHSCAN_BASE_URL}/transaction/${releaseTransactionHash}` : null,
      available: !!releaseTransactionHash,
      tooltip: 'View escrow release transaction',
    },
    {
      type: 'Escrow Refund',
      icon: ArrowDownLeft,
      url: refundTransactionHash ? `${HASHSCAN_BASE_URL}/transaction/${refundTransactionHash}` : null,
      available: !!refundTransactionHash,
      tooltip: 'View escrow refund transaction',
    },
    {
      type: 'Smart Contract',
      icon: Code,
      url: contractId ? `${HASHSCAN_BASE_URL}/contract/${contractId}` : null,
      available: !!contractId,
      tooltip: 'View smart contract on HashScan',
    },
  ];

  const availableProofs = proofs.filter(proof => proof.available);

  if (availableProofs.length === 0) {
    return (
      <Badge variant="secondary" className={className}>
        No proofs available
      </Badge>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`flex gap-1 ${className}`}>
        <TooltipProvider>
          {availableProofs.map((proof, index) => {
            const Icon = proof.icon;
            return (
              <Tooltip key={index}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => proof.url && window.open(proof.url, '_blank')}
                    disabled={!proof.url}
                  >
                    <Icon className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{proof.tooltip}</p>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {availableProofs.map((proof, index) => {
        const Icon = proof.icon;
        return (
          <Button
            key={index}
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => proof.url && window.open(proof.url, '_blank')}
            disabled={!proof.url}
          >
            <Icon className="mr-1 h-3 w-3" />
            {proof.type}
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        );
      })}
    </div>
  );
}

// Convenience component for showing all proofs from an invoice
interface InvoiceProofPillProps {
  invoice: {
    tokenId?: string;
    serialNumber?: number;
    fileId?: string;
    topicId?: string;
    mintTransactionId?: string;
    events?: Array<{
      type: string;
      data: Record<string, any>;
    }>;
  };
  className?: string;
  variant?: 'default' | 'compact';
}

export function InvoiceProofPill({ invoice, className, variant }: InvoiceProofPillProps) {
  // Extract topic sequence number from events if available
  const topicSequenceNumber = invoice.events?.find(
    event => event.type === 'STATUS_CHANGED' && event.data?.topicSequenceNumber
  )?.data?.topicSequenceNumber;

  return (
    <ProofPill
      tokenId={invoice.tokenId}
      serialNumber={invoice.serialNumber}
      fileId={invoice.fileId}
      topicId={invoice.topicId}
      topicSequenceNumber={topicSequenceNumber}
      mintTransactionId={invoice.mintTransactionId}
      className={className}
      variant={variant}
    />
  );
}

// Convenience component for showing funding-specific proofs
interface FundingProofPillProps {
  funding: {
    transactionHash?: string;
    releaseTransactionHash?: string;
    refundTransactionHash?: string;
    escrowId?: string;
  };
  className?: string;
  variant?: 'default' | 'compact';
}

export function FundingProofPill({ funding, className, variant }: FundingProofPillProps) {
  const contractAddress = import.meta.env.VITE_ESCROW_CONTRACT_ADDRESS;
  
  return (
    <ProofPill
      escrowTransactionHash={funding.transactionHash}
      releaseTransactionHash={funding.releaseTransactionHash}
      refundTransactionHash={funding.refundTransactionHash}
      contractId={contractAddress}
      className={className}
      variant={variant}
    />
  );
}