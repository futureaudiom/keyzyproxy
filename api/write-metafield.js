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
    const response = await fetch(`https://${process.env.SHOP_NAME}.myshopify.com/admin/api/2024-04/customers/${customerId}/metafields.json`, {
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
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.errors || "Failed to write metafield");
    }

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    console.error("Metafield write error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
