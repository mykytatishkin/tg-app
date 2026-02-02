import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Service } from './service.entity';

@Entity('availability_slots')
export class AvailabilitySlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  masterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'masterId' })
  master: User;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ type: 'boolean', default: true })
  isAvailable: boolean;

  /** Price modifier for this slot: negative = discount, positive = extra charge. Null = no modifier. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  priceModifier: number | null;

  /** Slot for models: one booking per slot, service fixed by master at creation. */
  @Column({ type: 'boolean', default: false })
  forModels: boolean;

  /** For forModels slots: service chosen by master, client cannot change. */
  @Column({ type: 'varchar', nullable: true })
  serviceId: string | null;

  @ManyToOne(() => Service, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'serviceId' })
  service: Service | null;
}
