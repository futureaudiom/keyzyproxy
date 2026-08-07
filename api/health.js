// GET /api/health -- simple check that the deployment is up.
module.exports = async function (req, res) {
  res.status(200).json({ status: "keyzy proxy is running (vercel)" });
};
