import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { ConversionService } from './conversion.service';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminAnalyticsController {
  constructor(private readonly conversionService: ConversionService) {}

  @Get('analytics')
  getAnalytics() {
    return this.conversionService.getAdminAnalytics();
  }
}
