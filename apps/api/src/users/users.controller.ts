import { Controller, Get, Post } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { UsersService } from './users.service';

@Controller('me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post('bootstrap')
  bootstrap(@CurrentUser() user: AuthUser) {
    return this.users.bootstrap(user);
  }

  @Get()
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user);
  }
}
