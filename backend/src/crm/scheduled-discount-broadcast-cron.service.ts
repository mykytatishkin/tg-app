import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { CrmService } from './crm.service';

const INTERVAL_MS = 5 * 60 * 1000; // 5 min

@Injectable()
export class ScheduledDiscountBroadcastCronService implements OnModuleInit, OnModuleDestroy {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private crmService: CrmService) {}

  onModuleInit() {
    this.crmService.processScheduledDiscountBroadcasts().catch((err) => {
      console.error('ScheduledDiscountBroadcastCronService init run error:', err);
    });
    this.intervalId = setInterval(() => {
      this.crmService.processScheduledDiscountBroadcasts().catch((err) => {
        console.error('ScheduledDiscountBroadcastCronService interval error:', err);
      });
    }, INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.intervalId) clearInterval(this.intervalId);
  }
}
