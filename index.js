const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();
app.use(cors());
app.use(express.json());

const APP_ID = process.env.APP_ID;
const APP_KEY = process.env.APP_KEY;

const KEYZY_BASE = "https://api.keyzy.io/v2/licenses";

app.get("/api/keyzy", async (req, res) => {
  try {
    const serial = req.query.serial;
    const response = await axios.get(`${KEYZY_BASE}/by-serial/${serial}`, {
      headers: {
        "app-id": APP_ID,
        "app-key": APP_KEY,
      },
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/keyzy/delete", async (req, res) => {
  try {
    const { serial, host_id } = req.query;
    await axios.post(
      `${KEYZY_BASE}/deactivate`,
      { serial, host_id },
      {
        headers: {
          "app-id": APP_ID,
          "app-key": APP_KEY,
        },
      }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Keyzy proxy is live");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});

