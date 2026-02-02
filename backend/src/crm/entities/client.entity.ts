import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Appointment } from './appointment.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', nullable: true })
  telegramId: string | null;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  /** Instagram username or profile URL (no login required). */
  @Column({ type: 'varchar', nullable: true })
  instagram: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Invisible nickname set by master — only master sees it (not the client). */
  @Column({ type: 'varchar', nullable: true })
  masterNickname: string | null;

  /** Last time we sent "2 weeks since last visit" reminder (to avoid repeat spam). */
  @Column({ type: 'timestamp', nullable: true })
  lastReminderSentAt: Date | null;

  @Column({ type: 'varchar' })
  masterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'masterId' })
  master: User;

  @OneToMany(() => Appointment, (a) => a.client)
  appointments: Appointment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
