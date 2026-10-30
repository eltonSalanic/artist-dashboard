import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  boardThemeSchema,
  createBoardSchema,
  deleteBoardSchema,
  transferBoardSchema,
  updateBoardSchema,
  type BoardThemeDto,
  type CreateBoardDto,
  type DeleteBoardDto,
  type TransferBoardDto,
  type UpdateBoardDto,
} from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BoardsService } from './boards.service';

@Controller('boards')
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

  /**
   * No `@BoardRoles` — there is no board id in the path to guard on. The route
   * is scoped to the authenticated caller instead, and the service's `where`
   * clause is the whole of the authorisation.
   *
   * Declared before `:id` so the literal path is matched first.
   */
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.boards.findAllForUser(user.userId);
  }

  /**
   * Start a new band with the caller as its owner and admin. Like `findAll`,
   * no board guard. With billing enforced, the service wants a subscription
   * and no band already owned.
   */
  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(createBoardSchema)) dto: CreateBoardDto,
  ) {
    return this.boards.create(user.userId, dto);
  }

  @Get(':id')
  @BoardRoles('USER')
  findOne(@Param('id') id: string) {
    return this.boards.findOne(id);
  }

  @Patch(':id')
  @BoardRoles('ADMIN')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateBoardSchema)) dto: UpdateBoardDto,
  ) {
    return this.boards.update(id, dto);
  }

  @Put(':id/theme')
  @BoardRoles('ADMIN')
  saveTheme(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(boardThemeSchema)) dto: BoardThemeDto,
  ) {
    return this.boards.saveTheme(id, dto);
  }

  /** Owner only, checked in the service: the owner isn't a role. */
  @Delete(':id')
  @BoardRoles('USER')
  remove(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(deleteBoardSchema)) dto: DeleteBoardDto,
  ) {
    return this.boards.remove(id, user.userId, dto.name);
  }

  /** Owner only, as above. */
  @Post(':id/transfer')
  @BoardRoles('USER')
  transfer(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(transferBoardSchema)) dto: TransferBoardDto,
  ) {
    return this.boards.transfer(id, user.userId, dto.userId);
  }

  @Delete(':id/members/:userId')
  @BoardRoles('ADMIN')
  removeMember(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.boards.removeMember(id, user.userId, userId);
  }
}
