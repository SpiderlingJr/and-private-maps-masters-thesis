import LightMyRequest from "light-my-request";
import { JobState } from "../../src/entities/jobs";
import { app } from "../../src/app.js";

/**
 * Tries to receive metadata from a performed job. If the job is not yet complete, it retries up to maxRetries times.
 * @param jobId id of the job to wait for completion
 * @param interval retry-interval in ms, default 1000
 * @param maxRetries number of maximum retries, default 5
 * @returns job info response
 */
async function waitForUploadJobCompletion(
  jobId: string,
  interval = 1000,
  maxRetries = 5
): Promise<Response> {
  function delay(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
  }

  async function getJobState() {
    const jobResponse = await app.inject({
      method: "GET",
      url: `/job/${jobId}`,
    });
    if (JSON.parse(jobResponse.body).job_state === JobState.PENDING)
      throw new Error("PENDING");
    return jobResponse;
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const retryOperation = (operation, delay, retries) =>
    new Promise((resolve, reject) => {
      return operation()
        .then(resolve)
        .catch((reason) => {
          if (retries > 0) {
            return wait(delay)
              .then(retryOperation.bind(null, operation, retries - 1))
              .then(resolve)
              .catch(reject);
          }
          return reject(reason);
        });
    });

  const jobResponse = retryOperation(
    getJobState,
    interval,
    maxRetries
  ) as Promise<Response>;
  return jobResponse;
}

export { waitForUploadJobCompletion };
