import { Module } from '@nestjs/common';
import { MollieModule } from '../integrations/mollie/mollie.module';
import { MerchantTokenStore } from '../merchants/merchant-token.store';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [MollieModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, MerchantTokenStore],
})
export class OnboardingModule {}
