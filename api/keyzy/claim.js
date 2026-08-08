const { applyCors } = require("../_cors");

// POST /api/keyzy/claim  { serial, customerId, customerEmail }
//
// Self-serve "link my license" flow for customers who don't have a Shopify
// order tied to their license (Plugin Boutique buyers, old WordPress-era
// direct sales, dealer sales, etc.). The customer types in the serial from
// their original purchase email; we check it against the email Keyzy has
// on file for that serial before linking it to their Shopify account.
//
// Trust model: if Keyzy already has an email on file for the serial, it
// must match (case-insensitive) the logged-in customer's email. If Keyzy
// has no email on file yet (unclaimed dealer/reseller stock), knowing the
// exact serial is treated as sufficient proof -- same as a normal software
// activation flow. Once claimed, Keyzy's own record is updated with the
// customer's name/email so a second person can't also claim it.
module.exports = async function (req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== "POST") {
          return res.status(405).json({ error: "Method not allowed" });
    }

    const { serial, customerId, customerEmail } = req.body || {};
    if (!serial || !customerId || !customerEmail) {
          return res.status(400).json({ error: "Missing serial, customerId, or customerEmail" });
    }

    const APP_ID = process.env.APP_ID;
    const APP_KEY = process.env.APP_KEY;
    const SHOP_NAME = process.env.SHOP_NAME;
    const SHOPIFY_TOKEN = process.env.SHOPIFY_API_KEY;

    try {
          const licenseUrl = `https://api.keyzy.io/v2/licenses/show-license/${encodeURIComponent(serial)}?app_id=${encodeURIComponent(APP_ID)}&api_key=${encodeURIComponent(APP_KEY)}`;
          const licenseRes = await fetch(licenseUrl);
          const licenseData = await licenseRes.json();

      if (!licenseRes.ok || !licenseData || !licenseData.data) {
              return res.status(404).json({ error: "We couldn't find that serial number. Please double check it and try again." });
      }

      const license = licenseData.data;
          const skuName = (license.sku_name || "").toUpperCase();
          if (!skuName.startsWith("DST")) {
                  return res.status(400).json({ error: "That serial isn't a DST license." });
          }

      const onFileEmail = (license.email || "").trim().toLowerCase();
          const submittedEmail = (customerEmail || "").trim().toLowerCase();

      if (onFileEmail && onFileEmail !== submittedEmail) {
              return res.status(403).json({ error: "This serial is registered to a different email address. Contact support if you believe this is a mistake." });
      }

      const metafieldUrl = `https://${SHOP_NAME}.myshopify.com/admin/api/2024-04/customers/${customerId}/metafields.json`;
          const metafieldRes = await fetch(metafieldUrl, {
                  method: "POST",
                  headers: {
                            "Content-Type": "application/json",
                            "X-Shopify-Access-Token": SHOPIFY_TOKEN,
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
          const metafieldData = await metafieldRes.json();

      if (!metafieldRes.ok) {
              console.error("Shopify metafield write error:", JSON.stringify(metafieldData));
              return res.status(500).json({ error: "Couldn't link your account. Please try again or contact support." });
      }

      if (!onFileEmail) {
              const updateUrl = `https://api.keyzy.io/v2/licenses/${encodeURIComponent(serial)}?app_id=${encodeURIComponent(APP_ID)}&api_key=${encodeURIComponent(APP_KEY)}`;
              try {
                        await fetch(updateUrl, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ email: customerEmail, name: customerEmail }),
                        });
              } catch (err) {
                        console.error("Keyzy license update (post-claim) failed:", err.message);
              }
      }

      res.status(200).json({ success: true, data: metafieldData });
    } catch (error) {
          console.error("Claim error:", error.message);
          res.status(500).json({ error: "Internal Server Error" });
    }
};
