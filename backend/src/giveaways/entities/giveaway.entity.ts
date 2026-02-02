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
import { GiveawayParticipant } from './giveaway-participant.entity';
import { GiveawayWinner } from './giveaway-winner.entity';

export enum GiveawayStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ENDED = 'ended',
}

@Entity('giveaways')
export class Giveaway {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'timestamp' })
  startAt: Date;

  @Column({ type: 'timestamp' })
  endAt: Date;

  @Column({
    type: 'varchar',
    default: GiveawayStatus.DRAFT,
  })
  status: GiveawayStatus;

  /** Number of winners to draw. Default 1. */
  @Column({ type: 'int', default: 1 })
  winnerCount: number;

  /** Optional conditions: [{ type: 'follow_instagram', value: 'url' }, ...] */
  @Column({ type: 'jsonb', nullable: true })
  conditions: { type: string; value?: string }[] | null;

  /** When true, participant must submit a link proving they fulfilled conditions. */
  @Column({ type: 'boolean', default: false })
  requireConditionsProof: boolean;

  @Column({ type: 'varchar' })
  masterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'masterId' })
  master: User;

  @OneToMany(() => GiveawayParticipant, (p) => p.giveaway)
  participants: GiveawayParticipant[];

  @OneToMany(() => GiveawayWinner, (w) => w.giveaway)
  winners: GiveawayWinner[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
