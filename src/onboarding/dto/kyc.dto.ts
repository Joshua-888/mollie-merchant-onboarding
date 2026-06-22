import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DENMARK_COUNTRY_CODE } from '../../config/denmark.config';

export const IDENTITY_DOCUMENT_TYPES = ['passport', 'national_id', 'drivers_license'] as const;
export type IdentityDocumentType = (typeof IDENTITY_DOCUMENT_TYPES)[number];

export class IdentityDocumentDto {
  @IsNotEmpty()
  @IsIn([...IDENTITY_DOCUMENT_TYPES])
  documentType!: IdentityDocumentType;

  @IsNotEmpty()
  @IsString()
  @Length(3, 32)
  documentNumber!: string;

  @IsNotEmpty()
  @IsString()
  @Length(2, 2)
  issuingCountry!: string;

  @IsNotEmpty()
  @IsDateString()
  dateOfBirth!: string;

  @IsNotEmpty()
  @IsString()
  @Length(2, 2)
  nationality!: string;

  @IsNotEmpty()
  @IsDateString()
  expiryDate!: string;
}

export class UboPersonDto {
  @IsNotEmpty()
  @IsString()
  givenName!: string;

  @IsNotEmpty()
  @IsString()
  familyName!: string;

  @IsNotEmpty()
  @IsDateString()
  dateOfBirth!: string;

  @IsNotEmpty()
  @IsString()
  @Length(2, 2)
  nationality!: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  ownershipPercent!: number;

  @IsBoolean()
  isPseudoUbo!: boolean;

  @IsOptional()
  @IsString()
  @Length(0, 100)
  role?: string;
}

export class BankAccountDto {
  @IsNotEmpty()
  @IsString()
  @Length(2, 140)
  accountHolderName!: string;

  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z]{2}[0-9A-Z]{13,32}$/i, {
    message: 'IBAN skal være et gyldigt internationalt format',
  })
  iban!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/i, {
    message: 'BIC/SWIFT skal være 8 eller 11 tegn',
  })
  bic?: string;
}

export class LocalKycDto {
  @ValidateNested()
  @Type(() => IdentityDocumentDto)
  identity!: IdentityDocumentDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UboPersonDto)
  ubos!: UboPersonDto[];

  @ValidateNested()
  @Type(() => BankAccountDto)
  bankAccount!: BankAccountDto;
}

export const DEFAULT_NATIONALITY = DENMARK_COUNTRY_CODE;
