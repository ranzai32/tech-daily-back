import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStreak } from './streak.entity';
import { StreaksService } from './streaks.service';
import { StreaksController } from './streaks.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserStreak])],
  providers: [StreaksService],
  controllers: [StreaksController],
  exports: [StreaksService],
})
export class StreaksModule {}
