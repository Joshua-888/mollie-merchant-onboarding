import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { CvrModule } from './integrations/cvr/cvr.module';
import { BankModule } from './bank/bank.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    CvrModule,
    BankModule,
    OnboardingModule,
  ],
})
export class AppModule {}
