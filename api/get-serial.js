const { applyCors } = require("./_cors");

// GET /api/get-serial?customerId=1234567890
// Reads the customer's Keyzy serial back out of their
// keyzy.serial metafield (the counterpart to write-metafield.js).
//
// TEMPORARY: like delete/[id].js, this currently trusts whatever
// customerId it's given. Before this goes live on the dashboard, verify
// the Shopify customer-account session token sent by the extension and
// read the customer id from the token's own claims instead of the query
// param -- otherwise anyone could pass a different customerId and read
// someone else's serial. Revisit once the extension/app (and its client
// secret, needed to verify the token) exists.
module.exports = async function (req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { customerId } = req.query;
  if (!customerId) {
    return res.status(400).json({ error: "Missing customerId parameter" });
  }

  const shop = process.env.SHOP_NAME;
  const token = process.env.SHOPIFY_API_KEY;

  const url = "https://" + shop + ".myshopify.com/admin/api/2024-04/customers/" + customerId + "/metafields.json?namespace=keyzy&key=serial";

  try {
    const response = await fetch(url, {
      headers: { "X-Shopify-Access-Token": token },
    });
    const data = await response.json();

  if (!response.ok) {
    return res.status(response.status).json({ error: data });
  }

  const metafield = (data.metafields || [])[0];
    if (!metafield) {
      return res.status(404).json({ error: "No serial found for this customer" });
    }

  res.status(200).json({ serial: metafield.value });
  } catch (err) {
    console.error("get-serial error:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
