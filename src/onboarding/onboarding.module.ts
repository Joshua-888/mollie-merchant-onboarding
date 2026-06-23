import { Module } from '@nestjs/common';
import { MollieModule } from '../integrations/mollie/mollie.module';
import { MerchantRegistry } from '../merchants/merchant-registry';
import { MerchantTokenStore } from '../merchants/merchant-token.store';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [MollieModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, MerchantTokenStore, MerchantRegistry],
})
export class OnboardingModule {}
