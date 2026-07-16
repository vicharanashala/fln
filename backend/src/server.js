require("dotenv").config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const fs = require("fs");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const assessmentRoutes = require("./routes/assessmentRoutes");
const templateRoutes = require("./routes/templateRoutes");
const superadminRoutes = require("./routes/superadminRoutes");
const { UPLOAD_DIR } = require("./services/pdfParser");

const app = express();

const origins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use("/uploads", express.static(UPLOAD_DIR));

// Proxy /extracted-images/* to Python service (so frontend can load via backend :5000)
app.use("/extracted-images", async (req, res, next) => {
  try {
    const axios = require("axios");
    const pyUrl = `${process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:5051"}${req.originalUrl}`;
    const r = await axios.get(pyUrl, { responseType: "stream", timeout: 30000 });
    res.set("content-type", r.headers["content-type"]);
    r.data.pipe(res);
  } catch (err) {
    next(err);
  }
});

app.get("/api/health", (req, res) =>
  res.json({ ok: true, service: "fln-backend", time: new Date().toISOString() })
);


app.use("/api/auth", authRoutes);
app.use("/api/assessments", assessmentRoutes);
app.use("/api/templates", templateRoutes);
app.use("/api", superadminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ message: "File too large (max 50 MB)" });
  }
  res.status(500).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;
connectDB().then(() => {
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
});