function getHealth(req, res) {
  res.json({ status: "ok", service: "backend" });
}

module.exports = { getHealth };
