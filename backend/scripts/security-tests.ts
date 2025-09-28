#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { logger } from '../src/utils/logger';
import axios from 'axios';
import crypto from 'crypto';

interface SecurityTestResult {
  timestamp: string;
  passed: boolean;
  vulnerabilities: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    description: string;
    file?: string;
    line?: number;
    recommendation: string;
  }>;
  dependencies: {
    total: number;
    vulnerable: number;
    outdated: number;
    details: Array<{
      package: string;
      version: string;
      vulnerability: string;
      severity: string;
    }>;
  };
  codeAnalysis: {
    secretsFound: number;
    sqlInjectionRisks: number;
    xssRisks: number;
    authenticationIssues: number;
    cryptographyIssues: number;
  };
  networkSecurity: {
    httpsEnforced: boolean;
    corsConfigured: boolean;
    rateLimitingEnabled: boolean;
    securityHeadersPresent: boolean;
  };
  recommendations: string[];
}

interface SecurityPattern {
  name: string;
  pattern: RegExp;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  recommendation: string;
}

class SecurityTester {
  private readonly securityPatterns: SecurityPattern[] = [
    // Secrets and API Keys
    {
      name: 'Hardcoded API Key',
      pattern: new RegExp('(?:api[_-]?key|apikey)\\s*[=:]\\s*[\'"]([a-zA-Z0-9]{20,})[\'"]|(?:api[_-]?key|apikey)\\s*[=:]\\s*([a-zA-Z0-9]{20,})', 'gi'),
      severity: 'critical',
      category: 'Secrets',
      description: 'Hardcoded API key found in source code',
      recommendation: 'Move API keys to environment variables'
    },
    {
      name: 'Hardcoded Private Key',
      pattern: new RegExp('(?:private[_-]?key|privatekey)\\s*[=:]\\s*[\'"]([a-zA-Z0-9+/]{40,})[\'"]|BEGIN\\s+(?:RSA\\s+)?PRIVATE\\s+KEY', 'gi'),
      severity: 'critical',
      category: 'Secrets',
      description: 'Hardcoded private key found in source code',
      recommendation: 'Move private keys to secure environment variables or key management service'
    },
    {
      name: 'Database Password',
      pattern: new RegExp('(?:password|pwd|pass)\\s*[=:]\\s*[\'"]([^\'"\\s]{8,})[\'"]|(?:password|pwd|pass)\\s*[=:]\\s*([^\\s]{8,})', 'gi'),
      severity: 'high',
      category: 'Secrets',
      description: 'Hardcoded database password found',
      recommendation: 'Use environment variables for database credentials'
    },
    
    // SQL Injection
    {
      name: 'SQL Injection Risk',
      pattern: new RegExp('\\$\\{[^}]*\\}|\\+\\s*[\'"]\\s*\\+|query\\s*\\(\\s*[\'"][^\'"]*\\$\\{|execute\\s*\\(\\s*[\'"][^\'"]*\\$\\{', 'gi'),
      severity: 'high',
      category: 'SQL Injection',
      description: 'Potential SQL injection vulnerability',
      recommendation: 'Use parameterized queries or prepared statements'
    },
    
    // XSS
    {
      name: 'XSS Risk',
      pattern: new RegExp('innerHTML\\s*=|document\\.write\\s*\\(|eval\\s*\\(|dangerouslySetInnerHTML', 'gi'),
      severity: 'medium',
      category: 'XSS',
      description: 'Potential XSS vulnerability',
      recommendation: 'Sanitize user input and use safe DOM manipulation methods'
    },
    
    // Authentication
    {
      name: 'Weak JWT Secret',
      pattern: new RegExp('jwt[_-]?secret\\s*[=:]\\s*[\'"]([^\'"]{1,15})[\'"]|jwt[_-]?secret\\s*[=:]\\s*([^\\s]{1,15})', 'gi'),
      severity: 'high',
      category: 'Authentication',
      description: 'Weak JWT secret detected',
      recommendation: 'Use a strong, randomly generated JWT secret (at least 32 characters)'
    },
    
    // Cryptography
    {
      name: 'Weak Hashing Algorithm',
      pattern: new RegExp('md5|sha1|createHash\\s*\\(\\s*[\'"](?:md5|sha1)[\'"]\\)', 'gi'),
      severity: 'medium',
      category: 'Cryptography',
      description: 'Weak hashing algorithm detected',
      recommendation: 'Use SHA-256 or stronger hashing algorithms'
    },
    
    // File System
    {
      name: 'Path Traversal Risk',
      pattern: new RegExp('\\.\\.\\/|\\.\\.\\\\/|path\\.join\\s*\\([^)]*req\\.|fs\\.readFile\\s*\\([^)]*req\\.', 'gi'),
      severity: 'high',
      category: 'File System',
      description: 'Potential path traversal vulnerability',
      recommendation: 'Validate and sanitize file paths, use path.resolve() and check if result is within allowed directory'
    },
    
    // Command Injection
    {
      name: 'Command Injection Risk',
      pattern: new RegExp('exec\\s*\\([^)]*req\\.|spawn\\s*\\([^)]*req\\.|system\\s*\\([^)]*req\\.', 'gi'),
      severity: 'critical',
      category: 'Command Injection',
      description: 'Potential command injection vulnerability',
      recommendation: 'Avoid executing user input as commands, use parameterized execution'
    }
  ];

