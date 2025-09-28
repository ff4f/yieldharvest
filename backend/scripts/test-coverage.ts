#!/usr/bin/env ts-node

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { logger } from '../src/utils/logger';
import { glob } from 'glob';

interface CoverageReport {
  timestamp: string;
  overall: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  files: Array<{
    file: string;
    statements: number;
    branches: number;
    functions: number;
    lines: number;
    uncoveredLines: number[];
  }>;
  thresholds: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
  passed: boolean;
  criticalFiles: string[];
  recommendations: string[];
}

interface TestSuite {
  name: string;
  pattern: string;
  description: string;
  required: boolean;
}

class TestCoverageAnalyzer {
  private readonly coverageThresholds = {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  };

  private readonly criticalFiles = [
    'src/services/hedera.ts',
    'src/services/hts.service.ts',
    'src/services/hfs.service.ts',
    'src/services/hcs.service.ts',
    'src/services/funding.service.ts',
    'src/services/invoice.service.ts',
    'src/services/wallet.service.ts',
    'src/controllers/invoice.controller.ts',
    'src/controllers/funding.controller.ts',
    'src/middleware/auth.middleware.ts',
    'src/middleware/validation.middleware.ts'
  ];

  private readonly testSuites: TestSuite[] = [
    {
      name: 'Unit Tests',
      pattern: 'src/**/*.test.ts',
      description: 'Individual component testing',
      required: true
    },
    {
      name: 'Integration Tests',
      pattern: 'src/**/*.integration.test.ts',
      description: 'Service integration testing',
      required: true
    },
    {
      name: 'E2E Tests',
      pattern: 'e2e/**/*.spec.ts',
      description: 'End-to-end workflow testing',
      required: true
    },
    {
      name: 'Security Tests',
      pattern: 'src/**/*.security.test.ts',
      description: 'Security vulnerability testing',
      required: false
    },
    {
      name: 'Performance Tests',
      pattern: 'src/**/*.perf.test.ts',
      description: 'Performance and load testing',
      required: false
    }
  ];

  /**
   * Run comprehensive test coverage analysis
   */
  async runCoverageAnalysis(): Promise<CoverageReport> {
    logger.info('Starting comprehensive test coverage analysis...');

    try {
      // Step 1: Validate test structure
      await this.validateTestStructure();

      // Step 2: Run tests with coverage
      await this.runTestsWithCoverage();

      // Step 3: Parse coverage results
      const coverageData = await this.parseCoverageResults();

      // Step 4: Analyze critical file coverage
      const criticalAnalysis = await this.analyzeCriticalFiles(coverageData);

      // Step 5: Generate recommendations
      const recommendations = await this.generateRecommendations(coverageData, criticalAnalysis);

      const report: CoverageReport = {
        timestamp: new Date().toISOString(),
        overall: coverageData.overall,
        files: coverageData.files,
        thresholds: this.coverageThresholds,
        passed: this.evaluateOverallCoverage(coverageData.overall),
        criticalFiles: criticalAnalysis.uncoveredCriticalFiles,
        recommendations
      };

      logger.info('Test coverage analysis completed', {
        passed: report.passed,
        overallCoverage: report.overall
      });

      return report;
    } catch (error) {
      logger.error('Test coverage analysis failed', { error });
      throw error;
    }
  }

  /**
   * Validate test file structure
   */
  private async validateTestStructure(): Promise<void> {
    logger.info('Validating test structure...');

    const missingTestSuites: string[] = [];
    const testCounts: Record<string, number> = {};

    for (const suite of this.testSuites) {
      const testFiles = await glob(suite.pattern, { cwd: process.cwd() });
      testCounts[suite.name] = testFiles.length;

      if (suite.required && testFiles.length === 0) {
        missingTestSuites.push(suite.name);
      }

      logger.debug(`${suite.name}: ${testFiles.length} files found`);
    }

    if (missingTestSuites.length > 0) {
      throw new Error(`Missing required test suites: ${missingTestSuites.join(', ')}`);
    }

    // Check for test files without corresponding source files
    await this.validateTestFileMapping();

    logger.info('✅ Test structure validation passed', { testCounts });
  }

