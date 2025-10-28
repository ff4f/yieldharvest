import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Client, AccountId, PublicKey, Ed25519PublicKey } from '@hashgraph/sdk';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface AuthUser {
  accountId: string;
  roles: string[];
  publicKey?: string;
}

export interface NonceResponse {
  nonce: string;
  expiresAt: Date;
}

export interface VerifySignatureRequest {
  accountId: string;
  signature: string;
}

export interface AuthTokenResponse {
  token: string;
  user: AuthUser;
  expiresIn: number;
}

export class AuthService {
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN = '24h';
  private readonly NONCE_TTL_MINUTES = 5;

  constructor() {
    this.JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
    if (!this.JWT_SECRET || this.JWT_SECRET === 'your-super-secret-jwt-key') {
      logger.warn('JWT_SECRET not set or using default value. This is insecure for production!');
    }
  }

  /**
   * Generate a random nonce for authentication challenge
   */
  async generateNonce(accountId: string): Promise<NonceResponse> {
    try {
      // Clean up expired nonces for this account
      await this.cleanupExpiredNonces(accountId);

      // Generate random nonce
      const nonce = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + this.NONCE_TTL_MINUTES * 60 * 1000);

      // Store nonce in database
      await prisma.nonce.create({
        data: {
          accountId,
          nonce,
          expiresAt,
        },
      });

      logger.info(`Generated nonce for account ${accountId}`);
      return { nonce, expiresAt };
    } catch (error) {
      logger.error('Error generating nonce:', error);
      throw new Error('Failed to generate authentication nonce');
    }
  }

  /**
   * Verify signature and issue JWT token
   */
  async verifySignatureAndIssueToken(request: VerifySignatureRequest): Promise<AuthTokenResponse> {
    try {
      const { accountId, signature } = request;

      // Find valid nonce
      const nonceRecord = await prisma.nonce.findFirst({
        where: {
          accountId,
          used: false,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!nonceRecord) {
        throw new Error('Invalid or expired nonce');
      }

      // Get or create user
      let user = await prisma.user.findUnique({
        where: { accountId },
      });

      if (!user) {
        // Create new user with default SUPPLIER role
        user = await prisma.user.create({
          data: {
            accountId,
            roles: JSON.stringify(['SUPPLIER']),
            isActive: true,
          },
        });
        logger.info(`Created new user for account ${accountId}`);
      }

      // Verify signature
      const isValidSignature = await this.verifyHederaSignature(
        accountId,
        nonceRecord.nonce,
        signature,
        user.publicKey
      );

      if (!isValidSignature) {
        throw new Error('Invalid signature');
      }

      // Mark nonce as used
      await prisma.nonce.update({
        where: { id: nonceRecord.id },
        data: { used: true },
      });

      // Update last login
      await prisma.user.update({
        where: { accountId },
        data: { lastLoginAt: new Date() },
      });

      // Parse roles
      const roles = JSON.parse(user.roles) as string[];

      // Generate JWT
      const authUser: AuthUser = {
        accountId: user.accountId,
        roles,
        publicKey: user.publicKey || undefined,
      };

      const token = jwt.sign(authUser, this.JWT_SECRET, {
        expiresIn: this.JWT_EXPIRES_IN,
      });

      logger.info(`Successfully authenticated user ${accountId} with roles: ${roles.join(', ')}`);

      return {
        token,
        user: authUser,
        expiresIn: 24 * 60 * 60, // 24 hours in seconds
      };
    } catch (error) {
      logger.error('Error verifying signature:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): AuthUser {
    try {
      const decoded = jwt.verify(token, this.JWT_SECRET) as AuthUser;
      return decoded;
    } catch (error) {
      logger.error('Error verifying JWT token:', error);
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Verify Hedera signature using Mirror Node API
   */
  private async verifyHederaSignature(
    accountId: string,
    message: string,
    signature: string,
    cachedPublicKey?: string | null
  ): Promise<boolean> {
    try {
      let publicKey: PublicKey;

      // Use cached public key if available
      if (cachedPublicKey) {
        publicKey = PublicKey.fromString(cachedPublicKey);
      } else {
        // Fetch public key from Mirror Node
        publicKey = await this.fetchPublicKeyFromMirrorNode(accountId);
        
        // Cache the public key
        await prisma.user.update({
          where: { accountId },
          data: { publicKey: publicKey.toString() },
        });
      }

      // Convert signature from hex to bytes
      const signatureBytes = Buffer.from(signature, 'hex');
      const messageBytes = Buffer.from(message, 'utf8');

      // Verify signature
      const isValid = publicKey.verify(messageBytes, signatureBytes);
      
      logger.info(`Signature verification for ${accountId}: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
    } catch (error) {
      logger.error('Error verifying Hedera signature:', error);
      return false;
    }
  }

  /**
   * Fetch public key from Hedera Mirror Node
   */
  private async fetchPublicKeyFromMirrorNode(accountId: string): Promise<PublicKey> {
    try {
      const mirrorNodeUrl = process.env.HEDERA_MIRROR_NODE_URL || 'https://testnet.mirrornode.hedera.com';
      const response = await fetch(`${mirrorNodeUrl}/api/v1/accounts/${accountId}`);
      
      if (!response.ok) {
        throw new Error(`Mirror Node API error: ${response.status}`);
      }

      const accountData = await response.json();
      
      if (!accountData.key || !accountData.key.key) {
        throw new Error('Public key not found in Mirror Node response');
      }

      // Parse the public key (assuming ED25519)
      const publicKeyHex = accountData.key.key;
      return Ed25519PublicKey.fromString(publicKeyHex);
    } catch (error) {
      logger.error('Error fetching public key from Mirror Node:', error);
      throw new Error('Failed to fetch public key from Mirror Node');
    }
  }

  /**
   * Clean up expired nonces
   */
  private async cleanupExpiredNonces(accountId?: string): Promise<void> {
    try {
      const where = accountId 
        ? { accountId, expiresAt: { lt: new Date() } }
        : { expiresAt: { lt: new Date() } };

      await prisma.nonce.deleteMany({ where });
    } catch (error) {
      logger.error('Error cleaning up expired nonces:', error);
    }
  }

  /**
   * Update user roles (admin only)
   */
  async updateUserRoles(accountId: string, roles: string[]): Promise<void> {
    try {
      await prisma.user.update({
        where: { accountId },
        data: { roles: JSON.stringify(roles) },
      });
      
      logger.info(`Updated roles for user ${accountId}: ${roles.join(', ')}`);
    } catch (error) {
      logger.error('Error updating user roles:', error);
      throw new Error('Failed to update user roles');
    }
  }

  /**
   * Get user by account ID
   */
  async getUserByAccountId(accountId: string): Promise<AuthUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { accountId },
      });

      if (!user) {
        return null;
      }

      return {
        accountId: user.accountId,
        roles: JSON.parse(user.roles) as string[],
        publicKey: user.publicKey || undefined,
      };
    } catch (error) {
      logger.error('Error fetching user:', error);
      return null;
    }
  }
}

export const authService = new AuthService();