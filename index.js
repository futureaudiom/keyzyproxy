const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const APP_ID = process.env.APP_ID;
const APP_KEY = process.env.APP_KEY;

console.log("Using APP_ID:", APP_ID);
console.log("Using APP_KEY:", APP_KEY);

const KEYZY_LICENSE_URL = "https://api.keyzy.io/v2/licenses/show-license";
const KEYZY_ACTIVATIONS_URL = "https://api.keyzy.io/v2/activations";
const KEYZY_DEACTIVATE_URL = "https://api.keyzy.io/v2/licenses/deactivate";

// Get license info
app.get("/api/keyzy/license", async (req, res) => {
  try {
    const serial = req.query.serial;
    const response = await axios.get(`${KEYZY_LICENSE_URL}/${serial}`, {
      headers: {
        "app-id": APP_ID,
        "app-key": APP_KEY,
      },
    });
    res.json(response.data);
  } catch (err) {
    console.error("License lookup error:", err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// Get activations
app.get("/api/keyzy/activations", async (req, res) => {
  try {
    const serial = req.query.serial;
    const response = await axios.get(`${KEYZY_ACTIVATIONS_URL}/${serial}`, {
      headers: {
        "app-id": APP_ID,
        "app-key": APP_KEY,
      },
    });
    res.json(response.data);
  } catch (err) {
    console.error("Activations error:", err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

// Deactivate a machine
app.post("/api/keyzy/delete", async (req, res) => {
  try {
    const { serial, host_id } = req.body;

    await axios.post(
      KEYZY_DEACTIVATE_URL,
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
    console.error("Deactivation error:", err.message);
    res.status(err.response?.status || 500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Keyzy proxy is live");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
