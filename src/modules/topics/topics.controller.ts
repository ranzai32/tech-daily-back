import { Controller, Get, Param } from '@nestjs/common';
import { TopicsService } from './topics.service';

@Controller('topics')
export class TopicsController {
  constructor(private readonly topicsService: TopicsService) {}

  @Get()
  findAll() {
    return this.topicsService.findAll();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.topicsService.findById(id);
  }
}
