export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({ status: 'ok', time: new Date().toISOString() });
}
