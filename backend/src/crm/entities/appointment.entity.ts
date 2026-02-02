import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Client } from './client.entity';
import { Service } from './service.entity';
import { AvailabilitySlot } from './availability-slot.entity';
import { AppointmentFeedback } from './appointment-feedback.entity';

export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export enum AppointmentSource {
  SELF = 'self',
  MANUAL = 'manual',
}

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ type: 'varchar', nullable: true })
  serviceId: string | null;

  @ManyToOne(() => Service, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'serviceId' })
  service: Service | null;

  @Column({ type: 'varchar', nullable: true })
  slotId: string | null;

  @ManyToOne(() => AvailabilitySlot, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'slotId' })
  slot: AvailabilitySlot | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'varchar' })
  masterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'masterId' })
  master: User;

  @Column({
    type: 'varchar',
    default: AppointmentStatus.SCHEDULED,
  })
  status: AppointmentStatus;

  @Column({
    type: 'varchar',
    default: AppointmentSource.MANUAL,
  })
  source: AppointmentSource;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', nullable: true })
  referenceImageUrl: string | null;

  /** Final price set by master (e.g. for "by reference" design). */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  finalPrice: number | null;

  @Column({ type: 'boolean', default: false })
  withDiscount: boolean;

  @Column({ type: 'varchar', nullable: true })
  discountLabel: string | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  discountPercent: number | null;

  @Column({ type: 'boolean', default: false })
  reminderEnabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  reminderSentAt: Date | null;

  /** Напоминание «желаете что-то выпить?» отправлено за 5–10 мин до сеанса. */
  @Column({ type: 'timestamp', nullable: true })
  preSessionReminderSentAt: Date | null;

  /** Когда бот отправил клиенту запрос отзыва (чтобы не слать повторно). */
  @Column({ type: 'timestamp', nullable: true })
  feedbackRequestedAt: Date | null;

  /** Причина отмены (при status = CANCELLED). */
  @Column({ type: 'text', nullable: true })
  cancellationReason: string | null;

  /** Кто отменил: client | master. */
  @Column({ type: 'varchar', nullable: true })
  cancelledBy: 'client' | 'master' | null;

  @OneToOne(() => AppointmentFeedback, (fb) => fb.appointment, { nullable: true })
  feedback: AppointmentFeedback | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
