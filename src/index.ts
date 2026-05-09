import "dotenv/config";

import cors from "cors";
import express from "express";

import { createTambuRouter } from "./routes/createTambu.js";
import { mintAurioRouter } from "./routes/mintAurio.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  "/create-tambu",
  createTambuRouter
);

app.use(
  "/mint-aurio",
  mintAurioRouter
);

const port = Number(
  process.env.PORT || 3001
);

app.listen(port, () => {
  console.log(
    `Aurio chain service running on :${port}`
  );
});