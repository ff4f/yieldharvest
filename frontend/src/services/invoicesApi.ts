import { apiClient, invoiceApi } from './api';
import { CreateInvoiceRequest } from '@/types/api';

/**
 * Invoice API service for interacting with invoice endpoints
 */
export class InvoicesApi {
  /**
   * Create a new invoice
   * @param invoiceData - Invoice data
   * @returns Promise<Object> Created invoice
   */
  static async createInvoice(invoiceData: CreateInvoiceRequest) {
    try {
      return await invoiceApi.create(invoiceData);
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }

  /**
   * Get invoice by ID
   * @param invoiceId - Invoice ID
   * @returns Promise<Object> Invoice data
   */
  static async getInvoice(invoiceId: string) {
    try {
      return await invoiceApi.getById(invoiceId);
    } catch (error) {
      console.error('Error fetching invoice:', error);
      throw error;
    }
  }

  /**
   * Get all invoices
   * @returns Promise<Array> List of invoices
   */
  static async getInvoices() {
    try {
      return await invoiceApi.getAll();
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }
  }

  /**
   * Update invoice status
   * @param invoiceId - Invoice ID
   * @param status - New status
   * @returns Promise<Object> Updated invoice
   */
  static async updateInvoiceStatus(invoiceId: string, status: 'ISSUED' | 'FUNDED' | 'PAID' | 'OVERDUE' | 'CANCELLED') {
    try {
      return await invoiceApi.update(invoiceId, { status });
    } catch (error) {
      console.error('Error updating invoice status:', error);
      throw error;
    }
  }

  /**
   * Upload invoice document
   * @param invoiceId - Invoice ID
   * @param file - File to upload
   * @returns Promise<Object> Upload result
   */
  static async uploadDocument(invoiceId: string, file: File) {
    try {
      // This would need to be implemented in the main API client
      // For now, return a placeholder
      console.warn('Document upload not yet implemented in API client');
      return { success: true, fileId: 'placeholder' };
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Get invoice NFT metadata
   * @param tokenId - NFT token ID
   * @param serial - NFT serial number
   * @returns Promise<Object> NFT metadata
   */
  static async getNFTMetadata(tokenId: string, serial: number) {
    try {
      return await apiClient.getNFTInfo(tokenId, serial.toString());
    } catch (error) {
      console.error('Error fetching NFT metadata:', error);
      throw error;
    }
  }
}

export default InvoicesApi;