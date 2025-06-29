const express = require("express");
const cors = require("cors");
const axios = require("axios");
const writeMetafield = require("./api/write-metafield");

const app = express();
const port = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

const APP_ID = process.env.APP_ID;
const APP_KEY = process.env.APP_KEY;

// Test route
app.get("/", (req, res) => {
  res.send("Keyzy proxy is running");
});

// Keyzy: Show license info
app.get("/api/keyzy/license", async (req, res) => {
  const { serial } = req.query;
  try {
    const response = await axios.get(`https://api.keyzy.io/v2/licenses/show-license/${serial}`, {
      params: {
        app_id: APP_ID,
        api_key: APP_KEY
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error("License fetch error:", error?.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Keyzy: Get activations
app.get("/api/keyzy/activations", async (req, res) => {
  const { serial } = req.query;
  try {
    const response = await axios.get(`https://api.keyzy.io/v2/activations/${serial}`, {
      params: {
        app_id: APP_ID,
        api_key: APP_KEY
      }
    });
    res.json(response.data);
  } catch (error) {
    console.error("Activations error:", error?.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Keyzy: Delete activation
app.delete("/api/keyzy/delete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const response = await axios.delete(`https://api.keyzy.io/v2/activations/${id}`, {
      params: {
        app_id: APP_ID,
        api_key: APP_KEY
      }
    });
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error("Deactivation error:", error?.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// ✅ Shopify: Write metafield route
app.post("/api/write-metafield", writeMetafield);

app.listen(port, () => {
  console.log(`Proxy running on port ${port}`);
});