  /**
   * Validate test file mapping to source files
   */
  private async validateTestFileMapping(): Promise<void> {
    const testFiles = await glob('src/**/*.test.ts', { cwd: process.cwd() });
    const orphanedTests: string[] = [];

    for (const testFile of testFiles) {
      const sourceFile = testFile.replace('.test.ts', '.ts');
      if (!fs.existsSync(sourceFile)) {
        orphanedTests.push(testFile);
      }
    }

    if (orphanedTests.length > 0) {
      logger.warn('Found orphaned test files (no corresponding source):', orphanedTests);
    }

    // Check for source files without tests
    const sourceFiles = await glob('src/**/*.ts', {
      cwd: process.cwd(),
      ignore: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/**/*.d.ts']
    });

    const untestedFiles: string[] = [];
    for (const sourceFile of sourceFiles) {
      const testFile = sourceFile.replace('.ts', '.test.ts');
      if (!fs.existsSync(testFile) && this.criticalFiles.includes(sourceFile)) {
        untestedFiles.push(sourceFile);
      }
    }

    if (untestedFiles.length > 0) {
      logger.warn('Critical files without unit tests:', untestedFiles);
    }
  }

  /**
   * Run tests with coverage collection
   */
  private async runTestsWithCoverage(): Promise<void> {
    logger.info('Running tests with coverage collection...');

    try {
      // Clean previous coverage data
      if (fs.existsSync('coverage')) {
        execSync('rm -rf coverage', { stdio: 'inherit' });
      }

      // Run Jest with coverage
      const jestCommand = [
        'npx jest',
        '--coverage',
        '--coverageDirectory=coverage',
        '--coverageReporters=json,lcov,text,html',
        '--collectCoverageFrom="src/**/*.ts"',
        '--collectCoverageFrom="!src/**/*.test.ts"',
        '--collectCoverageFrom="!src/**/*.spec.ts"',
        '--collectCoverageFrom="!src/**/*.d.ts"',
        '--passWithNoTests'
      ].join(' ');

      logger.debug('Executing Jest command:', jestCommand);
      execSync(jestCommand, { stdio: 'inherit' });

      logger.info('✅ Test execution with coverage completed');
    } catch (error) {
      logger.error('Test execution failed', { error });
      throw new Error(`Test execution failed: ${error}`);
    }
  }

