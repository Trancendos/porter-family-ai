/**
 * Financial Report Export Service
 * 
 * Export financial reports to PDF and Excel formats
 */
import PDFDocument from 'pdfkit';

interface ReportData {
  title: string;
  generatedAt: Date;
  period: {
    start: Date;
    end: Date;
  };
  sections: ReportSection[];
}

interface ReportSection {
  title: string;
  type: 'table' | 'chart' | 'text' | 'summary';
  data: any;
}

interface ExportOptions {
  format: 'pdf' | 'excel';
  includeCharts: boolean;
  includeRawData: boolean;
  template?: 'forecast' | 'optimization' | 'budget' | 'portfolio';
}

/**
 * Generate forecast report
 */
export async function generateForecastReport(
  userId: number,
  periods: number = 12
): Promise<ReportData> {
  // Import forecasting service
  const { generateFinancialForecast, forecastCashFlow } = await import("./financialForecasting");
  
  const forecast = await generateFinancialForecast(userId, periods);
  const cashFlow = await forecastCashFlow(userId, 90);
  
  return {
    title: 'Financial Forecast Report',
    generatedAt: new Date(),
    period: {
      start: new Date(),
      end: new Date(Date.now() + periods * 30 * 24 * 60 * 60 * 1000)
    },
    sections: [
      {
        title: 'Executive Summary',
        type: 'summary',
        data: {
          totalRevenue: forecast.reduce((sum, f) => sum + f.predictedRevenue, 0),
          totalExpenses: forecast.reduce((sum, f) => sum + f.predictedExpenses, 0),
          projectedProfit: forecast.reduce((sum, f) => sum + f.predictedProfit, 0),
          confidence: forecast[0]?.confidence || 0.85
        }
      },
      {
        title: 'Revenue Forecast',
        type: 'table',
        data: forecast.map(f => ({
          period: f.period,
          revenue: f.predictedRevenue,
          expenses: f.predictedExpenses,
          profit: f.predictedProfit,
          trend: f.trend,
          confidence: f.confidence
        }))
      },
      {
        title: 'Cash Flow Projection',
        type: 'chart',
        data: cashFlow
      }
    ]
  };
}

/**
 * Generate cost optimization report
 */
