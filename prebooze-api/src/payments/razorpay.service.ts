import { Injectable, BadRequestException } from '@nestjs/common';

// DEPRECATED: Razorpay subscriptions removed 2026-09-21. This service
// is kept as a stub ONLY to maintain historical refund operations
// on past Razorpay payments and to satisfy type dependencies.
// All subscription endpoints are disabled - do not use for new features.

@Injectable()
export class RazorpayService {
  live = false;

  async createPlan() {
    throw new BadRequestException('Razorpay subscriptions are disabled');
  }

  async createSubscription() {
    throw new BadRequestException('Razorpay subscriptions are disabled');
  }

  async cancelSubscription() {
    throw new BadRequestException('Razorpay subscriptions are disabled');
  }

  async getOrder() {
    throw new BadRequestException('Razorpay deprecated');
  }

  async refund() {
    throw new BadRequestException('Refunds via Razorpay are disabled');
  }

  async getPaymentFee() {
    return null;
  }

  async getPayment(): Promise<any> {
    return { id: '', amount: 0 };
  }

  verifyWebhookSignature() {
    return false;
  }

  signPayment() {
    return '';
  }
}
