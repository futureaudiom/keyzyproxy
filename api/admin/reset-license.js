const { applyCors } = require("../_cors");

// POST /api/admin/reset-license  { password, customerEmail, oldSerial }
//
// Admin-only tool (not linked from the customer-facing dashboard) for the
// "error 4" support flow: delete a broken/corrupted license in Keyzy and
// issue the customer a fresh serial on the same SKU, then repoint their
// Shopify account at the new serial. Protected by a shared password
// (ADMIN_PASSWORD env var).
//
// This is destructive and not undoable -- the old serial and its
// activations are gone for good once step 3 succeeds. The customer's
// Shopify metafield is checked against the serial passed in first, so a
// typo can't accidentally reset the wrong person's license.
module.exports = async function (req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password, customerEmail, oldSerial } = req.body || {};

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password." });
  }
  if (!customerEmail || !oldSerial) {
    return res.status(400).json({ error: "Missing customerEmail or oldSerial." });
  }

  const APP_ID = process.env.APP_ID;
  const APP_KEY = process.env.APP_KEY;
  const SHOP_NAME = process.env.SHOP_NAME;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_API_KEY;
  const UA = "FutureAudioAdminTool/1.0";
  const shopifyGraphqlUrl = `https://${SHOP_NAME}.myshopify.com/admin/api/2024-04/graphql.json`;

  try {
    // 1. Find the Shopify customer by email and confirm the serial on file
    // matches what's being reset -- safety check against typos.
    const findRes = await fetch(shopifyGraphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      },
      body: JSON.stringify({
        query: `query($q: String!) {
          customers(first: 1, query: $q) {
            edges { node { id metafield(namespace: "keyzy", key: "serial") { value } } }
          }
        }`,
        variables: { q: `email:${customerEmail}` },
      }),
    });
    const findData = await findRes.json();
    const customerNode = findData?.data?.customers?.edges?.[0]?.node;

    if (!customerNode) {
      return res.status(404).json({ error: "No Shopify customer found with that email." });
    }
    const currentSerial = customerNode.metafield?.value;
    if (currentSerial !== oldSerial) {
      return res.status(409).json({
        error: `That customer's account has "${currentSerial || "no serial"}" on file, not "${oldSerial}". Double-check before resetting.`,
      });
    }

    // 2. Look up the old license in Keyzy to get its SKU and type.
    const licenseUrl = `https://api.keyzy.io/v2/licenses/show-license/${encodeURIComponent(oldSerial)}?app_id=${encodeURIComponent(APP_ID)}&api_key=${encodeURIComponent(APP_KEY)}`;
    const licenseRes = await fetch(licenseUrl, { headers: { "User-Agent": UA } });
    const licenseData = await licenseRes.json();
    if (!licenseRes.ok || !licenseData?.data) {
      return res.status(404).json({ error: "That serial doesn't exist in Keyzy." });
    }
    const { sku_number, type, start_at, end_at } = licenseData.data;

    // 3. Delete the old license (and its activations) in Keyzy. Not undoable.
    const deleteUrl = `https://api.keyzy.io/v2/licenses/destroy-serial?app_id=${encodeURIComponent(APP_ID)}&api_key=${encodeURIComponent(APP_KEY)}&serial=${encodeURIComponent(oldSerial)}&type=${encodeURIComponent(type)}`;
    const deleteRes = await fetch(deleteUrl, { method: "DELETE", headers: { "User-Agent": UA } });
    const deleteData = await deleteRes.json();
    if (!deleteRes.ok) {
      return res.status(502).json({ error: `Couldn't delete the old license: ${deleteData?.error?.message || "unknown Keyzy error"}` });
    }

    // 4. Register a brand-new license on the same SKU for this customer.
    const registerBody = {
      app_id: APP_ID,
      api_key: APP_KEY,
      sku_number,
      name: customerEmail,
      email: customerEmail,
    };
    if (type === "subscription" || type === "trial") {
      registerBody.type = type;
      registerBody.start_at = start_at;
      registerBody.end_at = end_at;
    }
    const registerRes = await fetch("https://api.keyzy.io/v2/licenses/register", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify(registerBody),
    });
    const registerData = await registerRes.json();
    if (!registerRes.ok || !registerData?.message?.serial) {
      return res.status(502).json({
        error: `The old license was deleted, but creating the new one failed: ${registerData?.error?.message || "unknown Keyzy error"}. You'll need to register a replacement by hand in the Keyzy dashboard for ${customerEmail} (SKU ${sku_number}) and update their Shopify metafield yourself.`,
      });
    }
    const newSerial = registerData.message.serial;

    // 5. Point the Shopify customer's metafield at the new serial (upsert).
    const setRes = await fetch(shopifyGraphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_TOKEN,
      },
      body: JSON.stringify({
        query: `mutation($metafields: [MetafieldsSetInput!]!) {
          metafieldsSet(metafields: $metafields) {
            metafields { id value }
            userErrors { field message }
          }
        }`,
        variables: {
          metafields: [
            {
              ownerId: customerNode.id,
              namespace: "keyzy",
              key: "serial",
              type: "single_line_text_field",
              value: newSerial,
            },
          ],
        },
      }),
    });
    const setData = await setRes.json();
    const userErrors = setData?.data?.metafieldsSet?.userErrors;
    if (!setRes.ok || (userErrors && userErrors.length)) {
      return res.status(502).json({
        error: `New license ${newSerial} was created, but updating the customer's Shopify account failed (${userErrors?.[0]?.message || "unknown error"}). Update the metafield by hand for ${customerEmail}.`,
        newSerial,
      });
    }

    res.status(200).json({ success: true, oldSerial, newSerial, customerEmail });
  } catch (error) {
    console.error("Reset-license error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
