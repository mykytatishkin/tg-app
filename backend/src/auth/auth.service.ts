import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { TelegramUser } from './guards/telegram-init.guard';
import { BotService } from '../bot/bot.service';

export interface AuthResult {
  accessToken: string;
  user: Omit<User, never>;
}

export interface BroadcastResult {
  sent: number;
  failed: number;
  total: number;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
    private botService: BotService,
  ) {}

  async loginWithTelegram(telegramUser: TelegramUser): Promise<AuthResult> {
    let user = await this.userRepository.findOne({
      where: { telegramId: String(telegramUser.id) },
    });

    if (!user) {
      user = this.userRepository.create({
        telegramId: String(telegramUser.id),
        firstName: telegramUser.first_name,
        lastName: telegramUser.last_name ?? null,
        username: telegramUser.username ?? null,
        languageCode: telegramUser.language_code ?? null,
        photoUrl: telegramUser.photo_url ?? null,
      });
      await this.userRepository.save(user);
    } else {
      user.firstName = telegramUser.first_name;
      user.lastName = telegramUser.last_name ?? null;
      user.username = telegramUser.username ?? null;
      user.languageCode = telegramUser.language_code ?? null;
      user.photoUrl = telegramUser.photo_url ?? null;
      await this.userRepository.save(user);
    }

    const payload = {
      sub: user.id,
      telegramId: user.telegramId,
      type: 'telegram',
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    return this.sanitizeUser(user);
  }

  async linkInstagram(userId: string, instagramId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    user.instagramId = instagramId;
    return this.userRepository.save(user);
  }

  async updateDrinkOptions(userId: string, drinkOptions: string[]): Promise<Omit<User, never>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    user.drinkOptions = drinkOptions.filter((s) => typeof s === 'string' && s.trim().length > 0);
    const saved = await this.userRepository.save(user);
    return this.sanitizeUser(saved);
  }

  /** Admin only: list all users with id, firstName, lastName, username, isMaster, isAdmin. */
  async getAllUsersForAdmin(): Promise<
    { id: string; firstName: string; lastName: string | null; username: string | null; isMaster: boolean; isAdmin: boolean }[]
  > {
    const users = await this.userRepository.find({
      select: ['id', 'firstName', 'lastName', 'username', 'isMaster', 'isAdmin'],
      order: { firstName: 'ASC', lastName: 'ASC' },
    });
    return users;
  }

  /** Admin only: get user by id (for viewing/editing drinkOptions etc.). */
  async getUserByIdForAdmin(userId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'firstName', 'lastName', 'username', 'isMaster', 'isAdmin', 'drinkOptions', 'feedbackOptions'],
    });
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  /** Admin only: update another user's drinkOptions. */
  async updateUserDrinkOptionsForAdmin(userId: string, drinkOptions: string[]) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');
    user.drinkOptions = drinkOptions.filter((s) => typeof s === 'string' && s.trim().length > 0);
    const saved = await this.userRepository.save(user);
    return { id: saved.id, drinkOptions: saved.drinkOptions };
  }

  /** Admin only: send message to all users (unique telegramId). Returns { sent, failed, total }. */
  async broadcastMessage(message: string): Promise<BroadcastResult> {
    const users = await this.userRepository.find({
      select: ['telegramId'],
    });
    const chatIds = new Set<string>();
    for (const u of users) {
      const id = u.telegramId?.trim();
      if (id) chatIds.add(id);
    }
    let sent = 0;
    let failed = 0;
    for (const chatId of chatIds) {
      const ok = await this.botService.sendMessage(chatId, message);
      if (ok) sent++;
      else failed++;
    }
    return { sent, failed, total: chatIds.size };
  }

  private sanitizeUser(user: User) {
    const { ...rest } = user;
    return rest;
  }
}
