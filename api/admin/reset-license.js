const { applyCors } = require("../_cors");

// POST /api/admin/reset-license  { password, oldSerial, customerEmail? }
//
// Admin-only tool (not linked from the customer-facing dashboard) for the
// "error 4" support flow: delete a broken/corrupted license in Keyzy and
// issue a fresh serial on the same SKU. Protected by a shared password
// (ADMIN_PASSWORD env var).
//
// The serial alone is enough to do the Keyzy-side reset -- same as
// searching for it directly in the Keyzy dashboard. customerEmail is
// optional: if you have it (usually the email you're replying to), it
// also repoints that customer's Shopify account/dashboard at the new
// serial. If you don't provide it, you get the new serial back to relay
// to the customer yourself, and their Shopify record is left untouched.
//
// This is destructive and not undoable -- the old serial and its
// activations are gone for good once step 2 succeeds. If an email is
// given, the Shopify metafield on file is checked against the serial
// first, so a typo can't accidentally reset the wrong person's license.
module.exports = async function (req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { password, oldSerial, customerEmail } = req.body || {};
  // Trim whitespace on the password -- copy/pasting from chat or notes
  // apps can carry a trailing space or newline along with it.
  const trimmedPassword = (password || "").trim();

  if (!trimmedPassword || trimmedPassword !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Wrong password." });
  }
  if (!oldSerial) {
    return res.status(400).json({ error: "Missing oldSerial." });
  }

  const APP_ID = process.env.APP_ID;
  const APP_KEY = process.env.APP_KEY;
  const SHOP_NAME = process.env.SHOP_NAME;
  const SHOPIFY_TOKEN = process.env.SHOPIFY_API_KEY;
  const UA = "FutureAudioAdminTool/1.0";
  const shopifyGraphqlUrl = `https://${SHOP_NAME}.myshopify.com/admin/api/2024-04/graphql.json`;

  try {
    // 0. If an email was given, find the Shopify customer and confirm the
    // serial on file matches what's being reset -- safety check against
    // typos. Skipped entirely when no email is provided.
    let customerNode = null;
    if (customerEmail) {
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
      customerNode = findData?.data?.customers?.edges?.[0]?.node || null;

      if (!customerNode) {
        return res.status(404).json({ error: "No Shopify customer found with that email." });
      }
      const currentSerial = customerNode.metafield?.value;
      if (currentSerial !== oldSerial) {
        return res.status(409).json({
          error: `That customer's account has "${currentSerial || "no serial"}" on file, not "${oldSerial}". Double-check before resetting.`,
        });
      }
    }

    // 1. Look up the old license in Keyzy to get its SKU and type.
    const licenseUrl = `https://api.keyzy.io/v2/licenses/show-license/${encodeURIComponent(oldSerial)}?app_id=${encodeURIComponent(APP_ID)}&api_key=${encodeURIComponent(APP_KEY)}`;
    const licenseRes = await fetch(licenseUrl, { headers: { "User-Agent": UA } });
    const licenseData = await licenseRes.json();
    if (!licenseRes.ok || !licenseData?.data) {
      return res.status(404).json({ error: "That serial doesn't exist in Keyzy." });
    }
    const { sku_number, type, start_at, end_at } = licenseData.data;

    // 2. Delete the old license (and its activations) in Keyzy. Not undoable.
    const deleteUrl = `https://api.keyzy.io/v2/licenses/destroy-serial?app_id=${encodeURIComponent(APP_ID)}&api_key=${encodeURIComponent(APP_KEY)}&serial=${encodeURIComponent(oldSerial)}&type=${encodeURIComponent(type)}`;
    const deleteRes = await fetch(deleteUrl, { method: "DELETE", headers: { "User-Agent": UA } });
    const deleteData = await deleteRes.json();
    if (!deleteRes.ok) {
      return res.status(502).json({ error: `Couldn't delete the old license: ${deleteData?.error?.message || "unknown Keyzy error"}` });
    }

    // 3. Register a brand-new license on the same SKU. Keyzy requires a
    // name/email on register -- use the customer's if we have it,
    // otherwise a placeholder (this is just bookkeeping on Keyzy's side).
    const registerEmail = customerEmail || "support@future.audio";
    const registerBody = {
      app_id: APP_ID,
      api_key: APP_KEY,
      sku_number,
      name: registerEmail,
      email: registerEmail,
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
        error: `The old license was deleted, but creating the new one failed: ${registerData?.error?.message || "unknown Keyzy error"}. You'll need to register a replacement by hand in the Keyzy dashboard (SKU ${sku_number}).`,
      });
    }
    const newSerial = registerData.message.serial;

    // 4. If we have the Shopify customer, point their metafield at the new
    // serial (upsert) so their dashboard reflects it too.
    let shopifyUpdated = false;
    if (customerNode) {
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
      shopifyUpdated = true;
    }

    res.status(200).json({ success: true, oldSerial, newSerial, customerEmail: customerEmail || null, shopifyUpdated });
  } catch (error) {
    console.error("Reset-license error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
