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
import { Client } from './client.entity';
import { Service } from './service.entity';
import { AvailabilitySlot } from './availability-slot.entity';

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

  @Column({ type: 'varchar' })
  serviceId: string;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Column({ type: 'varchar', nullable: true })
  slotId: string | null;

  @ManyToOne(() => AvailabilitySlot, { nullable: true })
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

  @Column({ type: 'boolean', default: false })
  reminderEnabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  reminderSentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
