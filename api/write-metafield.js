const { applyCors } = require("./_cors");
// POST /api/write-metafield  { customerId, serial }
// Writes the Keyzy serial to a Shopify customer metafield
// (namespace: "keyzy", key: "serial") so the dashboard can later look
// up which license belongs to which logged-in customer.
//
// Called by whatever issues the license (Zapier, etc.) right after a
// purchase -- not by the customer-facing dashboard.
module.exports = async function (req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { customerId, serial } = req.body || {};
  if (!customerId || !serial) {
    return res.status(400).json({ error: "Missing customerId or serial" });
  }
  const shop = process.env.SHOP_NAME;
  const token = process.env.SHOPIFY_API_KEY;
  const url = "https://" + shop + ".myshopify.com/admin/api/2024-04/customers/" + customerId + "/metafields.json";
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
          type: "single_line_text_field",
        },
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Shopify API error:", JSON.stringify(data));
      return res.status(response.status).json({ error: data });
    }
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("Unexpected server error:", err.message);
    res.status(500).json({ error: "Unexpected server error" });
  }
};
