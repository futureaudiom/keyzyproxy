const { applyCors } = require("../_cors");
// GET /api/keyzy/license?serial=XXXX-XXXX-XXXX
// Shows a Keyzy license's details (name, email, type, dates) for a serial.
// Docs: https://www.keyzy.io/docs/developers/rest-api/licenses-show-license/
module.exports = async function (req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const { serial } = req.query;
  if (!serial) {
    return res.status(400).json({ error: "Missing serial parameter" });
  }
  const APP_ID = process.env.APP_ID;
 const APP_KEY = process.env.APP_KEY;
  try {
    const url = "https://api.keyzy.io/v2/licenses/show-license/" + encodeURIComponent(serial) + "?app_id=" + encodeURIComponent(APP_ID) + "&api_key=" + encodeURIComponent(APP_KEY);
    const response = await fetch(url);
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error("License fetch error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
