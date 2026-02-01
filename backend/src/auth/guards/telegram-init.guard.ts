import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { validate, parse } from '@tma.js/init-data-node';
import { ConfigService } from '@nestjs/config';

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
}

@Injectable()
export class TelegramInitGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const initData = request.body?.initData ?? request.headers['x-telegram-init-data'];

    if (!initData) {
      throw new UnauthorizedException('Telegram initData is required');
    }

    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) {
      throw new UnauthorizedException('Bot token not configured');
    }

    try {
      validate(initData, botToken);
      const parsed = parse(initData);
      request.telegramUser = parsed.user as TelegramUser;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid Telegram initData');
    }
  }
}
