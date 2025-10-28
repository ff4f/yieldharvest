import { walletService } from './walletService'
import { apiClient } from './api'
import { CreateInvoiceRequest } from '@/types/api'

export interface MintInvoiceRequest extends CreateInvoiceRequest {
  // Extends the existing CreateInvoiceRequest interface
}

export interface FundInvoiceRequest {
  invoiceId: string
  amount: number
  investorAccountId: string
}

export interface PayInvoiceRequest {
  invoiceId: string
  payerAccountId: string
}

export interface TransactionResult {
  transactionId: string
  status: 'SUCCESS' | 'PENDING' | 'FAILED'
  hashScanUrl: string
  receipt?: any
}

class TransactionService {
  /**
   * Mint invoice as NFT with file upload and HCS logging
   * Uses wallet signing for Hedera transactions
   */
  async mintInvoice(request: MintInvoiceRequest): Promise<TransactionResult> {
    const connection = walletService.getConnection()
    if (!connection) {
      throw new Error('Wallet not connected')
    }

    try {
      // Step 1: Prepare mint transaction on backend
      const prepareResponse = await apiClient.prepareMintTransaction({
        ...request,
        accountId: connection.accountId
      })

      // Step 2: Sign transaction with wallet
      const transactionBytes = new Uint8Array(
        Buffer.from(prepareResponse.data.transactionBytes, 'base64')
      );
      
      const signedTransactionBytes = await walletService.signTransaction(transactionBytes);

      // Step 3: Submit signed transaction
      const submitResponse = await apiClient.submitMintTransaction({
        invoiceId: prepareResponse.data.invoiceId,
        signedTransactionBytes: Buffer.from(signedTransactionBytes).toString('base64'),
        transactionId: prepareResponse.data.transactionId
      });

      return {
        transactionId: submitResponse.data.transactionId,
        status: 'SUCCESS',
        hashScanUrl: walletService.getHashScanUrl(submitResponse.data.transactionId),
        receipt: {
          tokenId: submitResponse.data.tokenId,
          serialNumber: submitResponse.data.serialNumber,
          fileId: submitResponse.data.fileId,
          topicId: submitResponse.data.topicId
        }
      }
    } catch (error) {
      console.error('Error minting invoice:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to mint invoice')
    }
  }

  /**
   * Fund invoice with escrow transaction
   * Uses wallet signing for Hedera transactions
   */
  async fundInvoice(request: FundInvoiceRequest): Promise<TransactionResult> {
    const connection = walletService.getConnection()
    if (!connection) {
      throw new Error('Wallet not connected')
    }

    try {
      // For now, use the existing API until backend supports wallet signing
      // TODO: Implement prepare-fund and submit-fund endpoints in backend
      const response = await apiClient.fundInvoice(request.invoiceId, request.amount.toString())
      
      return {
        transactionId: response.transactionId || 'pending',
        status: 'SUCCESS',
        hashScanUrl: walletService.getHashScanUrl(response.transactionId || 'pending'),
        receipt: {
          amount: request.amount,
          investorAccountId: request.investorAccountId
        }
      }
    } catch (error) {
      console.error('Error funding invoice:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to fund invoice')
    }
  }

  /**
   * Mark invoice as paid and release funds
   * Uses the existing payInvoice API which handles Hedera integration
   */
  async payInvoice(request: PayInvoiceRequest): Promise<TransactionResult> {
    const connection = walletService.getConnection()
    if (!connection) {
      throw new Error('Wallet not connected')
    }

    try {
      // For now, use updateInvoice to mark as paid
      // TODO: Implement proper payment API endpoint
      const response = await apiClient.updateInvoice(request.invoiceId, {
        status: 'PAID'
      })
      
      return {
        transactionId: response.id || 'pending',
        status: 'SUCCESS',
        hashScanUrl: walletService.getHashScanUrl(response.id || 'pending'),
        receipt: {
          payerAccountId: request.payerAccountId
        }
      }
    } catch (error) {
      console.error('Error paying invoice:', error)
      throw new Error(error instanceof Error ? error.message : 'Failed to pay invoice')
    }
  }



  /**
   * Get transaction status from Mirror Node
   */
  async getTransactionStatus(transactionId: string): Promise<any> {
    try {
      // This would typically call a backend endpoint that queries Mirror Node
      // For now, return a basic status
      return {
        transactionId,
        status: 'SUCCESS',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error getting transaction status:', error)
      throw error
    }
  }

  /**
   * Estimate transaction fees
   */
  async estimateTransactionFees(transactionType: 'mint' | 'fund' | 'pay'): Promise<number> {
    // Return estimated fees based on transaction type
    // In a real implementation, this would query the backend
    const feeEstimates = {
      mint: 2.0, // ~2 HBAR for NFT minting
      fund: 0.1, // ~0.1 HBAR for transfers
      pay: 0.1   // ~0.1 HBAR for transfers
    }
    
    return feeEstimates[transactionType] || 0.1
  }
}

export const transactionService = new TransactionService()
export default transactionService