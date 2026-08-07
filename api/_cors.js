// Shared CORS helper for all API routes.
//
// The customer-account dashboard extension calls these endpoints
// cross-origin from a Shopify-hosted domain, so every function needs
// to handle preflight (OPTIONS) requests and set the right headers.
//
// Set ALLOWED_ORIGIN in Vercel's env vars once you know the exact
// origin the extension runs from (e.g. https://shopify.com or your
// shop's account domain). Until then this defaults to "*", which is
// fine because every route also requires a valid Shopify customer
// session token -- CORS is a convenience, not the security boundary.

function applyCors(req, res) {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
        res.status(204).end();
        return true;
  }
    return false;
}

module.exports = { applyCors };
