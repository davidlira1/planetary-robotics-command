import { generateOpenApiDocument } from '@prc/contracts';
import { Logger, RequestMethod } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './filters/api-exception.filter';
import { RequestIdMiddleware } from './middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.enableShutdownHooks();
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix('api/v1', {
    exclude: [
      { path: 'health/live', method: RequestMethod.GET },
      { path: 'health/ready', method: RequestMethod.GET },
      { path: 'docs', method: RequestMethod.GET },
      { path: 'docs-json', method: RequestMethod.GET },
      { path: 'docs/(.*)', method: RequestMethod.GET },
    ],
  });

  const requestId = new RequestIdMiddleware();
  app.use((req: unknown, res: unknown, next: () => void) =>
    requestId.use(req as never, res as never, next),
  );

  const contractDoc = generateOpenApiDocument();
  SwaggerModule.setup('docs', app, contractDoc as never);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}`);
  Logger.log(`Swagger UI at http://localhost:${port}/docs`);
}

bootstrap();