  private readonly criticalFiles = [
    'src/controllers/',
    'src/middleware/',
    'src/services/',
    'src/routes/',
    'src/utils/auth.ts',
    'src/utils/crypto.ts',
    'src/config/'
  ];

  /**
   * Run comprehensive security tests
   */
  async runSecurityTests(): Promise<SecurityTestResult> {
    logger.info('Starting comprehensive security testing...');

    const result: SecurityTestResult = {
      timestamp: new Date().toISOString(),
      passed: false,
      vulnerabilities: [],
      dependencies: {
        total: 0,
        vulnerable: 0,
        outdated: 0,
        details: []
      },
      codeAnalysis: {
        secretsFound: 0,
        sqlInjectionRisks: 0,
        xssRisks: 0,
        authenticationIssues: 0,
        cryptographyIssues: 0
      },
      networkSecurity: {
        httpsEnforced: false,
        corsConfigured: false,
        rateLimitingEnabled: false,
        securityHeadersPresent: false
      },
      recommendations: []
    };

    try {
      // Step 1: Dependency vulnerability scan
      await this.scanDependencyVulnerabilities(result);

      // Step 2: Static code analysis
      await this.performStaticCodeAnalysis(result);

      // Step 3: Configuration security check
      await this.checkSecurityConfiguration(result);

      // Step 4: Network security analysis
      await this.analyzeNetworkSecurity(result);

      // Step 5: Generate recommendations
      await this.generateSecurityRecommendations(result);

      // Determine overall pass/fail
      result.passed = this.evaluateSecurityStatus(result);

      logger.info('Security testing completed', {
        passed: result.passed,
        vulnerabilityCount: result.vulnerabilities.length,
        criticalVulnerabilities: result.vulnerabilities.filter(v => v.severity === 'critical').length
      });

      return result;
    } catch (error) {
      logger.error('Security testing failed', { error });
      throw error;
    }
  }

