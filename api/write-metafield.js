const fetch = require("node-fetch");

module.exports = async function (req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customerId, serial } = req.body;

  if (!customerId || !serial) {
    return res.status(400).json({ error: "Missing customerId or serial" });
  }

  const shop = process.env.SHOP_NAME;
  const token = process.env.SHOPIFY_API_KEY;

  const url = `https://${shop}.myshopify.com/admin/api/2024-04/customers/${customerId}/metafields.json`;

  console.log("➡️ Outgoing request to Shopify:");
  console.log("URL:", url);
  console.log("Token (first 6 chars):", token?.slice(0, 6));
  console.log("Customer ID:", customerId);
  console.log("Serial:", serial);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        metafield: {
          namespace: "keyzy",
          key: "serial",
          value: serial,
          type: "single_line_text_field"
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ Shopify API error response:");
      console.error(JSON.stringify(data, null, 2));
      return res.status(response.status).json({ error: data });
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("🔥 Unexpected server error:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
};
