import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Giveaway } from './giveaway.entity';

@Entity('giveaway_participants')
@Unique(['giveawayId', 'userId'])
export class GiveawayParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  giveawayId: string;

  @ManyToOne(() => Giveaway, (g) => g.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'giveawayId' })
  giveaway: Giveaway;

  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}
