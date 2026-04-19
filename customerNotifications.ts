import { notifyOwner } from '../_core/notification';

/**
 * Customer Email Notification Service
 * 
 * Sends email notifications to customers for payment-related events.
 * Currently uses the owner notification system as a placeholder.
 * 
 * TODO: Integrate with email service (SendGrid, Resend, etc.) to send
 * actual emails to customers instead of just notifying the owner.
 */

interface CustomerEmailData {
  to: string;
  subject: string;
  body: string;
}

/**
 * Send email to customer (currently logs to owner notifications)
 */
async function sendCustomerEmail(data: CustomerEmailData): Promise<boolean> {
  const { to, subject, body } = data;
  
  // TODO: Replace with actual email service integration
  // For now, we'll notify the owner that an email should be sent
  return await notifyOwner({
    title: `📧 Customer Email: ${subject}`,
    content: `**To:** ${to}\n\n${body}`
  });
}

/**
 * Send purchase confirmation email to customer
 */
export async function sendPurchaseConfirmation(data: {
  customerEmail: string;
  customerName: string;
  productName: string;
  amount: number;
  currency: string;
  receiptUrl?: string;
}): Promise<boolean> {
  const { customerEmail, customerName, productName, amount, currency, receiptUrl } = data;
  
  const subject = `Purchase Confirmation - ${productName}`;
  const body = `
Hi ${customerName},

Thank you for your purchase! We've received your payment for ${productName}.

**Order Details:**
- Product: ${productName}
- Amount: ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}
${receiptUrl ? `- Receipt: ${receiptUrl}` : ''}

Your purchase is now complete and you have full access to your product.

If you have any questions, please don't hesitate to contact us.

Best regards,
The Luminous MastermindAI Team
  `.trim();
  
  return await sendCustomerEmail({
    to: customerEmail,
    subject,
    body
  });
}

/**
 * Send subscription welcome email to customer
 */
export async function sendSubscriptionWelcome(data: {
  customerEmail: string;
  customerName: string;
  planName: string;
  amount: number;
  currency: string;
  interval: string;
  trialEnd?: Date;
  nextBillingDate?: Date;
}): Promise<boolean> {
  const { customerEmail, customerName, planName, amount, currency, interval, trialEnd, nextBillingDate } = data;
  
  const subject = `Welcome to ${planName}!`;
  const body = `
Hi ${customerName},

Welcome to ${planName}! We're excited to have you on board.

**Subscription Details:**
- Plan: ${planName}
- Billing: ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}/${interval}
${trialEnd ? `- Trial Period: Until ${trialEnd.toLocaleDateString()}` : ''}
${nextBillingDate ? `- Next Billing Date: ${nextBillingDate.toLocaleDateString()}` : ''}

You now have access to all the features included in your plan. Get started by exploring your dashboard!

If you have any questions or need assistance, we're here to help.

Best regards,
The Luminous MastermindAI Team
  `.trim();
  
  return await sendCustomerEmail({
    to: customerEmail,
    subject,
    body
  });
}

/**
 * Send subscription renewal reminder
 */
export async function sendRenewalReminder(data: {
  customerEmail: string;
  customerName: string;
  planName: string;
  amount: number;
  currency: string;
  renewalDate: Date;
}): Promise<boolean> {
  const { customerEmail, customerName, planName, amount, currency, renewalDate } = data;
  
  const subject = `Your ${planName} subscription renews soon`;
  const body = `
Hi ${customerName},

This is a friendly reminder that your ${planName} subscription will renew on ${renewalDate.toLocaleDateString()}.

**Renewal Details:**
- Plan: ${planName}
- Amount: ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}
- Renewal Date: ${renewalDate.toLocaleDateString()}

Your payment method on file will be charged automatically. No action is required on your part.

If you need to update your payment method or make any changes to your subscription, you can do so in your billing portal.

Thank you for being a valued customer!

Best regards,
The Luminous MastermindAI Team
  `.trim();
  
  return await sendCustomerEmail({
    to: customerEmail,
    subject,
    body
  });
}

/**
 * Send subscription cancellation confirmation
 */
export async function sendCancellationConfirmation(data: {
  customerEmail: string;
  customerName: string;
  planName: string;
  accessUntil?: Date;
}): Promise<boolean> {
  const { customerEmail, customerName, planName, accessUntil } = data;
  
  const subject = `Subscription Cancellation Confirmed`;
  const body = `
Hi ${customerName},

We've received your request to cancel your ${planName} subscription.

${accessUntil ? `Your subscription will remain active until ${accessUntil.toLocaleDateString()}. You'll continue to have full access until then.` : 'Your subscription has been canceled.'}

We're sorry to see you go! If you have any feedback about your experience, we'd love to hear from you.

You can resubscribe at any time from your account dashboard.

Best regards,
The Luminous MastermindAI Team
  `.trim();
  
  return await sendCustomerEmail({
    to: customerEmail,
    subject,
    body
  });
}

/**
 * Send payment failure notification
 */
export async function sendPaymentFailedNotification(data: {
  customerEmail: string;
  customerName: string;
  amount: number;
  currency: string;
  reason?: string;
  retryDate?: Date;
}): Promise<boolean> {
  const { customerEmail, customerName, amount, currency, reason, retryDate } = data;
  
  const subject = `Payment Failed - Action Required`;
  const body = `
Hi ${customerName},

We were unable to process your payment of ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}.

${reason ? `Reason: ${reason}` : ''}

**What to do next:**
1. Update your payment method in your billing portal
2. Ensure your card has sufficient funds
3. Contact your bank if the issue persists

${retryDate ? `We'll automatically retry the payment on ${retryDate.toLocaleDateString()}.` : ''}

To avoid any interruption to your service, please update your payment information as soon as possible.

If you need assistance, please contact our support team.

Best regards,
The Luminous MastermindAI Team
  `.trim();
  
  return await sendCustomerEmail({
    to: customerEmail,
    subject,
    body
  });
}

/**
 * Send invoice receipt
 */
export async function sendInvoiceReceipt(data: {
  customerEmail: string;
  customerName: string;
  amount: number;
  currency: string;
  invoiceUrl?: string;
  pdfUrl?: string;
}): Promise<boolean> {
  const { customerEmail, customerName, amount, currency, invoiceUrl, pdfUrl } = data;
  
  const subject = `Receipt for your payment`;
  const body = `
Hi ${customerName},

Thank you for your payment! Here's your receipt.

**Payment Details:**
- Amount: ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}
${invoiceUrl ? `- View Invoice: ${invoiceUrl}` : ''}
${pdfUrl ? `- Download PDF: ${pdfUrl}` : ''}

This email serves as your receipt. Please keep it for your records.

If you have any questions about this payment, please contact us.

Best regards,
The Luminous MastermindAI Team
  `.trim();
  
  return await sendCustomerEmail({
    to: customerEmail,
    subject,
    body
  });
}
