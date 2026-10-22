import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import {
  createFinanceEntrySchema,
  createPayoutSchema,
  financeEntryQuerySchema,
  financeSummaryQuerySchema,
  settleShowSchema,
  updateFinanceEntrySchema,
  updateFinanceSettingsSchema,
  updateSplitSchema,
  type BoardRole,
  type CreateFinanceEntryDto,
  type CreatePayoutDto,
  type FinanceEntryQueryDto,
  type FinanceSummaryQueryDto,
  type SettleShowDto,
  type UpdateFinanceEntryDto,
  type UpdateFinanceSettingsDto,
  type UpdateSplitDto,
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

  @Get('split')
  getSplit(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.finances.getSplit(boardId, actorOf(user, req));
  }

  @Put('split')
  setSplit(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
    @Body(new ZodValidationPipe(updateSplitSchema)) dto: UpdateSplitDto,
  ) {
    return this.finances.setSplit(boardId, actorOf(user, req), dto);
  }

  @Put('settings')
  setSettings(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
    @Body(new ZodValidationPipe(updateFinanceSettingsSchema))
    dto: UpdateFinanceSettingsDto,
  ) {
    return this.finances.setSettings(boardId, actorOf(user, req), dto);
  }

  @Get('payouts')
  listPayouts(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.finances.listPayouts(boardId, actorOf(user, req));
  }

  @Post('payouts')
  createPayout(
    @Param('boardId') boardId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
    @Body(new ZodValidationPipe(createPayoutSchema)) dto: CreatePayoutDto,
  ) {
    return this.finances.createPayout(boardId, actorOf(user, req), dto);
  }

  @Delete('payouts/:payoutId')
  removePayout(
    @Param('boardId') boardId: string,
    @Param('payoutId') payoutId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
  ) {
    return this.finances.removePayout(boardId, actorOf(user, req), payoutId);
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

  @Post('shows/:eventId/settle')
  settleShow(
    @Param('boardId') boardId: string,
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthUser,
    @Req() req: RequestWithMembership,
    @Body(new ZodValidationPipe(settleShowSchema)) dto: SettleShowDto,
  ) {
    return this.finances.settleShow(boardId, actorOf(user, req), eventId, dto);
  }
}
