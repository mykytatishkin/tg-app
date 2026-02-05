import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Suggestion, SUGGESTION_STATUS_LABELS, type SuggestionStatus } from './entities/suggestion.entity';
import { User } from '../auth/entities/user.entity';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { BotService } from '../bot/bot.service';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class SuggestionsService {
  constructor(
    @InjectRepository(Suggestion)
    private suggestionRepo: Repository<Suggestion>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private botService: BotService,
  ) {}

  async create(userId: string, dto: CreateSuggestionDto) {
    const suggestion = this.suggestionRepo.create({
      userId,
      text: dto.text.trim(),
      category: dto.category,
      status: 'pending',
    });
    const saved = await this.suggestionRepo.save(suggestion);
    await this.notifyAdmins(saved);
    return { id: saved.id, createdAt: saved.createdAt, status: saved.status };
  }

  private async notifyAdmins(suggestion: Suggestion) {
    const admins = await this.userRepo.find({
      where: { isAdmin: true },
      select: ['telegramId'],
    });
    const author = await this.userRepo.findOne({
      where: { id: suggestion.userId },
      select: ['firstName', 'lastName', 'username'],
    });
    const authorName = author
      ? [author.firstName, author.lastName].filter(Boolean).join(' ') || author.username || 'Пользователь'
      : 'Пользователь';
    const textShort =
      suggestion.text.length > 200 ? suggestion.text.slice(0, 200) + '…' : suggestion.text;
    const message = `📩 <b>Новое предложение</b>\nКатегория: ${escapeHtml(suggestion.category)}\nОт: ${escapeHtml(authorName)}\n\n${escapeHtml(textShort)}`;
    const chatIds = new Set<string>();
    for (const a of admins) {
      const id = a.telegramId?.trim();
      if (id) chatIds.add(id);
    }
    for (const chatId of chatIds) {
      await this.botService.sendMessage(chatId, message);
    }
  }

  async findAllForAdmin() {
    const list = await this.suggestionRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return list.map((s) => ({
      id: s.id,
      text: s.text,
      category: s.category,
      status: s.status,
      createdAt: s.createdAt,
      user: s.user
        ? {
            id: s.user.id,
            firstName: s.user.firstName,
            lastName: s.user.lastName,
            username: s.user.username,
          }
        : null,
    }));
  }

  async updateStatus(id: string, status: 'accepted' | 'rejected') {
    const suggestion = await this.suggestionRepo.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!suggestion) return null;
    suggestion.status = status;
    const saved = await this.suggestionRepo.save(suggestion);
    await this.notifyAuthorAboutDecision(saved);
    return { id: saved.id, status: saved.status };
  }

  private async notifyAuthorAboutDecision(suggestion: Suggestion) {
    const author = suggestion.user;
    if (!author?.telegramId?.trim()) return;
    const label = SUGGESTION_STATUS_LABELS[suggestion.status as SuggestionStatus];
    const textShort =
      suggestion.text.length > 150 ? suggestion.text.slice(0, 150) + '…' : suggestion.text;
    const message =
      suggestion.status === 'accepted'
        ? `✅ Разработчик принял ваше предложение.\n\nКатегория: ${escapeHtml(suggestion.category)}\n«${escapeHtml(textShort)}»`
        : `❌ Разработчик отклонил предложение.\n\nКатегория: ${escapeHtml(suggestion.category)}\n«${escapeHtml(textShort)}»`;
    await this.botService.sendMessage(author.telegramId.trim(), message);
  }
}