  /**
   * Scan for dependency vulnerabilities
   */
  private async scanDependencyVulnerabilities(result: SecurityTestResult): Promise<void> {
    logger.info('Scanning dependency vulnerabilities...');

    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json', { 
        encoding: 'utf8',
        stdio: 'pipe'
      });
      
      const auditData = JSON.parse(auditOutput);
      
      result.dependencies.total = auditData.metadata?.totalDependencies || 0;
      result.dependencies.vulnerable = auditData.metadata?.vulnerabilities?.total || 0;
      
      // Process vulnerabilities
      if (auditData.vulnerabilities) {
        for (const [packageName, vulnData] of Object.entries(auditData.vulnerabilities)) {
          const vulnerability = vulnData as any;
          
          result.dependencies.details.push({
            package: packageName,
            version: vulnerability.via?.[0]?.range || 'unknown',
            vulnerability: vulnerability.via?.[0]?.title || 'Unknown vulnerability',
            severity: vulnerability.severity || 'unknown'
          });
          
          result.vulnerabilities.push({
            severity: this.mapSeverity(vulnerability.severity),
            category: 'Dependencies',
            description: `Vulnerable dependency: ${packageName} - ${vulnerability.via?.[0]?.title}`,
            recommendation: `Update ${packageName} to a secure version`
          });
        }
      }
      
      logger.info('✅ Dependency vulnerability scan completed');
    } catch (error) {
      logger.warn('Dependency vulnerability scan failed', { error });
      result.recommendations.push('Run npm audit manually to check for dependency vulnerabilities');
    }
  }

  /**
   * Perform static code analysis
   */
  private async performStaticCodeAnalysis(result: SecurityTestResult): Promise<void> {
    logger.info('Performing static code analysis...');

    const sourceFiles = this.getSourceFiles();
    
    for (const filePath of sourceFiles) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        for (const pattern of this.securityPatterns) {
          const matches = content.matchAll(pattern.pattern);
          
          for (const match of matches) {
            const lineNumber = this.getLineNumber(content, match.index || 0);
            
            result.vulnerabilities.push({
              severity: pattern.severity,
              category: pattern.category,
              description: pattern.description,
              file: path.relative(process.cwd(), filePath),
              line: lineNumber,
              recommendation: pattern.recommendation
            });
            
            // Update counters
            this.updateCategoryCounters(result.codeAnalysis, pattern.category);
          }
        }
      } catch (error) {
        logger.warn(`Failed to analyze file: ${filePath}`, { error });
      }
    }
    
    logger.info('✅ Static code analysis completed');
  }

  /**
   * Check security configuration
   */
  private async checkSecurityConfiguration(result: SecurityTestResult): Promise<void> {
    logger.info('Checking security configuration...');

    // Check environment variables
    await this.checkEnvironmentSecurity(result);
    
    // Check server configuration
    await this.checkServerConfiguration(result);
    
    // Check database configuration
    await this.checkDatabaseSecurity(result);
    
    logger.info('✅ Security configuration check completed');
  }

  /**
   * Check environment security
   */
  private async checkEnvironmentSecurity(result: SecurityTestResult): Promise<void> {
    // Check for .env files in version control
    if (fs.existsSync('.env')) {
      result.vulnerabilities.push({
        severity: 'high',
        category: 'Configuration',
        description: '.env file found in project root',
        recommendation: 'Ensure .env files are in .gitignore and not committed to version control'
      });
    }
    
    // Check JWT secret strength
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret && jwtSecret.length < 32) {
      result.vulnerabilities.push({
        severity: 'high',
        category: 'Authentication',
        description: 'JWT secret is too short',
        recommendation: 'Use a JWT secret with at least 32 characters'
      });
    }
    
    // Check for development settings in production
    if (process.env.NODE_ENV === 'production') {
      if (process.env.DEBUG === 'true') {
        result.vulnerabilities.push({
          severity: 'medium',
          category: 'Configuration',
          description: 'Debug mode enabled in production',
          recommendation: 'Disable debug mode in production environment'
        });
      }
    }
  }

  /**
   * Check server configuration
   */
  private async checkServerConfiguration(result: SecurityTestResult): Promise<void> {
    // Check for security middleware
    const serverFiles = ['src/app.ts', 'src/server.ts', 'src/index.ts'];
    
    for (const serverFile of serverFiles) {
      if (fs.existsSync(serverFile)) {
        const content = fs.readFileSync(serverFile, 'utf8');
        
        // Check for helmet
        if (!content.includes('helmet')) {
          result.vulnerabilities.push({
            severity: 'medium',
            category: 'Security Headers',
            description: 'Helmet middleware not detected',
            file: serverFile,
            recommendation: 'Add helmet middleware for security headers'
          });
        }
        
        // Check for CORS
        if (!content.includes('cors')) {
          result.vulnerabilities.push({
            severity: 'medium',
            category: 'CORS',
            description: 'CORS middleware not detected',
            file: serverFile,
            recommendation: 'Configure CORS properly to prevent unauthorized cross-origin requests'
          });
        }
        
        // Check for rate limiting
        if (!content.includes('rate') && !content.includes('limit')) {
          result.vulnerabilities.push({
            severity: 'medium',
            category: 'Rate Limiting',
            description: 'Rate limiting not detected',
            file: serverFile,
            recommendation: 'Implement rate limiting to prevent abuse'
          });
        }
      }
    }
  }

  /**
   * Check database security
   */
  private async checkDatabaseSecurity(result: SecurityTestResult): Promise<void> {
    const databaseUrl = process.env.DATABASE_URL;
    
    if (databaseUrl) {
      // Check for SSL in database connection
      if (!databaseUrl.includes('ssl=true') && !databaseUrl.includes('sslmode=require')) {
        result.vulnerabilities.push({
          severity: 'medium',
          category: 'Database',
          description: 'Database connection may not use SSL',
          recommendation: 'Enable SSL for database connections in production'
        });
      }
      
      // Check for embedded credentials
      if (databaseUrl.includes('://') && databaseUrl.includes('@')) {
        result.vulnerabilities.push({
          severity: 'high',
          category: 'Database',
          description: 'Database credentials embedded in connection string',
          recommendation: 'Use separate environment variables for database credentials'
        });
      }
    }
  }

  /**
   * Analyze network security
   */
  private async analyzeNetworkSecurity(result: SecurityTestResult): Promise<void> {
    logger.info('Analyzing network security...');

    // Check if server is running for live analysis
    try {
      const serverUrl = process.env.SERVER_URL || 'http://localhost:3001';
      const response = await axios.get(`${serverUrl}/health`, { timeout: 5000 });
      
      // Check security headers
      const headers = response.headers;
      
      result.networkSecurity.httpsEnforced = headers['strict-transport-security'] ? true : false;
      result.networkSecurity.securityHeadersPresent = (
        headers['x-content-type-options'] === 'nosniff' &&
        headers['x-frame-options'] &&
        headers['x-xss-protection']
      );
      
      if (!result.networkSecurity.httpsEnforced) {
        result.vulnerabilities.push({
          severity: 'medium',
          category: 'Network Security',
          description: 'HTTPS not enforced (HSTS header missing)',
          recommendation: 'Add Strict-Transport-Security header to enforce HTTPS'
        });
      }
      
      if (!result.networkSecurity.securityHeadersPresent) {
        result.vulnerabilities.push({
          severity: 'medium',
          category: 'Security Headers',
          description: 'Security headers missing or incomplete',
          recommendation: 'Add comprehensive security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection)'
        });
      }
      
    } catch (error) {
      logger.warn('Could not perform live network security analysis', { error });
      result.recommendations.push('Start the server to perform live network security analysis');
    }
    
    logger.info('✅ Network security analysis completed');
  }

  /**
   * Generate security recommendations
   */
  private async generateSecurityRecommendations(result: SecurityTestResult): Promise<void> {
    const criticalCount = result.vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = result.vulnerabilities.filter(v => v.severity === 'high').length;
    
    if (criticalCount > 0) {
      result.recommendations.push(`Address ${criticalCount} critical security vulnerabilities immediately`);
    }
    
    if (highCount > 0) {
      result.recommendations.push(`Address ${highCount} high-severity security vulnerabilities`);
    }
    
    // Category-specific recommendations
    if (result.codeAnalysis.secretsFound > 0) {
      result.recommendations.push('Implement a secrets management solution (e.g., HashiCorp Vault, AWS Secrets Manager)');
    }
    
    if (result.dependencies.vulnerable > 0) {
      result.recommendations.push('Update vulnerable dependencies and implement automated dependency scanning');
    }
    
    // General security recommendations
    result.recommendations.push('Implement security testing in CI/CD pipeline');
    result.recommendations.push('Conduct regular security audits and penetration testing');
    result.recommendations.push('Set up security monitoring and alerting');
  }

  /**
   * Get all source files for analysis
   */
  private getSourceFiles(): string[] {
    const extensions = ['.ts', '.js', '.tsx', '.jsx'];
    const files: string[] = [];
    
    const scanDirectory = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDirectory(fullPath);
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    };
    
    scanDirectory('src');
    return files;
  }

  /**
   * Get line number for a match index
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Update category counters
   */
  private updateCategoryCounters(analysis: SecurityTestResult['codeAnalysis'], category: string): void {
    switch (category) {
      case 'Secrets':
        analysis.secretsFound++;
        break;
      case 'SQL Injection':
        analysis.sqlInjectionRisks++;
        break;
      case 'XSS':
        analysis.xssRisks++;
        break;
      case 'Authentication':
        analysis.authenticationIssues++;
        break;
      case 'Cryptography':
        analysis.cryptographyIssues++;
        break;
    }
  }

  /**
   * Map severity levels
   */
  private mapSeverity(severity: string): 'critical' | 'high' | 'medium' | 'low' {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'moderate':
      case 'medium':
        return 'medium';
      case 'low':
      case 'info':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Evaluate overall security status
   */
  private evaluateSecurityStatus(result: SecurityTestResult): boolean {
    const criticalCount = result.vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = result.vulnerabilities.filter(v => v.severity === 'high').length;
    
    // Fail if there are any critical vulnerabilities or more than 5 high-severity ones
    return criticalCount === 0 && highCount <= 5;
  }

  /**
   * Generate security report
   */
  generateSecurityReport(result: SecurityTestResult): string {
    let report = '\n=== Security Testing Report ===\n\n';
    
    report += `Timestamp: ${result.timestamp}\n`;
    report += `Status: ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;
    
    // Vulnerability summary
    const criticalCount = result.vulnerabilities.filter(v => v.severity === 'critical').length;
    const highCount = result.vulnerabilities.filter(v => v.severity === 'high').length;
    const mediumCount = result.vulnerabilities.filter(v => v.severity === 'medium').length;
    const lowCount = result.vulnerabilities.filter(v => v.severity === 'low').length;
    
    report += 'Vulnerability Summary:\n';
    report += `  Critical: ${criticalCount}\n`;
    report += `  High: ${highCount}\n`;
    report += `  Medium: ${mediumCount}\n`;
    report += `  Low: ${lowCount}\n\n`;
    
    // Code analysis summary
    report += 'Code Analysis Summary:\n';
    report += `  Secrets Found: ${result.codeAnalysis.secretsFound}\n`;
    report += `  SQL Injection Risks: ${result.codeAnalysis.sqlInjectionRisks}\n`;
    report += `  XSS Risks: ${result.codeAnalysis.xssRisks}\n`;
    report += `  Authentication Issues: ${result.codeAnalysis.authenticationIssues}\n`;
    report += `  Cryptography Issues: ${result.codeAnalysis.cryptographyIssues}\n\n`;
    
    // Dependency summary
    report += 'Dependency Security:\n';
    report += `  Total Dependencies: ${result.dependencies.total}\n`;
    report += `  Vulnerable Dependencies: ${result.dependencies.vulnerable}\n\n`;
    
    // Critical and high vulnerabilities
    const criticalAndHigh = result.vulnerabilities.filter(v => 
      v.severity === 'critical' || v.severity === 'high'
    );
    
    if (criticalAndHigh.length > 0) {
      report += 'Critical & High Severity Vulnerabilities:\n';
      for (const vuln of criticalAndHigh) {
        const severity = vuln.severity === 'critical' ? '🔴' : '🟠';
        report += `  ${severity} [${vuln.category}] ${vuln.description}`;
        if (vuln.file) {
          report += ` (${vuln.file}${vuln.line ? `:${vuln.line}` : ''})`;
        }
        report += `\n    💡 ${vuln.recommendation}\n`;
      }
      report += '\n';
    }
    
    // Recommendations
    if (result.recommendations.length > 0) {
      report += 'Security Recommendations:\n';
      for (const recommendation of result.recommendations) {
        report += `  📋 ${recommendation}\n`;
      }
      report += '\n';
    }
    
    if (result.passed) {
      report += '🎉 Security testing passed! No critical vulnerabilities found.\n';
    } else {
      report += '🚨 Security testing failed! Address critical vulnerabilities immediately.\n';
    }
    
    return report;
  }

  /**
   * Save security report
   */
  async saveSecurityReport(result: SecurityTestResult, outputFile?: string): Promise<void> {
    const filename = outputFile || `security-report-${Date.now()}.json`;
    const outputPath = path.join(process.cwd(), 'security-reports', filename);
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    logger.info(`Security report saved to ${outputPath}`);
  }
}

// Main security testing script
async function main() {
  try {
    const tester = new SecurityTester();
    
    logger.info('Starting security testing...');
    
    const result = await tester.runSecurityTests();
    
    // Generate and display report
    const report = tester.generateSecurityReport(result);
    console.log(report);
    
    // Save report
    await tester.saveSecurityReport(result);
    
    // Exit with appropriate code
    if (result.passed) {
      logger.info('✅ Security testing passed!');
      process.exit(0);
    } else {
      logger.error('❌ Security testing failed!');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Security testing crashed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { SecurityTester, SecurityTestResult };