import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Giveaway, GiveawayStatus } from './entities/giveaway.entity';
import { GiveawayParticipant } from './entities/giveaway-participant.entity';
import { GiveawayWinner } from './entities/giveaway-winner.entity';
import { User } from '../auth/entities/user.entity';
import { CreateGiveawayDto } from './dto/create-giveaway.dto';
import { UpdateGiveawayDto } from './dto/update-giveaway.dto';
import { DrawGiveawayDto } from './dto/draw-giveaway.dto';
import { BotService } from '../bot/bot.service';

@Injectable()
export class GiveawaysService {
  constructor(
    @InjectRepository(Giveaway)
    private giveawayRepo: Repository<Giveaway>,
    @InjectRepository(GiveawayParticipant)
    private participantRepo: Repository<GiveawayParticipant>,
    @InjectRepository(GiveawayWinner)
    private winnerRepo: Repository<GiveawayWinner>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private botService: BotService,
  ) {}

  private async getMasterId(user: User): Promise<string> {
    if (user.isMaster) return user.id;
    const master = await this.userRepo.findOne({ where: { isMaster: true } });
    if (!master) throw new ForbiddenException('No master configured');
    return master.id;
  }

  private async getMasterIdOrNull(): Promise<string | null> {
    const master = await this.userRepo.findOne({ where: { isMaster: true } });
    return master?.id ?? null;
  }

  async getGiveaways(user: User, forMaster = false) {
    if (forMaster || user.isMaster || user.isAdmin) {
      const masterId = await this.getMasterId(user);
      return this.giveawayRepo.find({
        where: { masterId },
        order: { createdAt: 'DESC' },
        relations: ['master'],
      });
    }
    const masterId = await this.getMasterIdOrNull();
    if (!masterId) return [];
    return this.giveawayRepo.find({
      where: { status: GiveawayStatus.ACTIVE, masterId },
      order: { endAt: 'ASC' },
      relations: ['master'],
    });
  }

  async createGiveaway(user: User, dto: CreateGiveawayDto) {
    const masterId = await this.getMasterId(user);
    const giveaway = this.giveawayRepo.create({
      ...dto,
      masterId,
      startAt: new Date(dto.startAt),
      endAt: new Date(dto.endAt),
      winnerCount: dto.winnerCount ?? 1,
      status: GiveawayStatus.DRAFT,
    });
    return this.giveawayRepo.save(giveaway);
  }

  async getGiveaway(user: User, id: string) {
    const giveaway = await this.giveawayRepo.findOne({
      where: { id },
      relations: ['master', 'participants', 'participants.user', 'winners', 'winners.user'],
    });
    if (!giveaway) throw new NotFoundException('Giveaway not found');
    const masterId = user.isMaster ? user.id : (await this.getMasterIdOrNull()) ?? '';
    const isOwner = giveaway.masterId === masterId;
    const isMasterOrAdmin = user.isMaster || user.isAdmin;
    if (!isOwner && !isMasterOrAdmin) {
      if (giveaway.status !== GiveawayStatus.ACTIVE && giveaway.status !== GiveawayStatus.ENDED) {
        throw new ForbiddenException('Giveaway not available');
      }
    }
    return giveaway;
  }

  async updateGiveaway(user: User, id: string, dto: UpdateGiveawayDto) {
    const masterId = await this.getMasterId(user);
    const existing = await this.giveawayRepo.findOne({ where: { id, masterId } });
    if (!existing) throw new ForbiddenException('Giveaway not found');
    if (dto.startAt) (dto as any).startAt = new Date(dto.startAt);
    if (dto.endAt) (dto as any).endAt = new Date(dto.endAt);
    await this.giveawayRepo.update({ id, masterId }, dto);
    return this.getGiveaway(user, id);
  }

  async deleteGiveaway(user: User, id: string) {
    const masterId = await this.getMasterId(user);
    const result = await this.giveawayRepo.delete({ id, masterId });
    if (result.affected === 0) throw new ForbiddenException('Giveaway not found');
  }

