import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { updateBoardSchema, type UpdateBoardDto } from '@artist/shared';
import { BoardRoles } from '../common/board-roles.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BoardsService } from './boards.service';

@Controller('boards')
export class BoardsController {
  constructor(private readonly boards: BoardsService) {}

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
}
