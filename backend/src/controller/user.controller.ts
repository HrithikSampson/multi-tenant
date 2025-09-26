import { Router } from "express";
import logger from "../utils/logger";

const router = Router();

router.get("/", (req, res) => {
    logger.info("Users endpoint accessed");
    res.json({ message: "Users endpoint" });
});

export default router;