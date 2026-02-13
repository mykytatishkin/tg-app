import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const corsOrigins = [
    'https://web.telegram.org',
    'http://localhost:5173',
    'https://localhost:5173',
  ];
  const miniAppUrl = process.env.MINI_APP_URL;
  if (miniAppUrl) {
    try {
      const origin = new URL(miniAppUrl).origin;
      if (!corsOrigins.includes(origin)) corsOrigins.push(origin);
    } catch {
      // ignore invalid URL
    }
  }
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