export async function generateOptimizationReport(userId: number): Promise<ReportData> {
  const { analyzeCostsWithAI, getQuickWins } = await import("./costOptimization");
  
  const analysis = await analyzeCostsWithAI(userId);
  const quickWins = await getQuickWins(userId);
  
  return {
    title: 'Cost Optimization Report',
    generatedAt: new Date(),
    period: {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    sections: [
      {
        title: 'Optimization Summary',
        type: 'summary',
        data: {
          totalMonthlySpend: analysis.totalMonthlySpend,
          totalPotentialSavings: analysis.totalPotentialSavings,
          overallScore: analysis.overallScore,
          quickWinsCount: quickWins.length
        }
      },
      {
        title: 'Cost Analysis',
        type: 'text',
        data: `Overall optimization score: ${analysis.overallScore}/100. Total potential monthly savings: $${analysis.totalPotentialSavings.toFixed(2)}`
      },
      {
        title: 'Quick Wins',
        type: 'table',
        data: quickWins.map(w => ({
          category: w.category,
          recommendation: w.recommendation,
          savings: w.potentialSavings,
          difficulty: w.implementationDifficulty,
          priority: w.priority
        }))
      }
    ]
  };
}

/**
 * Generate budget summary report
 */
export async function generateBudgetReport(userId: number): Promise<ReportData> {
  const { getBudgetHealthScore } = await import("./financialForecasting");
  const { getBudgetStatus } = await import("./dorisFinancial");
  
  const budgetHealthScore = await getBudgetHealthScore(userId);
  
  // Get sample budget data
  const sampleBudgets = [
    { category: 'Marketing', spent: 8500, budget: 10000, remaining: 1500, healthScore: 85 },
    { category: 'Operations', spent: 15000, budget: 15000, remaining: 0, healthScore: 0 },
    { category: 'Development', spent: 12000, budget: 20000, remaining: 8000, healthScore: 100 }
  ];
  
  return {
    title: 'Budget Summary Report',
    generatedAt: new Date(),
    period: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    sections: [
      {
        title: 'Budget Health Overview',
        type: 'summary',
        data: {
          overallScore: budgetHealthScore,
          totalBudgets: sampleBudgets.length,
          onTrack: sampleBudgets.filter(b => b.healthScore >= 80).length,
          atRisk: sampleBudgets.filter(b => b.healthScore < 60).length
        }
      },
      {
        title: 'Budget Details',
        type: 'table',
        data: sampleBudgets.map(b => ({
          category: b.category,
          spent: b.spent,
          budget: b.budget,
          remaining: b.remaining,
          healthScore: b.healthScore
        }))
      },
      {
        title: 'Recommendations',
        type: 'text',
        data: 'Review budgets with health scores below 60. Consider reallocating funds from underutilized categories.'
      }
    ]
  };
}

/**
 * Generate Porter Family portfolio report
 */
export async function generatePortfolioReport(): Promise<ReportData> {
  const { 
    getPortfolioStatus, 
    getTradingMetrics, 
    getTradingTimeline 
  } = await import("./porterFamilyTrading");
  
  const portfolio = await getPortfolioStatus();
  const metrics = await getTradingMetrics('1m');
  const timeline = await getTradingTimeline(30);
  
  return {
    title: 'Porter Family Portfolio Report',
    generatedAt: new Date(),
    period: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date()
    },
    sections: [
      {
        title: 'Portfolio Summary',
        type: 'summary',
        data: {
          totalValue: portfolio.totalValue,
          totalProfitLoss: portfolio.totalProfitLoss,
          dayProfitLoss: portfolio.dayProfitLoss,
          positionsCount: portfolio.positions.length
        }
      },
      {
        title: 'Trading Performance',
        type: 'summary',
        data: {
          totalTrades: metrics.totalTrades,
          winRate: metrics.winRate,
          avgProfit: metrics.avgProfit,
          sharpeRatio: metrics.sharpeRatio
        }
      },
      {
        title: 'Current Positions',
        type: 'table',
        data: portfolio.positions.map(p => ({
          symbol: p.symbol,
          quantity: p.quantity,
          avgCost: p.avgCost,
          currentPrice: p.currentPrice,
          marketValue: p.marketValue,
          profitLoss: p.profitLoss,
          profitLossPercent: p.profitLossPercent
        }))
      },
      {
        title: 'Trading Activity',
        type: 'chart',
        data: timeline
      }
    ]
  };
}

/**
 * Export report to PDF
 */
