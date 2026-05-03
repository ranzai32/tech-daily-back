import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { LessonsService } from '../lessons/lessons.service';
import { RejectLessonDto } from './dto/reject-lesson.dto';

@Controller('admin/lessons')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminLessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get('pending')
  pending() {
    return this.lessonsService.findPendingReview();
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.lessonsService.approveLesson(id);
  }

  @Patch(':id/reject')
  reject(@Param('id') id: string, @Body() dto: RejectLessonDto) {
    return this.lessonsService.rejectLesson(id, dto.reason);
  }
}
