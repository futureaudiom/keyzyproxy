const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const APP_ID = process.env.APP_ID;
const APP_KEY = process.env.APP_KEY;

const KEYZY_BASE = "https://api.keyzy.io/v2";

// 1. Show license
app.get("/api/keyzy/license", async (req, res) => {
  try {
    const serial = req.query.serial;
    const response = await axios.get(`${KEYZY_BASE}/licenses/show-license/${serial}`, {
      params: {
        app_id: APP_ID,
        api_key: APP_KEY,
      },
    });
    res.json(response.data);
  } catch (err) {
    console.error("License error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// 2. Get activations
app.get("/api/keyzy/activations", async (req, res) => {
  try {
    const serial = req.query.serial;
    const response = await axios.get(`${KEYZY_BASE}/activations/${serial}`, {
      params: {
        app_id: APP_ID,
        api_key: APP_KEY,
      },
    });
    res.json(response.data);
  } catch (err) {
    console.error("Activations error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// 3. Deactivate a machine
app.post("/api/keyzy/delete", async (req, res) => {
  try {
    const { serial, host_id } = req.body;
    const response = await axios.post(
      `${KEYZY_BASE}/licenses/deactivate`,
      { serial, host_id },
      {
        headers: {
          "Content-Type": "application/json",
        },
        params: {
          app_id: APP_ID,
          api_key: APP_KEY,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    console.error("Deactivation error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// Root route to confirm proxy is live
app.get("/", (req, res) => {
  res.send("Keyzy proxy is live");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