export async function exportToPDF(report: ReportData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Create a new PDF document
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Buffer[] = [];

    // Collect data chunks
    doc.on('data', (chunk) => buffers.push(chunk));

    // When done, concatenate chunks and resolve
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    // Handle errors
    doc.on('error', (err) => reject(err));

    // Header
    doc.fontSize(20).text(report.title, { align: 'center' });
    doc.moveDown();

    doc.fontSize(12).text(`Generated: ${report.generatedAt.toISOString()}`);
    doc.text(`Period: ${report.period.start.toISOString()} to ${report.period.end.toISOString()}`);
    doc.moveDown();
    doc.moveDown();

    // Sections
    for (const section of report.sections) {
      doc.fontSize(16).text(section.title, { underline: true });
      doc.moveDown(0.5);

      if (section.type === 'text') {
        doc.fontSize(12).text(String(section.data));
      } else if (section.type === 'summary') {
        doc.fontSize(12);
        const data = section.data as Record<string, any>;
        for (const [key, value] of Object.entries(data)) {
          // Format key: camelCase to Title Case
          const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          doc.text(`${formattedKey}: ${value}`);
        }
      } else if (section.type === 'table') {
        const data = section.data as any[];
        if (Array.isArray(data) && data.length > 0) {
            const headers = Object.keys(data[0]);

            // Simple table layout
            const tableWidth = doc.page.width - 100; // 50 margin each side
            const columnWidth = tableWidth / headers.length;
            const startX = 50;
            let currentY = doc.y;

            // Draw Header
            doc.fontSize(10).font('Helvetica-Bold');

            // Background for header
            doc.save();
            doc.rect(startX, currentY, tableWidth, 20).fill('#e0e0e0');
            doc.restore();
            doc.fillColor('black');

            headers.forEach((header, i) => {
                doc.text(header.toUpperCase(), startX + (i * columnWidth) + 2, currentY + 5, {
                    width: columnWidth - 4,
                    align: 'left',
                    ellipsis: true
                });
            });

            currentY += 25;
            doc.font('Helvetica');
            doc.y = currentY;

            // Draw Rows
            data.forEach((row, rowIndex) => {
                let maxRowHeight = 0;

                // Calculate max height for this row first
                headers.forEach((header) => {
                    const text = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
                    const height = doc.heightOfString(text, { width: columnWidth - 4 });
                    if (height > maxRowHeight) maxRowHeight = height;
                });

                // Minimum row height
                maxRowHeight = Math.max(maxRowHeight, 15);

                // Check for page break
                if (doc.y + maxRowHeight > doc.page.height - 50) {
                    doc.addPage();
                    currentY = 50;
                    doc.y = currentY;
                }

                const rowY = doc.y;

                // Alternating row background
                if (rowIndex % 2 === 0) {
                    doc.save();
                    doc.rect(startX, rowY - 2, tableWidth, maxRowHeight + 4).fill('#f9f9f9');
                    doc.restore();
                }

                // Render cell text
                headers.forEach((header, i) => {
                    const text = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
                    doc.text(text, startX + (i * columnWidth) + 2, rowY, {
                        width: columnWidth - 4,
                        align: 'left'
                    });
                });

                doc.y = rowY + maxRowHeight + 5;
            });
        } else {
            doc.fontSize(12).font('Helvetica-Oblique').text('No data available');
            doc.font('Helvetica');
        }
      } else if (section.type === 'chart') {
         // Placeholder for charts
         doc.fontSize(10).font('Helvetica-Oblique').text('[Chart Visualization Not Available in PDF]');
         doc.font('Helvetica');
         doc.moveDown(0.5);
      }

      doc.moveDown(2);
    }

    // Finalize PDF file
    doc.end();
  });
}

/**
 * Export report to Excel
 */
export async function exportToExcel(report: ReportData): Promise<Buffer> {
  // TODO: Implement Excel generation using a library like exceljs
  // For now, return CSV format as placeholder
  
  let csvContent = `${report.title}\n`;
  csvContent += `Generated: ${report.generatedAt.toISOString()}\n`;
  csvContent += `Period: ${report.period.start.toISOString()} to ${report.period.end.toISOString()}\n\n`;
  
  for (const section of report.sections) {
    csvContent += `\n${section.title}\n`;
    
    if (section.type === 'table' && Array.isArray(section.data)) {
      // Convert table data to CSV
      const headers = Object.keys(section.data[0] || {});
      csvContent += headers.join(',') + '\n';
      
      for (const row of section.data) {
        csvContent += headers.map(h => row[h]).join(',') + '\n';
      }
    } else {
      csvContent += JSON.stringify(section.data, null, 2) + '\n';
    }
  }
  
  return Buffer.from(csvContent, 'utf-8');
}

/**
 * Generate and export report in one step
 */
export async function generateAndExport(
  userId: number,
  reportType: 'forecast' | 'optimization' | 'budget' | 'portfolio',
  format: 'pdf' | 'excel'
): Promise<{ filename: string; buffer: Buffer }> {
  let report: ReportData;
  
  switch (reportType) {
    case 'forecast':
      report = await generateForecastReport(userId);
      break;
    case 'optimization':
      report = await generateOptimizationReport(userId);
      break;
    case 'budget':
      report = await generateBudgetReport(userId);
      break;
    case 'portfolio':
      report = await generatePortfolioReport();
      break;
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
  
  const buffer = format === 'pdf' 
    ? await exportToPDF(report) 
    : await exportToExcel(report);
  
  const extension = format === 'pdf' ? 'pdf' : 'xlsx';
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `${reportType}-report-${timestamp}.${extension}`;
  
  return { filename, buffer };
}
