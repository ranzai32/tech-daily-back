import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LessonsService } from './lessons.service';
import { PaginationDto } from '../../common/dto/pagination.dto';

@UseGuards(JwtAuthGuard)
@Controller('lessons')
export class LessonsController {
  constructor(private readonly lessonsService: LessonsService) {}

  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.lessonsService.findAll(pagination);
  }

  @Get('topic/:topicId')
  findByTopic(@Param('topicId') topicId: string) {
    return this.lessonsService.findByTopic(topicId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.lessonsService.findById(id);
  }
}
