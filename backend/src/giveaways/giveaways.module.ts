import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GiveawaysController } from './giveaways.controller';
import { GiveawaysService } from './giveaways.service';
import { Giveaway } from './entities/giveaway.entity';
import { GiveawayParticipant } from './entities/giveaway-participant.entity';
import { GiveawayWinner } from './entities/giveaway-winner.entity';
import { User } from '../auth/entities/user.entity';
import { Client } from '../crm/entities/client.entity';
import { BotModule } from '../bot/bot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Giveaway, GiveawayParticipant, GiveawayWinner, User, Client]),
    BotModule,
  ],
  controllers: [GiveawaysController],
  providers: [GiveawaysService],
})
export class GiveawaysModule {}
