import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MasterSubscription, SubscriptionStatus, SubscriptionTier, TIER_LIMITS } from './entities/master-subscription.entity';
import { User } from '../auth/entities/user.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(MasterSubscription)
    private subRepo: Repository<MasterSubscription>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  /** Get or create subscription for a master (auto-creates STARTER active for new masters). */
  async getOrCreate(masterId: string): Promise<MasterSubscription> {
    let sub = await this.subRepo.findOne({ where: { masterId } });
    if (!sub) {
      sub = this.subRepo.create({
        masterId,
        tier: SubscriptionTier.STARTER,
        status: SubscriptionStatus.ACTIVE,
        validUntil: null,
      });
      await this.subRepo.save(sub);
    }
    return sub;
  }

  async getForMaster(masterId: string) {
    const sub = await this.getOrCreate(masterId);
    return this.toDto(sub);
  }

  /** List all master subscriptions (admin view). */
  async listAll() {
    const masters = await this.userRepo.find({ where: { isMaster: true } });
    const results = await Promise.all(
      masters.map(async (m) => {
        const sub = await this.getOrCreate(m.id);
        return {
          masterId: m.id,
          masterName: [m.firstName, m.lastName].filter(Boolean).join(' '),
          ...this.toDto(sub),
        };
      }),
    );
    return results;
  }

  /** Admin: set tier and extend validity. */
  async upsert(masterId: string, tier: SubscriptionTier, months: number) {
    const master = await this.userRepo.findOne({ where: { id: masterId, isMaster: true } });
    if (!master) throw new NotFoundException('Master not found');

    let sub = await this.subRepo.findOne({ where: { masterId } });
    if (!sub) {
      sub = this.subRepo.create({ masterId });
    }

    sub.tier = tier;
    sub.status = SubscriptionStatus.ACTIVE;

    const base = sub.validUntil && sub.validUntil > new Date() ? new Date(sub.validUntil) : new Date();
    base.setMonth(base.getMonth() + months);
    sub.validUntil = base;

    await this.subRepo.save(sub);
    return this.toDto(sub);
  }

  /** Admin: suspend or reactivate a subscription. */
  async setStatus(masterId: string, status: SubscriptionStatus) {
    const sub = await this.subRepo.findOne({ where: { masterId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    sub.status = status;
    await this.subRepo.save(sub);
    return this.toDto(sub);
  }

  /** Check if a master can accept new bookings. */
  async canBook(masterId: string): Promise<boolean> {
    const sub = await this.getOrCreate(masterId);
    if (sub.status !== SubscriptionStatus.ACTIVE) return false;
    if (sub.validUntil && sub.validUntil < new Date()) return false;
    return true;
  }

  /** Cron: auto-suspend expired subscriptions daily. */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoSuspendExpired() {
    const expired = await this.subRepo.find({
      where: {
        status: SubscriptionStatus.ACTIVE,
        validUntil: LessThan(new Date()),
      },
    });
    for (const sub of expired) {
      sub.status = SubscriptionStatus.EXPIRED;
      await this.subRepo.save(sub);
    }
    if (expired.length > 0) {
      console.log(`[Subscriptions] Auto-suspended ${expired.length} expired subscription(s).`);
    }
  }

  private toDto(sub: MasterSubscription) {
    const limits = TIER_LIMITS[sub.tier];
    return {
      id: sub.id,
      tier: sub.tier,
      status: sub.status,
      validUntil: sub.validUntil,
      limits,
      isActive: sub.status === SubscriptionStatus.ACTIVE && (!sub.validUntil || sub.validUntil > new Date()),
    };
  }
}
