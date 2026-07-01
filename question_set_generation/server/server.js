require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const downloadsRouter = require("./routes/downloads");
const generateRouter = require("./routes/generate");

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/fln_print_engine";

app.use(cors());
app.use(express.json());

app.use("/api/downloads", downloadsRouter);
app.use("/api/generate", generateRouter);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`FLN API running on port ${PORT}`);
});

mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.warn("MongoDB connection failed:", err.message);
    console.warn("Continuing with in-memory logs for this dev session.");
  });
