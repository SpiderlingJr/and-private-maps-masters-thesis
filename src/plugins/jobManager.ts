// Plugin that handles execution of jobs between the app and the database.

import { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";
import { JobState } from "src/entities/jobs.js";
import { Collections } from "src/entities/collections.js";
import { PostGisConnection } from "src/util/PostGisConnection.js";

declare module "fastify" {
  interface FastifyInstance {
    jobManager: JobManager;
  }
}

interface JobManager {
  createJob(): Promise<string>;
  updateJob(
    jobId: string,
    state: JobState,
    colId: string,
    note?: string
  ): Promise<void>;

  executeTaskAndUbdateJob(job: () => Promise<any>): Promise<string>;
}

const jobManager: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("jobManager", {
    async createJob() {
      const jobId = await fastify.db.createJob();
      return jobId;
    },
    async updateJob(
      jobId: string,
      state: JobState,
      colId: string,
      note?: string
    ) {
      await fastify.db.updateJob(jobId, state, colId, note);
    },
    async executeTaskAndUpdateJob(job: () => Promise<any>) {
      const jobSuccess = await job();
    },
  });
};
