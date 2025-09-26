import { Router } from "express";
import logger from "../utils/logger";

const router = Router();

router.get("/", (req, res) => {
    logger.info("Organizations endpoint accessed");
    res.json({ message: "Organizations endpoint" });
});

export default router;
