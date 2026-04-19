import { notifyOwner } from '../_core/notification';

/**
 * Payment Notification Service
 * 
 * Sends notifications for payment-related events using the built-in
 * notification system.
 */

interface ProductPurchaseData {
  userName: string;
  userEmail: string;
  productName: string;
  amount: number;
  currency: string;
  receiptUrl?: string;
}

interface SubscriptionData {
  userName: string;
  userEmail: string;
  planName: string;
  amount: number;
  currency: string;
  interval: string;
  trialEnd?: Date;
  currentPeriodEnd?: Date;
}

interface PaymentFailedData {
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  reason?: string;
}

/**
 * Notify owner when a product is purchased
 */
export async function notifyProductPurchase(data: ProductPurchaseData): Promise<boolean> {
  const { userName, userEmail, productName, amount, currency, receiptUrl } = data;
  
  const title = '🎉 New Product Purchase';
  const content = `
**Customer:** ${userName} (${userEmail})
**Product:** ${productName}
**Amount:** ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}
${receiptUrl ? `**Receipt:** ${receiptUrl}` : ''}

A customer has successfully purchased a product!
  `.trim();
  
  return await notifyOwner({ title, content });
}

/**
 * Notify owner when a new subscription is created
 */
export async function notifySubscriptionCreated(data: SubscriptionData): Promise<boolean> {
  const { userName, userEmail, planName, amount, currency, interval, trialEnd } = data;
  
  const title = '🚀 New Subscription';
  const content = `
**Customer:** ${userName} (${userEmail})
**Plan:** ${planName}
**Amount:** ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}/${interval}
${trialEnd ? `**Trial Ends:** ${trialEnd.toLocaleDateString()}` : '**Status:** Active immediately'}

A new customer has subscribed to your service!
  `.trim();
  
  return await notifyOwner({ title, content });
}

/**
 * Notify owner when a subscription is canceled
 */
export async function notifySubscriptionCanceled(data: SubscriptionData): Promise<boolean> {
  const { userName, userEmail, planName, currentPeriodEnd } = data;
  
  const title = '⚠️ Subscription Canceled';
  const content = `
**Customer:** ${userName} (${userEmail})
**Plan:** ${planName}
${currentPeriodEnd ? `**Access Until:** ${currentPeriodEnd.toLocaleDateString()}` : ''}

A customer has canceled their subscription.
  `.trim();
  
  return await notifyOwner({ title, content });
}

/**
 * Notify owner when a payment fails
 */
export async function notifyPaymentFailed(data: PaymentFailedData): Promise<boolean> {
  const { userName, userEmail, amount, currency, reason } = data;
  
  const title = '❌ Payment Failed';
  const content = `
**Customer:** ${userName} (${userEmail})
**Amount:** ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}
${reason ? `**Reason:** ${reason}` : ''}

A payment attempt has failed. The customer may need assistance.
  `.trim();
  
  return await notifyOwner({ title, content });
}

/**
 * Notify owner when an invoice is paid
 */
export async function notifyInvoicePaid(data: {
  userName: string;
  userEmail: string;
  amount: number;
  currency: string;
  invoiceUrl?: string;
}): Promise<boolean> {
  const { userName, userEmail, amount, currency, invoiceUrl } = data;
  
  const title = '💰 Invoice Paid';
  const content = `
**Customer:** ${userName} (${userEmail})
**Amount:** ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}
${invoiceUrl ? `**Invoice:** ${invoiceUrl}` : ''}

A customer has successfully paid an invoice.
  `.trim();
  
  return await notifyOwner({ title, content });
}

/**
 * Notify owner of subscription renewal
 */
export async function notifySubscriptionRenewed(data: SubscriptionData): Promise<boolean> {
  const { userName, userEmail, planName, amount, currency, currentPeriodEnd } = data;
  
  const title = '🔄 Subscription Renewed';
  const content = `
**Customer:** ${userName} (${userEmail})
**Plan:** ${planName}
**Amount:** ${(amount / 100).toFixed(2)} ${currency.toUpperCase()}
${currentPeriodEnd ? `**Next Renewal:** ${currentPeriodEnd.toLocaleDateString()}` : ''}

A subscription has been successfully renewed.
  `.trim();
  
  return await notifyOwner({ title, content });
}
