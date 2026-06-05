import { Module } from '@nestjs/common';
import { MollieClient } from './mollie.client';

@Module({
  providers: [MollieClient],
  exports: [MollieClient],
})
export class MollieModule {}
