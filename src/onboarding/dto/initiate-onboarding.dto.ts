import {
  IsDateString,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CVR_PATTERN,
  DANISH_VAT_PATTERN,
  DENMARK_COUNTRY_CODE,
  DENMARK_LEGAL_ENTITY_VALUES,
} from '../../config/denmark.config';
import { LocalKycDto } from './kyc.dto';

export class AddressDto {
  @IsNotEmpty()
  @IsString()
  streetAndNumber!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[0-9]{4}$/, { message: 'Postnummer skal være 4 cifre' })
  postalCode!: string;

  @IsNotEmpty()
  @IsString()
  city!: string;

  @IsNotEmpty()
  @IsString()
  @Length(2, 2)
  @IsIn([DENMARK_COUNTRY_CODE])
  country!: string;
}

export class InitiateOnboardingDto {
  @IsNotEmpty()
  @IsString()
  merchantId!: string;

  // ─── Owner (Mollie: owner.*) — required ───────────────────────────────────
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @IsString()
  givenName!: string;

  @IsNotEmpty()
  @IsString()
  familyName!: string;

  @IsOptional()
  @IsString()
  locale?: string;

  // ─── Organization (Mollie: name, legalEntity, registrationNumber) ───────────
  @IsNotEmpty()
  @IsString()
  organizationName!: string;

  @IsNotEmpty()
  @IsString()
  @IsIn([...DENMARK_LEGAL_ENTITY_VALUES])
  legalEntity!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(CVR_PATTERN, { message: 'CVR-nummer skal være 8 cifre' })
  registrationNumber!: string;

  @IsOptional()
  @IsString()
  @Matches(DANISH_VAT_PATTERN, { message: 'Momsnummer skal have format DK12345678' })
  vatNumber?: string;

  @IsOptional()
  @IsDateString()
  incorporationDate?: string;

  // ─── Address (Mollie: address.*) — required ───────────────────────────────
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => AddressDto)
  address!: AddressDto;

  // ─── Payment profile (Mollie: profile — required for accepting payments) ─
  @IsNotEmpty()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  website!: string;

  @IsNotEmpty()
  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  profileEmail?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  businessDescription?: string;

  /** Collected locally for records/pre-validation — must still be confirmed in Mollie dashboard. */
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => LocalKycDto)
  localKyc!: LocalKycDto;
}
