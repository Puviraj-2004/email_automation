import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './graphql/schema/typeDefs';
import { resolvers } from './graphql/resolvers/resolvers';
import documentsRouter from './rest/documents.route';
import { logger } from './modules/shared';
import { config } from './config/env';

export async function createServer(): Promise<express.Application> {
  const app = express();

  app.use(express.json());

  // ── REST: public file serving ──────────────────────────────────────────────
  app.use('/public/emails/documents', documentsRouter);

  // ── GraphQL ────────────────────────────────────────────────────────────────
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();

  app.use('/graphql', expressMiddleware(apollo));

  logger.info('[Server] Server configured', {
    graphql:  `${config.PUBLIC_BASE_URL}/graphql`,
    documents: `${config.PUBLIC_BASE_URL}/public/emails/documents`,
  });

  return app;
}