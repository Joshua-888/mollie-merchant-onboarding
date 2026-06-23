import { Injectable } from '@nestjs/common';
import { CvrClient } from './cvr.client';
import { mapCompanyDto, mapSuggestionDto } from './cvr.mapper';
import { CvrCompanySummary, CvrSuggestion } from './cvr.types';

@Injectable()
export class CvrService {
  constructor(private readonly cvrClient: CvrClient) {}

  async suggestCompanies(query: string): Promise<CvrSuggestion[]> {
    const response = await this.cvrClient.suggestCompanies(query);
    return (response.suggestions ?? []).map(mapSuggestionDto);
  }

  async searchCompanies(query: string, limit = 10): Promise<CvrSuggestion[]> {
    const response = await this.cvrClient.searchCompanies(query, limit);
    return response.results.map((result) =>
      mapSuggestionDto({
        vat: result.vat,
        name: result.name,
        address: [result.address, result.zipcode, result.city].filter(Boolean).join(', '),
      }),
    );
  }

  async getCompanyByCvr(cvr: string): Promise<CvrCompanySummary> {
    const company = await this.cvrClient.getCompanyByCvr(cvr);
    return mapCompanyDto(company);
  }
}
