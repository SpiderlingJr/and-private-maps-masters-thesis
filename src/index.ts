import { app } from "./app.js";

// Start listening.
export const server = app.listen(
  { port: parseInt(process.env.PORT || "") || 3000 },
  (err) => {
    if (err) {
      app.log.error(err);
      process.exit(1);
    }
  }
);
