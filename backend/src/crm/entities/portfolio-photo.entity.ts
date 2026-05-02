import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity('portfolio_photos')
export class PortfolioPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  masterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'masterId' })
  master: User;

  /** Relative path: /uploads/portfolio/<filename> */
  @Column({ type: 'varchar' })
  url: string;

  /** Optional free-text tag (e.g. service name) */
  @Column({ type: 'varchar', nullable: true })
  tag: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
