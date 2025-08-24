/**
 * Comprehensive Test Runner
 * 
 * Orchestrates running all test suites and generates comprehensive reports.
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface TestSuite {
  name: string;
  pattern: string;
  description: string;
  timeout?: number;
}

interface TestResult {
  suite: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

interface TestReport {
  timestamp: Date;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalDuration: number;
  suites: TestResult[];
  overallCoverage?: {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
  };
}

const TEST_SUITES: TestSuite[] = [
  {
    name: 'Unit Tests - Services',
    pattern: 'src/services/**/*.test.ts',
    description: 'Core business logic and service layer tests',
    timeout: 30000
  },
  {
    name: 'Unit Tests - Components',
    pattern: 'src/components/**/*.test.tsx',
    description: 'React component tests',
    timeout: 20000
  },
  {
    name: 'Unit Tests - Utilities',
    pattern: 'src/utils/**/*.test.ts',
    description: 'Utility function tests',
    timeout: 10000
  },
  {
    name: 'Integration Tests - Chrome APIs',
    pattern: 'src/__tests__/integration/**/*.test.ts',
    description: 'Chrome extension API integration tests',
    timeout: 45000
  },
  {
    name: 'End-to-End Tests',
    pattern: 'src/__tests__/e2e/**/*.test.ts',
    description: 'Complete user workflow tests',
    timeout: 60000
  }
];

class TestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;

  async runAllTests(): Promise<TestReport> {
    console.log('🚀 Starting comprehensive test suite...\n');
    this.startTime = Date.now();

    // Ensure test output directory exists
    this.ensureOutputDirectory();

    // Run each test suite
    for (const suite of TEST_SUITES) {
      await this.runTestSuite(suite);
    }

    // Generate final report
    const report = this.generateReport();
    this.saveReport(report);
    this.printSummary(report);

    return report;
  }

  private async runTestSuite(suite: TestSuite): Promise<void> {
    console.log(`📋 Running ${suite.name}...`);
    console.log(`   ${suite.description}`);

    const startTime = Date.now();
    
    try {
      // Build vitest command
      const command = [
        'npx vitest run',
        `--testTimeout=${suite.timeout || 30000}`,
        '--reporter=json',
        `--outputFile=test-results/${this.sanitizeFileName(suite.name)}.json`,
        suite.pattern
      ].join(' ');

      // Execute tests
      const output = execSync(command, { 
        encoding: 'utf-8',
        stdio: 'pipe'
      });

      const duration = Date.now() - startTime;
      const result = this.parseTestOutput(suite.name, output, duration);
      this.results.push(result);

      console.log(`   ✅ Passed: ${result.passed}, Failed: ${result.failed}, Duration: ${duration}ms\n`);

    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Handle test failures
      const result: TestResult = {
        suite: suite.name,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration
      };

      this.results.push(result);
      console.log(`   ❌ Suite failed: ${error.message}\n`);
    }
  }

  private parseTestOutput(suiteName: string, output: string, duration: number): TestResult {
    try {
      // Try to parse JSON output from vitest
      const jsonOutput = JSON.parse(output);
      
      return {
        suite: suiteName,
        passed: jsonOutput.numPassedTests || 0,
        failed: jsonOutput.numFailedTests || 0,
        skipped: jsonOutput.numPendingTests || 0,
        duration,
        coverage: jsonOutput.coverageMap ? this.extractCoverage(jsonOutput.coverageMap) : undefined
      };
    } catch {
      // Fallback parsing for non-JSON output
      const lines = output.split('\n');
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      for (const line of lines) {
        if (line.includes('✓') || line.includes('PASS')) passed++;
        if (line.includes('✗') || line.includes('FAIL')) failed++;
        if (line.includes('○') || line.includes('SKIP')) skipped++;
      }

      return {
        suite: suiteName,
        passed,
        failed,
        skipped,
        duration
      };
    }
  }

  private extractCoverage(coverageMap: any): TestResult['coverage'] {
    // Extract coverage information from coverage map
    let totalLines = 0;
    let coveredLines = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalStatements = 0;
    let coveredStatements = 0;

    for (const file in coverageMap) {
      const fileCoverage = coverageMap[file];
      
      if (fileCoverage.l) {
        totalLines += Object.keys(fileCoverage.l).length;
        coveredLines += Object.values(fileCoverage.l).filter((hits: any) => hits > 0).length;
      }
      
      if (fileCoverage.f) {
        totalFunctions += Object.keys(fileCoverage.f).length;
        coveredFunctions += Object.values(fileCoverage.f).filter((hits: any) => hits > 0).length;
      }
      
      if (fileCoverage.b) {
        for (const branchId in fileCoverage.b) {
          const branch = fileCoverage.b[branchId];
          totalBranches += branch.length;
          coveredBranches += branch.filter((hits: number) => hits > 0).length;
        }
      }
      
      if (fileCoverage.s) {
        totalStatements += Object.keys(fileCoverage.s).length;
        coveredStatements += Object.values(fileCoverage.s).filter((hits: any) => hits > 0).length;
      }
    }

    return {
      lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
      functions: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
      branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
      statements: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0
    };
  }

  private generateReport(): TestReport {
    const totalDuration = Date.now() - this.startTime;
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = this.results.reduce((sum, r) => sum + r.skipped, 0);

    // Calculate overall coverage
    const coverageResults = this.results.filter(r => r.coverage);
    let overallCoverage: TestReport['overallCoverage'];

    if (coverageResults.length > 0) {
      overallCoverage = {
        lines: coverageResults.reduce((sum, r) => sum + (r.coverage?.lines || 0), 0) / coverageResults.length,
        functions: coverageResults.reduce((sum, r) => sum + (r.coverage?.functions || 0), 0) / coverageResults.length,
        branches: coverageResults.reduce((sum, r) => sum + (r.coverage?.branches || 0), 0) / coverageResults.length,
        statements: coverageResults.reduce((sum, r) => sum + (r.coverage?.statements || 0), 0) / coverageResults.length
      };
    }

    return {
      timestamp: new Date(),
      totalTests: totalPassed + totalFailed + totalSkipped,
      totalPassed,
      totalFailed,
      totalSkipped,
      totalDuration,
      suites: this.results,
      overallCoverage
    };
  }

  private saveReport(report: TestReport): void {
    const reportPath = join(process.cwd(), 'test-results', 'comprehensive-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    // Also generate HTML report
    this.generateHTMLReport(report);
  }

  private generateHTMLReport(report: TestReport): void {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Report - Agentic Chrome Extension</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 15px; border-radius: 6px; text-align: center; }
        .metric-value { font-size: 2em; font-weight: bold; color: #007bff; }
        .metric-label { color: #666; margin-top: 5px; }
        .suite { margin-bottom: 20px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
        .suite-header { background: #f8f9fa; padding: 15px; font-weight: bold; }
        .suite-content { padding: 15px; }
        .test-stats { display: flex; gap: 20px; margin-bottom: 10px; }
        .stat { padding: 5px 10px; border-radius: 4px; font-size: 0.9em; }
        .stat.passed { background: #d4edda; color: #155724; }
        .stat.failed { background: #f8d7da; color: #721c24; }
        .stat.skipped { background: #fff3cd; color: #856404; }
        .coverage { margin-top: 15px; }
        .coverage-bar { background: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden; margin: 5px 0; }
        .coverage-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s; }
        .timestamp { text-align: center; color: #666; margin-top: 30px; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 Test Report</h1>
            <h2>Agentic Chrome Extension</h2>
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-value">${report.totalTests}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #28a745">${report.totalPassed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #dc3545">${report.totalFailed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #ffc107">${report.totalSkipped}</div>
                <div class="metric-label">Skipped</div>
            </div>
            <div class="metric">
                <div class="metric-value">${(report.totalDuration / 1000).toFixed(1)}s</div>
                <div class="metric-label">Duration</div>
            </div>
            ${report.overallCoverage ? `
            <div class="metric">
                <div class="metric-value" style="color: #17a2b8">${report.overallCoverage.lines.toFixed(1)}%</div>
                <div class="metric-label">Line Coverage</div>
            </div>
            ` : ''}
        </div>

        ${report.suites.map(suite => `
        <div class="suite">
            <div class="suite-header">${suite.suite}</div>
            <div class="suite-content">
                <div class="test-stats">
                    <span class="stat passed">✓ ${suite.passed} Passed</span>
                    <span class="stat failed">✗ ${suite.failed} Failed</span>
                    <span class="stat skipped">○ ${suite.skipped} Skipped</span>
                    <span style="margin-left: auto; color: #666;">${(suite.duration / 1000).toFixed(1)}s</span>
                </div>
                ${suite.coverage ? `
                <div class="coverage">
                    <div>Lines: ${suite.coverage.lines.toFixed(1)}%</div>
                    <div class="coverage-bar">
                        <div class="coverage-fill" style="width: ${suite.coverage.lines}%"></div>
                    </div>
                    <div>Functions: ${suite.coverage.functions.toFixed(1)}%</div>
                    <div class="coverage-bar">
                        <div class="coverage-fill" style="width: ${suite.coverage.functions}%"></div>
                    </div>
                    <div>Branches: ${suite.coverage.branches.toFixed(1)}%</div>
                    <div class="coverage-bar">
                        <div class="coverage-fill" style="width: ${suite.coverage.branches}%"></div>
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
        `).join('')}

        <div class="timestamp">
            Generated on ${report.timestamp.toLocaleString()}
        </div>
    </div>
</body>
</html>`;

    const htmlPath = join(process.cwd(), 'test-results', 'report.html');
    writeFileSync(htmlPath, html);
  }

  private printSummary(report: TestReport): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`✅ Passed: ${report.totalPassed}`);
    console.log(`❌ Failed: ${report.totalFailed}`);
    console.log(`⏭️  Skipped: ${report.totalSkipped}`);
    console.log(`⏱️  Duration: ${(report.totalDuration / 1000).toFixed(1)}s`);
    
    if (report.overallCoverage) {
      console.log('\n📈 COVERAGE SUMMARY');
      console.log(`Lines: ${report.overallCoverage.lines.toFixed(1)}%`);
      console.log(`Functions: ${report.overallCoverage.functions.toFixed(1)}%`);
      console.log(`Branches: ${report.overallCoverage.branches.toFixed(1)}%`);
      console.log(`Statements: ${report.overallCoverage.statements.toFixed(1)}%`);
    }

    console.log('\n📋 SUITE BREAKDOWN');
    for (const suite of report.suites) {
      const status = suite.failed > 0 ? '❌' : '✅';
      console.log(`${status} ${suite.suite}: ${suite.passed}/${suite.passed + suite.failed} (${(suite.duration / 1000).toFixed(1)}s)`);
    }

    console.log('\n📄 Reports saved to:');
    console.log(`   - JSON: test-results/comprehensive-report.json`);
    console.log(`   - HTML: test-results/report.html`);
    console.log('='.repeat(60));

    // Exit with error code if tests failed
    if (report.totalFailed > 0) {
      process.exit(1);
    }
  }

  private ensureOutputDirectory(): void {
    const outputDir = join(process.cwd(), 'test-results');
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }
  }

  private sanitizeFileName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  }
}

// CLI interface
if (require.main === module) {
  const runner = new TestRunner();
  runner.runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  });
}

export { TestRunner, TestReport, TestResult };