import { Controller, Get, Query } from '@nestjs/common';
import { BankService } from './bank.service';

@Controller('api/v1/bank')
export class BankController {
  constructor(private readonly bankService: BankService) {}

  /**
   * GET /api/v1/bank/validate?iban=DK50...&bic=NDEADKKK
   * Validates IBAN checksum/format and optional BIC/SWIFT code.
   */
  @Get('validate')
  async validate(@Query('iban') iban?: string, @Query('bic') bic?: string) {
    const result = await this.bankService.validate(iban ?? '', bic);
    return { validation: result };
  }
}
