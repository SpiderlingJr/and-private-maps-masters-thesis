import Pool from "pg-pool";
import { createReadStream, unlink } from "fs";
import pgcopy from "pg-copy-streams";

export class PostGisConnection {
  conn;

  constructor() {
    // Database connection
    // TODO outsource auth to env
    this.conn = new Pool({
      //host: "127.0.0.1",
      database: process.env.PG_DB,
      user: process.env.PG_USER,
      password: process.env.PG_PW,
      port: Number(process.env.PG_PORT),
    });
  }
  /**
   * Streams csv file to postgres database. Deletes file after processing
   * @param file
   */
  uploadDataFromCsv(file: string) {
    this.conn.connect(function (err, client, done) {
      if (err) {
        console.log(err);
      } else if (client === undefined || done === undefined) {
        // TODO how would this happen?
        console.log("Client or Done is undefined!");
      } else {
        const stream = client.query(
          pgcopy.from(
            "COPY some_coordinates(geom, properties) FROM STDIN (FORMAT CSV, DELIMITER ';')"
          )
        );
        const fileStream = createReadStream(file);

        fileStream.on("error", done);
        stream.on("error", done);
        stream.on("finish", () => {
          unlink(file, function (err) {
            if (err) {
              console.error(err);
            }
          });
        });
        fileStream.pipe(stream);
      }
    });
  }
}
