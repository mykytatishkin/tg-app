import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Giveaway } from './giveaway.entity';

@Entity('giveaway_winners')
export class GiveawayWinner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  giveawayId: string;

  @ManyToOne(() => Giveaway, (g) => g.winners, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'giveawayId' })
  giveaway: Giveaway;

  @Column({ type: 'varchar' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'timestamp' })
  drawnAt: Date;
}
