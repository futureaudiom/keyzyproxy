const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const APP_ID = process.env.APP_ID;
const APP_KEY = process.env.APP_KEY;

const LICENSE_BASE = "https://api.keyzy.io/v2/licenses";
const ACTIVATION_BASE = "https://api.keyzy.io/v2/activations";

// Show license info
app.get("/api/keyzy/license", async (req, res) => {
  try {
    const serial = req.query.serial;
    const response = await axios.get(`${LICENSE_BASE}/show-license/${serial}`, {
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

// Get activations for license
app.get("/api/keyzy/activations", async (req, res) => {
  try {
    const serial = req.query.serial;
    const response = await axios.get(`${ACTIVATION_BASE}/${serial}`, {
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

// Deactivate a machine
app.post("/api/keyzy/delete", async (req, res) => {
  try {
    const { serial, host_id } = req.body;

    await axios.post(
      `${LICENSE_BASE}/deactivate`,
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




