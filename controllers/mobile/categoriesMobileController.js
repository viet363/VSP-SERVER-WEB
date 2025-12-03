import { db } from "../../db.js";

export const getCategoriesMobile = async (req, res) => {
  const [data] = await db.query("SELECT * FROM category");
  res.json({ success: true, data });
};
