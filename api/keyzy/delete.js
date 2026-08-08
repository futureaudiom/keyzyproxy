const { applyCors } = require("../_cors");

// DELETE /api/keyzy/delete?id=XXXX
// Deletes a single Keyzy activation by its activation id (server-side,
// write-key method). This is what frees up a slot for error 10.
// Docs: https://www.keyzy.io/docs/developers/rest-api/activations-delete/
//
// TEMPORARY: this endpoint currently trusts whatever id it's given --
// same as the old Render version. Before this is wired up to the
// customer-facing dashboard, add session-token verification (see
// get-serial.js comment) so a customer can only delete activations that
// belong to their own license, not an arbitrary id.
module.exports = async function (req, res) {
    if (applyCors(req, res)) return;
    if (req.method !== "DELETE") {
          return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;
    if (!id) {
          return res.status(400).json({ error: "Missing activation id" });
    }

    const APP_ID = process.env.APP_ID;
    const APP_KEY = process.env.APP_KEY;

    try {
          const url = `https://api.keyzy.io/v2/activations/${encodeURIComponent(id)}?app_id=${encodeURIComponent(APP_ID)}&api_key=${encodeURIComponent(APP_KEY)}`;
          const response = await fetch(url, { method: "DELETE" });
          const data = await response.json();
          res.status(response.status).json({ success: response.ok, data });
    } catch (error) {
          console.error("Deactivation error:", error.message);
          res.status(500).json({ error: "Internal Server Error" });
    }
};