  async participate(user: User, giveawayId: string) {
    const giveaway = await this.giveawayRepo.findOne({ where: { id: giveawayId } });
    if (!giveaway) throw new NotFoundException('Giveaway not found');
    if (giveaway.status !== GiveawayStatus.ACTIVE) {
      throw new BadRequestException('Giveaway is not active');
    }
    const now = new Date();
    if (now < giveaway.startAt) throw new BadRequestException('Giveaway has not started yet');
    if (now > giveaway.endAt) throw new BadRequestException('Giveaway has ended');
    const existing = await this.participantRepo.findOne({
      where: { giveawayId, userId: user.id },
    });
    if (existing) return { message: 'Already participating', participant: existing };
    const hasConditions = giveaway.conditions != null && giveaway.conditions.length > 0;
    const participant = this.participantRepo.create({
      giveawayId,
      userId: user.id,
      conditionsVerified: !hasConditions,
    });
    return this.participantRepo.save(participant);
  }

  async draw(user: User, giveawayId: string, dto?: DrawGiveawayDto) {
    const masterId = await this.getMasterId(user);
    const giveaway = await this.giveawayRepo.findOne({
      where: { id: giveawayId, masterId },
      relations: ['participants', 'participants.user'],
    });
    if (!giveaway) throw new ForbiddenException('Giveaway not found');
    if (giveaway.status === GiveawayStatus.ENDED) {
      const winners = await this.winnerRepo.find({
        where: { giveawayId },
        relations: ['user'],
      });
      return { message: 'Already drawn', winners };
    }
    const count = dto?.winnerCount ?? giveaway.winnerCount;
    const allParticipants = await this.participantRepo.find({
      where: { giveawayId },
      relations: ['user'],
    });
    const participants = allParticipants.filter((p) => p.conditionsVerified);
    if (participants.length === 0) {
      throw new BadRequestException(
        'No participants with verified conditions to draw from. Verify participants first.',
      );
    }
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const toSelect = Math.min(count, shuffled.length);
    const selected = shuffled.slice(0, toSelect);
    const winnerRecords = selected.map((p) =>
      this.winnerRepo.create({
        giveawayId,
        userId: p.userId,
        drawnAt: new Date(),
      }),
    );
    await this.winnerRepo.save(winnerRecords);
    await this.giveawayRepo.update(
      { id: giveawayId },
      { status: GiveawayStatus.ENDED },
    );
    for (const w of winnerRecords) {
      const u = selected.find((s) => s.userId === w.userId)?.user;
      if (u?.telegramId) {
        await this.botService.sendMessage(
          u.telegramId,
          `🎉 Поздравляем! Вы выиграли в розыгрыше «${giveaway.title}». Свяжитесь с мастером для получения приза.`,
        );
      }
    }
    return this.winnerRepo.find({
      where: { giveawayId },
      relations: ['user'],
    });
  }

  async getParticipants(user: User, giveawayId: string) {
    const masterId = await this.getMasterId(user);
    const giveaway = await this.giveawayRepo.findOne({ where: { id: giveawayId, masterId } });
    if (!giveaway) throw new ForbiddenException('Giveaway not found');
    return this.participantRepo.find({
      where: { giveawayId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });
  }

  /** Master manually marks that participant has fulfilled conditions. */
  async verifyParticipant(user: User, giveawayId: string, participantId: string) {
    const masterId = await this.getMasterId(user);
    const giveaway = await this.giveawayRepo.findOne({ where: { id: giveawayId, masterId } });
    if (!giveaway) throw new ForbiddenException('Giveaway not found');
    const participant = await this.participantRepo.findOne({
      where: { id: participantId, giveawayId },
      relations: ['user'],
    });
    if (!participant) throw new NotFoundException('Participant not found');
    participant.conditionsVerified = true;
    return this.participantRepo.save(participant);
  }

  async getWinners(giveawayId: string) {
    const giveaway = await this.giveawayRepo.findOne({ where: { id: giveawayId } });
    if (!giveaway) throw new NotFoundException('Giveaway not found');
    return this.winnerRepo.find({
      where: { giveawayId },
      relations: ['user'],
      order: { drawnAt: 'ASC' },
    });
  }
}
