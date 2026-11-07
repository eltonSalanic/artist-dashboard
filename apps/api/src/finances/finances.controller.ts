import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  createFinanceEntrySchema,
  financeEntryQuerySchema,
  financeSummaryQuerySchema,
  updateFinanceEntrySchema,
  type BoardRole,
  type CreateFinanceEntryDto,
  type FinanceEntryQueryDto,
  type FinanceSummaryQueryDto,
  type UpdateFinanceEntryDto,
} from '@artist/shared';
import { CurrentUser, type AuthUser } from '../auth/current-user.decorator';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { FinancesService, type FinanceActor } from './finances.service';

interface RequestWithMembership {
  membership: { role: BoardRole };
}

const actorOf = (user: AuthUser, req: RequestWithMembership): FinanceActor => ({
  userId: user.userId,
  role: req.membership.role,
});

/**
 * Any member reaches these routes; what each may do once there is the shared
 * `can()` map, checked in the service.
 */
@Controller('boards/:boardId/finances')
@BoardRoles('USER')
export class FinancesController {
  constructor(private readonly finances: FinancesService) {}

  @Get('summary')
  summary(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
    @Query(new ZodValidationPipe(financeSummaryQuerySchema))
    query: FinanceSummaryQueryDto,
  ) {
    return this.finances.summary(boardId, actorOf(user, req), query);
  }

  @Get('entries')
  list(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
    @Query(new ZodValidationPipe(financeEntryQuerySchema))
    query: FinanceEntryQueryDto,
  ) {
    return this.finances.list(boardId, actorOf(user, req), query);
  }

  @Get('entries/:entryId')
  findOne(
    @Param('boardId') boardId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.finances.findOne(boardId, actorOf(user, req), entryId);
  }

  @Post('entries')
  create(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
    @Body(new ZodValidationPipe(createFinanceEntrySchema))
    dto: CreateFinanceEntryDto,
  ) {
    return this.finances.create(boardId, actorOf(user, req), dto);
  }

  @Patch('entries/:entryId')
  update(
    @Param('boardId') boardId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
    @Body(new ZodValidationPipe(updateFinanceEntrySchema))
    dto: UpdateFinanceEntryDto,
  ) {
    return this.finances.update(boardId, actorOf(user, req), entryId, dto);
  }

  @Post('entries/:entryId/void')
  void(
    @Param('boardId') boardId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.finances.void(boardId, actorOf(user, req), entryId);
  }

  /** An admin pays a member back for one out-of-pocket expense. */
  @Post('entries/:entryId/pay-back')
  payBack(
    @Param('boardId') boardId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.finances.payBack(boardId, actorOf(user, req), entryId);
  }

  @Post('entries/:entryId/undo-pay-back')
  undoPayBack(
    @Param('boardId') boardId: string,
    @Param('entryId') entryId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.finances.undoPayBack(boardId, actorOf(user, req), entryId);
  }

  /** Pays a member back for everything the band still owes them. */
  @Post('members/:userId/pay-back')
  payBackMember(
    @Param('boardId') boardId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.finances.payBackMember(boardId, actorOf(user, req), userId);
  }

  @Get('shows/:eventId')
  showSettlement(
    @Param('boardId') boardId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.finances.showSettlement(boardId, actorOf(user, req), eventId);
  }
}
