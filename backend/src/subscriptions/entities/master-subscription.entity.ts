import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum SubscriptionTier {
  STARTER = 'starter',
  PRO = 'pro',
  BUSINESS = 'business',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

export const TIER_LIMITS: Record<SubscriptionTier, { slotsPerMonth: number | null; portfolio: boolean; broadcast: boolean }> = {
  [SubscriptionTier.STARTER]: { slotsPerMonth: 30, portfolio: false, broadcast: false },
  [SubscriptionTier.PRO]: { slotsPerMonth: null, portfolio: true, broadcast: true },
  [SubscriptionTier.BUSINESS]: { slotsPerMonth: null, portfolio: true, broadcast: true },
};

@Entity('master_subscriptions')
export class MasterSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  masterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'masterId' })
  master: User;

  @Column({ type: 'varchar', default: SubscriptionTier.STARTER })
  tier: SubscriptionTier;

  @Column({ type: 'varchar', default: SubscriptionStatus.ACTIVE })
  status: SubscriptionStatus;

  @Column({ type: 'timestamp', nullable: true })
  validUntil: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