  /**
   * Parse coverage results from Jest output
   */
  private async parseCoverageResults(): Promise<any> {
    const coverageFile = path.join(process.cwd(), 'coverage/coverage-final.json');

    if (!fs.existsSync(coverageFile)) {
      throw new Error('Coverage file not found. Ensure tests ran successfully.');
    }

    const coverageData = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));

    // Calculate overall coverage
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalLines = 0;
    let coveredLines = 0;

    const files = Object.keys(coverageData).map(filePath => {
      const fileData = coverageData[filePath];
      const relativePath = path.relative(process.cwd(), filePath);

      // Aggregate totals
      totalStatements += fileData.s ? Object.keys(fileData.s).length : 0;
      coveredStatements += fileData.s ? Object.values(fileData.s).filter((count: any) => count > 0).length : 0;
      
      totalBranches += fileData.b ? Object.keys(fileData.b).length : 0;
      coveredBranches += fileData.b ? Object.values(fileData.b).flat().filter((count: any) => count > 0).length : 0;
      
      totalFunctions += fileData.f ? Object.keys(fileData.f).length : 0;
      coveredFunctions += fileData.f ? Object.values(fileData.f).filter((count: any) => count > 0).length : 0;
      
      const lineStats = fileData.statementMap ? Object.keys(fileData.statementMap) : [];
      totalLines += lineStats.length;
      coveredLines += lineStats.filter(line => fileData.s && fileData.s[line] > 0).length;

      // Find uncovered lines
      const uncoveredLines = lineStats
        .filter(line => fileData.s && fileData.s[line] === 0)
        .map(line => fileData.statementMap[line].start.line);

      return {
        file: relativePath,
        statements: fileData.s ? (coveredStatements / totalStatements) * 100 : 0,
        branches: fileData.b ? (coveredBranches / totalBranches) * 100 : 0,
        functions: fileData.f ? (coveredFunctions / totalFunctions) * 100 : 0,
        lines: lineStats.length > 0 ? (coveredLines / totalLines) * 100 : 0,
        uncoveredLines
      };
    });

    const overall = {
      statements: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0,
      branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
      functions: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
      lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0
    };

    return { overall, files };
  }

  /**
   * Analyze coverage for critical files
   */
  private async analyzeCriticalFiles(coverageData: any): Promise<any> {
    const uncoveredCriticalFiles: string[] = [];
    const lowCoverageCriticalFiles: Array<{ file: string; coverage: number }> = [];

    for (const criticalFile of this.criticalFiles) {
      const fileData = coverageData.files.find((f: any) => f.file === criticalFile);

      if (!fileData) {
        uncoveredCriticalFiles.push(criticalFile);
      } else if (fileData.lines < this.coverageThresholds.lines) {
        lowCoverageCriticalFiles.push({
          file: criticalFile,
          coverage: fileData.lines
        });
      }
    }

    return {
      uncoveredCriticalFiles,
      lowCoverageCriticalFiles
    };
  }

  /**
   * Generate coverage improvement recommendations
   */
  private async generateRecommendations(coverageData: any, criticalAnalysis: any): Promise<string[]> {
    const recommendations: string[] = [];

    // Overall coverage recommendations
    if (coverageData.overall.statements < this.coverageThresholds.statements) {
      recommendations.push(
        `Increase statement coverage from ${coverageData.overall.statements.toFixed(1)}% to ${this.coverageThresholds.statements}%`
      );
    }

    if (coverageData.overall.branches < this.coverageThresholds.branches) {
      recommendations.push(
        `Increase branch coverage from ${coverageData.overall.branches.toFixed(1)}% to ${this.coverageThresholds.branches}%`
      );
    }

    if (coverageData.overall.functions < this.coverageThresholds.functions) {
      recommendations.push(
        `Increase function coverage from ${coverageData.overall.functions.toFixed(1)}% to ${this.coverageThresholds.functions}%`
      );
    }

    // Critical file recommendations
    if (criticalAnalysis.uncoveredCriticalFiles.length > 0) {
      recommendations.push(
        `Add unit tests for critical files: ${criticalAnalysis.uncoveredCriticalFiles.join(', ')}`
      );
    }

    if (criticalAnalysis.lowCoverageCriticalFiles.length > 0) {
      for (const file of criticalAnalysis.lowCoverageCriticalFiles) {
        recommendations.push(
          `Improve coverage for ${file.file} from ${file.coverage.toFixed(1)}% to ${this.coverageThresholds.lines}%`
        );
      }
    }

    // File-specific recommendations
    const lowCoverageFiles = coverageData.files
      .filter((f: any) => f.lines < 50)
      .sort((a: any, b: any) => a.lines - b.lines)
      .slice(0, 5);

    if (lowCoverageFiles.length > 0) {
      recommendations.push(
        `Priority files for testing (lowest coverage): ${lowCoverageFiles.map((f: any) => `${f.file} (${f.lines.toFixed(1)}%)`).join(', ')}`
      );
    }

    // Test type recommendations
    const unitTestCount = (await glob('src/**/*.test.ts')).length;
    const integrationTestCount = (await glob('src/**/*.integration.test.ts')).length;
    const e2eTestCount = (await glob('e2e/**/*.spec.ts')).length;

    if (integrationTestCount < unitTestCount * 0.3) {
      recommendations.push('Add more integration tests to verify service interactions');
    }

    if (e2eTestCount < 5) {
      recommendations.push('Add more end-to-end tests to verify complete user workflows');
    }

    return recommendations;
  }

  /**
   * Evaluate if overall coverage meets thresholds
   */
  private evaluateOverallCoverage(overall: any): boolean {
    return (
      overall.statements >= this.coverageThresholds.statements &&
      overall.branches >= this.coverageThresholds.branches &&
      overall.functions >= this.coverageThresholds.functions &&
      overall.lines >= this.coverageThresholds.lines
    );
  }

  /**
   * Generate detailed coverage report
   */
  generateDetailedReport(report: CoverageReport): string {
    let output = '\n=== Test Coverage Analysis Report ===\n\n';
    
    output += `Timestamp: ${report.timestamp}\n`;
    output += `Status: ${report.passed ? '✅ PASSED' : '❌ FAILED'}\n\n`;
    
    // Overall coverage
    output += 'Overall Coverage:\n';
    output += `  Statements: ${report.overall.statements.toFixed(1)}% (threshold: ${report.thresholds.statements}%)\n`;
    output += `  Branches: ${report.overall.branches.toFixed(1)}% (threshold: ${report.thresholds.branches}%)\n`;
    output += `  Functions: ${report.overall.functions.toFixed(1)}% (threshold: ${report.thresholds.functions}%)\n`;
    output += `  Lines: ${report.overall.lines.toFixed(1)}% (threshold: ${report.thresholds.lines}%)\n\n`;
    
    // Critical files status
    if (report.criticalFiles.length > 0) {
      output += 'Critical Files Missing Coverage:\n';
      for (const file of report.criticalFiles) {
        output += `  ❌ ${file}\n`;
      }
      output += '\n';
    }
    
    // Recommendations
    if (report.recommendations.length > 0) {
      output += 'Recommendations:\n';
      for (const recommendation of report.recommendations) {
        output += `  📋 ${recommendation}\n`;
      }
      output += '\n';
    }
    
    // Low coverage files (top 10)
    const lowCoverageFiles = report.files
      .filter(f => f.lines < 80)
      .sort((a, b) => a.lines - b.lines)
      .slice(0, 10);
    
    if (lowCoverageFiles.length > 0) {
      output += 'Files with Low Coverage:\n';
      for (const file of lowCoverageFiles) {
        output += `  📉 ${file.file}: ${file.lines.toFixed(1)}% lines\n`;
      }
      output += '\n';
    }
    
    if (report.passed) {
      output += '🎉 Coverage analysis passed! All thresholds met.\n';
    } else {
      output += '🚨 Coverage analysis failed. Address recommendations above.\n';
    }
    
    return output;
  }

  /**
   * Save coverage report
   */
  async saveCoverageReport(report: CoverageReport, outputFile?: string): Promise<void> {
    const filename = outputFile || `coverage-report-${Date.now()}.json`;
    const outputPath = path.join(process.cwd(), 'coverage', filename);
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    logger.info(`Coverage report saved to ${outputPath}`);
  }
}

// Main coverage analysis script
async function main() {
  try {
    const analyzer = new TestCoverageAnalyzer();
    
    logger.info('Starting test coverage analysis...');
    
    const report = await analyzer.runCoverageAnalysis();
    
    // Generate and display report
    const detailedReport = analyzer.generateDetailedReport(report);
    console.log(detailedReport);
    
    // Save report
    await analyzer.saveCoverageReport(report);
    
    // Exit with appropriate code
    if (report.passed) {
      logger.info('✅ Test coverage analysis passed!');
      process.exit(0);
    } else {
      logger.error('❌ Test coverage analysis failed!');
      process.exit(1);
    }
  } catch (error) {
    logger.error('Test coverage analysis crashed', { error });
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

export { TestCoverageAnalyzer, CoverageReport };