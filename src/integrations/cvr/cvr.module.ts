import { Module } from '@nestjs/common';
import { CvrClient } from './cvr.client';
import { CvrController } from './cvr.controller';
import { CvrService } from './cvr.service';

@Module({
  controllers: [CvrController],
  providers: [CvrClient, CvrService],
  exports: [CvrService],
})
export class CvrModule {}
