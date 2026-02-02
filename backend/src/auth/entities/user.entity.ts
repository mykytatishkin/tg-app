import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

export enum AuthProvider {
  TELEGRAM = 'telegram',
  INSTAGRAM = 'instagram',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  telegramId: string;

  @Column({ type: 'varchar', nullable: true })
  instagramId: string | null;

  @Column({ type: 'varchar' })
  firstName: string;

  @Column({ type: 'varchar', nullable: true })
  lastName: string | null;

  @Column({ type: 'varchar', nullable: true })
  username: string | null;

  @Column({ type: 'varchar', nullable: true })
  languageCode: string | null;

  @Column({ type: 'varchar', nullable: true })
  photoUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ default: false })
  isMaster: boolean;

  @Column({ default: false })
  isAdmin: boolean;

  /** Варианты напитков для клиента перед сеансом (кнопки в напоминании). */
  @Column({ type: 'json', nullable: true })
  drinkOptions: string[] | null;

  /** Варианты «что понравилось» для отзыва после сеанса. */
  @Column({ type: 'json', nullable: true })
  feedbackOptions: string[] | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
