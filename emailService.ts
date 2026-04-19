import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Email configuration interface
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// Email template types
export type EmailTemplateType = 
  | 'schedule_report'
  | 'budget_alert'
  | 'financial_summary'
  | 'trading_update'
  | 'cost_optimization';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface EmailData {
  recipientName?: string;
  reportType?: string;
  scheduleTitle?: string;
  reportUrl?: string;
  budgetName?: string;
  currentAmount?: number;
  budgetLimit?: number;
  percentageUsed?: number;
  alertLevel?: 'warning' | 'critical';
  totalRevenue?: number;
  totalExpenses?: number;
  netProfit?: number;
  period?: string;
  portfolioValue?: number;
  profitLoss?: number;
  topPerformers?: Array<{ symbol: string; return: number }>;
  optimizations?: Array<{ title: string; savings: number; priority: string }>;
  totalSavings?: number;
  [key: string]: any;
}

// Email delivery result
export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  retryCount: number;
  timestamp: Date;
}

// Email queue item
export interface EmailQueueItem {
  id: string;
  to: string;
  templateType: EmailTemplateType;
  data: EmailData;
  scheduledFor?: Date;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  lastAttempt?: Date;
  result?: EmailDeliveryResult;
}

class EmailService {
  private transporter: Transporter | null = null;
  private queue: EmailQueueItem[] = [];
  private isProcessing = false;

