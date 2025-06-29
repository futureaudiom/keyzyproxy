const fetch = require("node-fetch");

module.exports = async function (req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customerId, serial } = req.body;

  if (!customerId || !serial) {
    return res.status(400).json({ error: "Missing customerId or serial" });
  }

  try {
    const url = `https://${process.env.SHOP_NAME}.myshopify.com/admin/api/2024-04/customers/${customerId}/metafields.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_API_KEY,
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
      console.error("Shopify API error:", data);
      return res.status(response.status).json({ error: data });
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
};
