import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { StreaksService } from './streaks.service';
import { User } from '../users/user.entity';

@UseGuards(JwtAuthGuard)
@Controller('streaks')
export class StreaksController {
  constructor(private readonly streaksService: StreaksService) {}

  @Get('me')
  getMe(@CurrentUser() user: User) {
    return this.streaksService.getMePayload(user.id);
  }

  @Post('me/update')
  async update(@CurrentUser() user: User) {
    await this.streaksService.updateStreak(user.id);
    return this.streaksService.getMePayload(user.id);
  }
}
