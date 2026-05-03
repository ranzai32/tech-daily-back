import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/user.entity';
import { ConversionService } from './conversion.service';

@UseGuards(JwtAuthGuard)
@Controller('conversion')
export class ConversionController {
  constructor(private readonly conversionService: ConversionService) {}

  @Get('predict')
  predict(@CurrentUser() user: User) {
    return this.conversionService.predictConversion(user.id);
  }

  @Post('prompt-seen')
  promptSeen(@CurrentUser() user: User) {
    return this.conversionService.markPromptSeen(user.id);
  }

  @Post('convert')
  convert(@CurrentUser() user: User) {
    return this.conversionService.markConverted(user.id);
  }
}
