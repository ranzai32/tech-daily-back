import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BookmarksService } from './bookmarks.service';
import { User } from '../users/user.entity';

class AddBookmarkDto {
  @IsUUID()
  lessonId: string;
}

@UseGuards(JwtAuthGuard)
@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  getAll(@CurrentUser() user: User) {
    return this.bookmarksService.getByUser(user.id);
  }

  @Post()
  add(@CurrentUser() user: User, @Body() dto: AddBookmarkDto) {
    return this.bookmarksService.add(user.id, dto.lessonId);
  }

  @Delete(':id')
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.bookmarksService.remove(id, user.id);
  }
}