  /**
   * Initialize email service with SMTP configuration
   */
  async initialize(config: EmailConfig): Promise<void> {
    try {
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
          user: config.auth.user,
          pass: config.auth.pass,
        },
      });

      // Verify connection
      await this.transporter.verify();
      console.log('[EmailService] SMTP connection verified');
    } catch (error) {
      console.error('[EmailService] Failed to initialize:', error);
      throw new Error('Failed to initialize email service');
    }
  }

  /**
   * Get email template by type
   */
  private getTemplate(type: EmailTemplateType, data: EmailData): EmailTemplate {
    const templates: Record<EmailTemplateType, (data: EmailData) => EmailTemplate> = {
      schedule_report: (d) => ({
        subject: `Scheduled Report: ${d.scheduleTitle || 'Report'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
              .footer { text-align: center; margin-top: 30px; color: #6b7280; font-size: 14px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📊 ${d.scheduleTitle || 'Scheduled Report'}</h1>
              </div>
              <div class="content">
                <p>Hello ${d.recipientName || 'there'},</p>
                <p>Your scheduled ${d.reportType || 'report'} is ready for review.</p>
                ${d.reportUrl ? `<a href="${d.reportUrl}" class="button">View Report</a>` : ''}
                <p style="margin-top: 30px;">This is an automated report from the Porter Family Financial System.</p>
              </div>
              <div class="footer">
                <p>Luminous-MastermindAI | Powered by Porter Family Intelligence</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `${d.scheduleTitle || 'Scheduled Report'}\n\nHello ${d.recipientName || 'there'},\n\nYour scheduled ${d.reportType || 'report'} is ready for review.\n\n${d.reportUrl ? `View report: ${d.reportUrl}\n\n` : ''}This is an automated report from the Porter Family Financial System.`,
      }),

      budget_alert: (d) => ({
        subject: `${d.alertLevel === 'critical' ? '🚨 CRITICAL' : '⚠️ WARNING'}: Budget Alert - ${d.budgetName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: ${d.alertLevel === 'critical' ? '#dc2626' : '#f59e0b'}; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .alert-box { background: ${d.alertLevel === 'critical' ? '#fee2e2' : '#fef3c7'}; border-left: 4px solid ${d.alertLevel === 'critical' ? '#dc2626' : '#f59e0b'}; padding: 15px; margin: 20px 0; }
              .stats { display: flex; justify-content: space-around; margin: 20px 0; }
              .stat { text-align: center; }
              .stat-value { font-size: 24px; font-weight: bold; color: ${d.alertLevel === 'critical' ? '#dc2626' : '#f59e0b'}; }
              .stat-label { font-size: 14px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${d.alertLevel === 'critical' ? '🚨 CRITICAL ALERT' : '⚠️ WARNING'}</h1>
                <h2>${d.budgetName}</h2>
              </div>
              <div class="content">
                <div class="alert-box">
                  <strong>${d.alertLevel === 'critical' ? 'Budget limit exceeded!' : 'Budget threshold reached!'}</strong>
                  <p>Your budget "${d.budgetName}" has reached ${d.percentageUsed}% of its limit.</p>
                </div>
                <div class="stats">
                  <div class="stat">
                    <div class="stat-value">$${d.currentAmount?.toLocaleString() || '0'}</div>
                    <div class="stat-label">Current Spending</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">$${d.budgetLimit?.toLocaleString() || '0'}</div>
                    <div class="stat-label">Budget Limit</div>
                  </div>
                  <div class="stat">
                    <div class="stat-value">${d.percentageUsed}%</div>
                    <div class="stat-label">Used</div>
                  </div>
                </div>
                <p><strong>Recommended Action:</strong> ${d.alertLevel === 'critical' ? 'Review spending immediately and adjust budget or expenses.' : 'Monitor spending closely to avoid exceeding budget.'}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `${d.alertLevel === 'critical' ? 'CRITICAL ALERT' : 'WARNING'}: ${d.budgetName}\n\nYour budget "${d.budgetName}" has reached ${d.percentageUsed}% of its limit.\n\nCurrent Spending: $${d.currentAmount?.toLocaleString() || '0'}\nBudget Limit: $${d.budgetLimit?.toLocaleString() || '0'}\nUsed: ${d.percentageUsed}%\n\nRecommended Action: ${d.alertLevel === 'critical' ? 'Review spending immediately and adjust budget or expenses.' : 'Monitor spending closely to avoid exceeding budget.'}`,
      }),

      financial_summary: (d) => ({
        subject: `Financial Summary - ${d.period || 'Current Period'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
              .summary-item { background: white; padding: 15px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
              .summary-label { font-size: 14px; color: #6b7280; }
              .summary-value { font-size: 24px; font-weight: bold; color: #111827; margin-top: 5px; }
              .profit { color: #10b981; }
              .loss { color: #ef4444; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>💰 Financial Summary</h1>
                <p>${d.period || 'Current Period'}</p>
              </div>
              <div class="content">
                <div class="summary-grid">
                  <div class="summary-item">
                    <div class="summary-label">Total Revenue</div>
                    <div class="summary-value">$${d.totalRevenue?.toLocaleString() || '0'}</div>
                  </div>
                  <div class="summary-item">
                    <div class="summary-label">Total Expenses</div>
                    <div class="summary-value">$${d.totalExpenses?.toLocaleString() || '0'}</div>
                  </div>
                  <div class="summary-item" style="grid-column: 1 / -1;">
                    <div class="summary-label">Net Profit</div>
                    <div class="summary-value ${(d.netProfit || 0) >= 0 ? 'profit' : 'loss'}">
                      $${d.netProfit?.toLocaleString() || '0'}
                    </div>
                  </div>
                </div>
                <p>Review your complete financial dashboard for detailed insights and recommendations.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Financial Summary - ${d.period || 'Current Period'}\n\nTotal Revenue: $${d.totalRevenue?.toLocaleString() || '0'}\nTotal Expenses: $${d.totalExpenses?.toLocaleString() || '0'}\nNet Profit: $${d.netProfit?.toLocaleString() || '0'}\n\nReview your complete financial dashboard for detailed insights and recommendations.`,
      }),

      trading_update: (d) => ({
        subject: `Trading Update - Portfolio Performance`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .performance { text-align: center; margin: 20px 0; }
              .performance-value { font-size: 36px; font-weight: bold; }
              .profit { color: #10b981; }
              .loss { color: #ef4444; }
              .performers { background: white; padding: 15px; border-radius: 6px; margin: 20px 0; }
              .performer-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📈 Trading Update</h1>
                <p>Portfolio Performance Report</p>
              </div>
              <div class="content">
                <div class="performance">
                  <div style="font-size: 14px; color: #6b7280;">Portfolio Value</div>
                  <div style="font-size: 36px; font-weight: bold; margin: 10px 0;">$${d.portfolioValue?.toLocaleString() || '0'}</div>
                  <div class="performance-value ${(d.profitLoss || 0) >= 0 ? 'profit' : 'loss'}">
                    ${(d.profitLoss || 0) >= 0 ? '+' : ''}$${d.profitLoss?.toLocaleString() || '0'}
                  </div>
                </div>
                ${d.topPerformers && d.topPerformers.length > 0 ? `
                  <div class="performers">
                    <h3>Top Performers</h3>
                    ${d.topPerformers.map(p => `
                      <div class="performer-item">
                        <span>${p.symbol}</span>
                        <span class="${p.return >= 0 ? 'profit' : 'loss'}">${p.return >= 0 ? '+' : ''}${p.return}%</span>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
                <p>View your complete trading dashboard for detailed analytics and insights.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Trading Update - Portfolio Performance\n\nPortfolio Value: $${d.portfolioValue?.toLocaleString() || '0'}\nProfit/Loss: ${(d.profitLoss || 0) >= 0 ? '+' : ''}$${d.profitLoss?.toLocaleString() || '0'}\n\n${d.topPerformers && d.topPerformers.length > 0 ? `Top Performers:\n${d.topPerformers.map(p => `${p.symbol}: ${p.return >= 0 ? '+' : ''}${p.return}%`).join('\n')}\n\n` : ''}View your complete trading dashboard for detailed analytics and insights.`,
      }),

      cost_optimization: (d) => ({
        subject: `Cost Optimization Recommendations - Save $${d.totalSavings?.toLocaleString() || '0'}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
              .savings-highlight { background: white; padding: 20px; border-radius: 6px; text-align: center; margin: 20px 0; }
              .savings-value { font-size: 48px; font-weight: bold; color: #10b981; }
              .optimization-list { background: white; padding: 15px; border-radius: 6px; margin: 20px 0; }
              .optimization-item { padding: 15px; border-bottom: 1px solid #e5e7eb; }
              .priority-badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: bold; }
              .priority-high { background: #fee2e2; color: #dc2626; }
              .priority-medium { background: #fef3c7; color: #f59e0b; }
              .priority-low { background: #dbeafe; color: #3b82f6; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>💡 Cost Optimization</h1>
                <p>AI-Powered Savings Recommendations</p>
              </div>
              <div class="content">
                <div class="savings-highlight">
                  <div style="font-size: 14px; color: #6b7280; margin-bottom: 10px;">Potential Annual Savings</div>
                  <div class="savings-value">$${d.totalSavings?.toLocaleString() || '0'}</div>
                </div>
                ${d.optimizations && d.optimizations.length > 0 ? `
                  <div class="optimization-list">
                    <h3>Top Recommendations</h3>
                    ${d.optimizations.slice(0, 5).map(opt => `
                      <div class="optimization-item">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                          <strong>${opt.title}</strong>
                          <span class="priority-badge priority-${opt.priority}">${opt.priority.toUpperCase()}</span>
                        </div>
                        <div style="color: #10b981; font-weight: bold;">Save $${opt.savings.toLocaleString()}/year</div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}
                <p>Review the complete cost optimization dashboard for detailed implementation steps and impact analysis.</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Cost Optimization Recommendations\n\nPotential Annual Savings: $${d.totalSavings?.toLocaleString() || '0'}\n\n${d.optimizations && d.optimizations.length > 0 ? `Top Recommendations:\n${d.optimizations.slice(0, 5).map(opt => `- ${opt.title} (${opt.priority.toUpperCase()}): Save $${opt.savings.toLocaleString()}/year`).join('\n')}\n\n` : ''}Review the complete cost optimization dashboard for detailed implementation steps and impact analysis.`,
      }),
    };

    return templates[type](data);
  }

  /**
   * Send email with retry logic
   */
  async sendEmail(
    to: string,
    templateType: EmailTemplateType,
    data: EmailData,
    maxRetries: number = 3
  ): Promise<EmailDeliveryResult> {
    if (!this.transporter) {
      return {
        success: false,
        error: 'Email service not initialized',
        retryCount: 0,
        timestamp: new Date(),
      };
    }

    const template = this.getTemplate(templateType, data);
    let lastError: string = '';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const info = await this.transporter.sendMail({
          from: '"Porter Family Intelligence" <noreply@porterfamily.ai>',
          to,
          subject: template.subject,
          text: template.text,
          html: template.html,
        });

        console.log(`[EmailService] Email sent successfully: ${info.messageId}`);
        return {
          success: true,
          messageId: info.messageId,
          retryCount: attempt,
          timestamp: new Date(),
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[EmailService] Attempt ${attempt + 1} failed:`, lastError);
        
        if (attempt < maxRetries - 1) {
          // Exponential backoff: 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    return {
      success: false,
      error: lastError,
      retryCount: maxRetries,
      timestamp: new Date(),
    };
  }

  /**
   * Add email to queue
   */
  addToQueue(
    to: string,
    templateType: EmailTemplateType,
    data: EmailData,
    scheduledFor?: Date,
    maxRetries: number = 3
  ): string {
    const id = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.queue.push({
      id,
      to,
      templateType,
      data,
      scheduledFor,
      retryCount: 0,
      maxRetries,
      status: 'pending',
    });

    console.log(`[EmailService] Added to queue: ${id}`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }

    return id;
  }

  /**
   * Process email queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`[EmailService] Processing queue: ${this.queue.length} items`);

    while (this.queue.length > 0) {
      const item = this.queue[0];

      // Check if scheduled for future
      if (item.scheduledFor && item.scheduledFor > new Date()) {
        // Skip this item for now, will be processed later
        this.queue.shift();
        this.queue.push(item); // Move to end of queue
        continue;
      }

      // Update status
      item.status = 'sending';
      item.lastAttempt = new Date();

      // Send email
      const result = await this.sendEmail(
        item.to,
        item.templateType,
        item.data,
        item.maxRetries - item.retryCount
      );

      item.result = result;
      item.retryCount += result.retryCount;

      if (result.success) {
        item.status = 'sent';
        this.queue.shift(); // Remove from queue
      } else if (item.retryCount >= item.maxRetries) {
        item.status = 'failed';
        this.queue.shift(); // Remove from queue
        console.error(`[EmailService] Email failed after ${item.retryCount} attempts: ${item.id}`);
      } else {
        // Retry later
        item.status = 'pending';
        this.queue.shift();
        this.queue.push(item); // Move to end of queue
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    this.isProcessing = false;
    console.log('[EmailService] Queue processing complete');
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    total: number;
    pending: number;
    sending: number;
    sent: number;
    failed: number;
  } {
    return {
      total: this.queue.length,
      pending: this.queue.filter(i => i.status === 'pending').length,
      sending: this.queue.filter(i => i.status === 'sending').length,
      sent: this.queue.filter(i => i.status === 'sent').length,
      failed: this.queue.filter(i => i.status === 'failed').length,
    };
  }

  /**
   * Get queue items
   */
  getQueueItems(): EmailQueueItem[] {
    return [...this.queue];
  }

  /**
   * Clear completed items from queue
   */
  clearCompleted(): number {
    const initialLength = this.queue.length;
    this.queue = this.queue.filter(i => i.status !== 'sent');
    return initialLength - this.queue.length;
  }
}

// Singleton instance
export const emailService = new EmailService();
