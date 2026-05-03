import { Controller, Get, Post, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { TopicsService } from '../topics/topics.service';
import { UserResponseDto } from '../auth/dto/user-response.dto';
import { SaveTopicsDto } from './dto/save-topics.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { User } from './user.entity';
import { Topic } from '../topics/topic.entity';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly topicsService: TopicsService,
  ) {}

  @Get('me')
  getMe(@CurrentUser() user: User): UserResponseDto {
    return UserResponseDto.from(user);
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() user: User,
    @Body() body: { fullName?: string },
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.update(user.id, body);
    return UserResponseDto.from(updated);
  }

  @Post('topics')
  saveTopics(
    @CurrentUser() user: User,
    @Body() dto: SaveTopicsDto,
  ): Promise<Topic[]> {
    return this.topicsService.saveUserTopics(user.id, dto.topic_ids);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: User) {
    return this.usersService.getProfile(user.id);
  }

  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserResponseDto> {
    const updated = await this.usersService.updateProfile(user.id, dto);
    return UserResponseDto.from(updated);
  }
}
