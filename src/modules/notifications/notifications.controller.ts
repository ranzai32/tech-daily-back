import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { NotificationsService } from './notifications.service';
import { SubscribeNotificationsDto } from './dto/subscribe.dto';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('subscribe')
  subscribe(
    @CurrentUser() user: User,
    @Body() dto: SubscribeNotificationsDto,
  ) {
    return this.notificationsService.subscribe(
      user.id,
      dto.fcm_token,
      dto.frequency,
    );
  }
}
