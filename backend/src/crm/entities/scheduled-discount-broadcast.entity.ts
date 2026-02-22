import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('scheduled_discount_broadcasts')
export class ScheduledDiscountBroadcast {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  masterId: string;

  @Column({ type: 'timestamp' })
  runAt: Date;
}
