/* Plugin handling database connections */
import { fastifyPostgres } from "@fastify/postgres";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    db: PostgresDB;
  }
}
interface PostgresDB {
  connect(): Promise<void>;
  testme(): void;
}

/**
 * @param fastify Will be passed in if called from fastify.register()
 * @param options The options passed to fastify.register( ... , { **here** }). I.e. {strategy: 'redis'}
 */
const dbPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.register(fastifyPostgres, {
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_EXPOSE),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });

  // Tis even necessary?
  fastify.decorate("db", {
    async connect() {
      await fastify.pg.connect();
    },
    testme() {
      console.log("I consider myself a database");
    },
  } satisfies PostgresDB);
};

export default fp(dbPlugin);
