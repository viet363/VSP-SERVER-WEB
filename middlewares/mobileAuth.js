import jwt from "jsonwebtoken";
import { db } from "../db.js";

export const mobileAuth = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token)
    return res.status(401).json({ success: false, message: "Missing token" });

  try {
    const decoded = jwt.verify(token, "SECRET_KEY");

    const [[user]] = await db.query("SELECT * FROM user WHERE Id = ?", [
      decoded.id,
    ]);

    if (!user)
      return res.status(401).json({ success: false, message: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};
