/* Plugin handling database connections */
import { fastifyPostgres } from "@fastify/postgres";
import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { PrismaClient } from "@prisma/client";
declare module "fastify" {
  interface FastifyInstance {
    db: PostgresDB;
  }
}
interface PostgresDB {
  //getJobById(jobId: string): unknown;
  //setStyle(collId: string, Style: { minZoom: number; maxZoom: number; }): unknown;
  //mvtDummyData(): unknown;
  createNewJob(): unknown;
  //getCollectionZoomLevel(collId: string): { minZoom: any; maxZoom: any; } | PromiseLike<{ minZoom: any; maxZoom: any; }>;
  //getMVT(collId: string, z: number, x: number, y: number): unknown;
  testme(): Promise<any>;
  //updateCollection(collectionId: string): Promise<void>;
}

/**
 * @param fastify Will be passed in if called from fastify.register()
 * @param options The options passed to fastify.register( ... , { **here** }). I.e. {strategy: 'redis'}
 */
const dbPlugin: FastifyPluginAsync = async (fastify) => {
  /*fastify.register(fastifyPostgres, {
    host: process.env.POSTGRES_HOST,
    port: Number(process.env.POSTGRES_EXPOSE),
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  */
  const prisma = new PrismaClient();

  fastify.decorate("db", {
    async testme() {
      return await fastify.pg.query("SELECT * FROM somepolys");
    },
    async createNewJob() {
      const job = await prisma.pJobs.create({
        data: {
          job_state: "ERROR",
          job_date: new Date(),
          job_note: "First time with prism",
        },
      });
      return job;
    },
    /*asnyc getJobById(jobId: string) {
      const job = await prisma.job.findUnique({
        where: {
          job_id: jobId,
        },
    }
    async updateCollection(collectionId: string) {
      //
    },

    }
  */
  } satisfies PostgresDB);

  fastify.addHook("onClose", async () => {
    console.log("stopping dbPlugin");
    await prisma.$disconnect();
  });
};

export default fp(dbPlugin);
