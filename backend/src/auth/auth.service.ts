import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { TelegramUser } from './guards/telegram-init.guard';

export interface AuthResult {
  accessToken: string;
  user: Omit<User, never>;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
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

  async linkInstagram(userId: string, instagramId: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();
    user.instagramId = instagramId;
    return this.userRepository.save(user);
  }

  private sanitizeUser(user: User) {
    const { ...rest } = user;
    return rest;
  }
}
