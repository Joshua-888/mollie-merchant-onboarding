import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync } from 'fs';
import { Response } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'warn', 'error'],
  });

  const publicDir = [join(process.cwd(), 'public'), join(__dirname, '..', 'public')].find((dir) =>
    existsSync(join(dir, 'index.html')),
  );

  if (!publicDir) {
    throw new Error('Public directory not found. Expected public/index.html at project root.');
  }

  app.useStaticAssets(publicDir);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  app.getHttpAdapter().get('/', (_req, res: Response) => {
    res.redirect('/index.html');
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`Mollie merchant onboarding (Danmark) running on port ${port}`);
  console.log(`  Onboarding form: http://localhost:${port}/index.html`);
  console.log(`  Merchants list:    http://localhost:${port}/merchants.html`);
}

bootstrap();
