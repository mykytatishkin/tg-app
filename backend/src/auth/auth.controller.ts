import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { TelegramInitGuard } from './guards/telegram-init.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram')
  @UseGuards(TelegramInitGuard)
  async loginWithTelegram(
    @Body() _dto: TelegramAuthDto,
    @Request() req: { telegramUser: { id: number; first_name: string; last_name?: string; username?: string; language_code?: string; photo_url?: string } },
  ) {
    return this.authService.loginWithTelegram(req.telegramUser);
  }

  @Post('instagram/link')
  @UseGuards(JwtAuthGuard)
  async linkInstagram(
    @Request() req: { user: { id: string } },
    @Body() body: { instagramId: string },
  ) {
    return this.authService.linkInstagram(req.user.id, body.instagramId);
  }
}
