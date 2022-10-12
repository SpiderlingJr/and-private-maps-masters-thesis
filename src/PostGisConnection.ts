import Pool from "pg-pool";
import { createReadStream, unlink } from "fs";
import pgcopy from "pg-copy-streams";
import { QueryResult } from "pg";

type JobState = "pending" | "finished" | "error";

export class PostGisConnection {
  conn;

  constructor() {
    console.log(
      process.env.PG_DB,
      process.env.PG_USER,
      process.env.PG_PW,
      process.env.PG_PORT
    );
    // Database connection
    this.conn = new Pool({
      //host: "127.0.0.1",
      database: process.env.PG_DB,
      user: process.env.PG_USER,
      password: process.env.PG_PW,
      port: Number(process.env.PG_PORT),
    });
  }

  /**
   * Lets the database generate a new collection.
   * @returns id of the freshly generated collection
   */
  async createNewCollection(): Promise<string> {
    const query = "INSERT INTO collections DEFAULT VALUES RETURNING coll_id";
    const result = await this.executeQueryWithReturn(query);
    const cid = result.rows[0].coll_id;
    return cid;
  }

  /**
   * Creates a new job with default state "pending"
   * @returns
   */
  async createNewJob(): Promise<string> {
    const query = "INSERT INTO jobs DEFAULT VALUES RETURNING job_id";
    const result = await this.executeQueryWithReturn(query);
    const jid = result.rows[0].job_id;
    return jid;
  }

  private isJobState(value: string): value is JobState {
    return ["pending", "finished", "error"].includes(value);
  }

  async updateJob(jobId: string, state: JobState): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isJobState(state)) {
        const query = `UPDATE jobs SET job_state = '${state}' WHERE job_id = '${jobId}'`;
        this.executeQueryWithReturn(query);
        resolve();
      } else {
        reject();
      }
    });
  }
  /**
   *
   * @param query query string to be passed to db
   * @returns
   */
  private executeQueryWithReturn(query: string): Promise<QueryResult> {
    return new Promise((resolve, reject) => {
      this.conn.query(query, (err, res) => {
        if (res) {
          resolve(res);
        } else {
          reject(err);
        }
      });
    });
  }

  /**
   * Streams csv file to postgres database. Deletes file after processing
   * @param file
   */
  async uploadDataFromCsv(file: string) {
    this.conn.connect(function (err, client, done) {
      if (err) {
        console.log(err);
      } else if (client === undefined || done === undefined) {
        // TODO how would this happen?
        console.log("Client or Done is undefined!");
      } else {
        const stream = client.query(
          pgcopy.from(
            "COPY features(geom, properties, ft_collection) FROM STDIN (FORMAT CSV, DELIMITER ';')"
          )
        );
        const fileStream = createReadStream(file);

        fileStream.on("error", (err) => {
          console.log(err);
        });
        stream.on("error", (err) => {
          console.log(err);
          return Promise.reject();
        });
        stream.on("finish", () => {
          done();
        });
        fileStream.pipe(stream);
      }
    });
  }
}
