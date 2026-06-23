import { Controller, Get, Param, Query } from '@nestjs/common';
import { CvrService } from './cvr.service';

@Controller('api/v1/cvr')
export class CvrController {
  constructor(private readonly cvrService: CvrService) {}

  /**
   * GET /api/v1/cvr/suggestions?q=novo
   * Autocomplete on company name (DataCVR / CVR registry).
   */
  @Get('suggestions')
  async suggestions(@Query('q') query?: string) {
    const suggestions = await this.cvrService.suggestCompanies(query ?? '');
    return { suggestions };
  }

  /**
   * GET /api/v1/cvr/search?q=restaurant&limit=10
   * Broader company search when suggestions are insufficient.
   */
  @Get('search')
  async search(@Query('q') query?: string, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Math.min(Math.max(parseInt(limit, 10) || 10, 1), 20) : 10;
    const suggestions = await this.cvrService.searchCompanies(query ?? '', parsedLimit);
    return { suggestions };
  }

  /**
   * GET /api/v1/cvr/companies/:cvr
   * Full company lookup by 8-digit CVR number.
   */
  @Get('companies/:cvr')
  async getCompany(@Param('cvr') cvr: string) {
    const company = await this.cvrService.getCompanyByCvr(cvr);
    return { company };
  }
}
