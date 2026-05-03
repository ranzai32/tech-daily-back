import {
  Controller,
  HttpCode,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BookmarksService } from './bookmarks.service';
import { User } from '../users/user.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

class AddBookmarkDto {
  @IsUUID()
  lesson_id: string;
}

@UseGuards(JwtAuthGuard)
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() pagination: PaginationDto) {
    return this.bookmarksService.findPage(user.id, pagination);
  }

  @Post()
  add(@CurrentUser() user: User, @Body() dto: AddBookmarkDto) {
    return this.bookmarksService.add(user.id, dto.lesson_id);
  }

  @Delete(':lessonId')
  @HttpCode(204)
  remove(
    @CurrentUser() user: User,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ) {
    return this.bookmarksService.removeByIdOrLesson(user.id, lessonId);
  }
}
