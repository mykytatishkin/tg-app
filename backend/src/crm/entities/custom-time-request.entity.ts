import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Client } from './client.entity';
import { Service } from './service.entity';
import { Appointment } from './appointment.entity';

export type CustomTimeRequestStatus = 'pending' | 'accepted' | 'declined';

@Entity('custom_time_requests')
export class CustomTimeRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  clientId: string;

  @ManyToOne(() => Client, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clientId' })
  client: Client;

  @Column({ type: 'varchar' })
  masterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'masterId' })
  master: User;

  @Column({ type: 'varchar' })
  serviceId: string;

  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'serviceId' })
  service: Service;

  @Column({ type: 'date' })
  requestedDate: string;

  @Column({ type: 'time' })
  requestedStartTime: string;

  @Column({ type: 'time' })
  requestedEndTime: string;

  @Column({ type: 'varchar', length: 32, default: 'pending' })
  status: CustomTimeRequestStatus;

  /** Fee in € (e.g. +15, +10, +5 by rules). */
  @Column({ type: 'decimal', precision: 10, scale: 2 })
  feeAmount: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamp', nullable: true })
  acceptedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  declinedAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  appointmentId: string | null;

  @ManyToOne(() => Appointment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'appointmentId' })
  appointment: Appointment | null;

  @CreateDateColumn()
  createdAt: Date;
}
