import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminOnlyGuard } from '../auth/guards/admin-only.guard';
import { SuggestionsService } from './suggestions.service';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { UpdateSuggestionStatusDto } from './dto/update-suggestion-status.dto';
import { User } from '../auth/entities/user.entity';

@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Request() req: { user: User },
    @Body() dto: CreateSuggestionDto,
  ) {
    return this.suggestionsService.create(req.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminOnlyGuard)
  findAllForAdmin() {
    return this.suggestionsService.findAllForAdmin();
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, AdminOnlyGuard)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateSuggestionStatusDto) {
    return this.suggestionsService.updateStatus(id, dto.status);
  }
}
