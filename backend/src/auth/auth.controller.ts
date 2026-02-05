import { Controller, Get, Post, Patch, Body, UseGuards, Request, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { BroadcastMessageDto } from './dto/broadcast-message.dto';
import { TelegramInitGuard } from './guards/telegram-init.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminOnlyGuard } from './guards/admin-only.guard';

@Controller('auth')
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

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: { user: import('./entities/user.entity').User }) {
    return this.authService.getMe(req.user.id);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(
    @Request() req: { user: import('./entities/user.entity').User },
    @Body() body: { drinkOptions?: string[] },
  ) {
    return this.authService.updateDrinkOptions(req.user.id, body.drinkOptions ?? []);
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, AdminOnlyGuard)
  async getAllUsers() {
    return this.authService.getAllUsersForAdmin();
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard, AdminOnlyGuard)
  async getUserById(@Param('id') id: string) {
    return this.authService.getUserByIdForAdmin(id);
  }

  @Patch('users/:id')
  @UseGuards(JwtAuthGuard, AdminOnlyGuard)
  async updateUser(
    @Param('id') id: string,
    @Body() body: { drinkOptions?: string[]; isAdmin?: boolean; isMaster?: boolean },
  ) {
    const updates: { drinkOptions?: string[]; isAdmin?: boolean; isMaster?: boolean } = {};
    if (body.drinkOptions !== undefined) updates.drinkOptions = body.drinkOptions;
    if (body.isAdmin !== undefined) updates.isAdmin = body.isAdmin;
    if (body.isMaster !== undefined) updates.isMaster = body.isMaster;
    return this.authService.updateUserForAdmin(id, updates);
  }

  @Post('broadcast')
  @UseGuards(JwtAuthGuard, AdminOnlyGuard)
  async broadcast(@Body() dto: BroadcastMessageDto) {
    const trimmed = dto.message.trim();
    if (!trimmed) {
      return { sent: 0, failed: 0, total: 0 };
    }
    return this.authService.broadcastMessage(trimmed);
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
