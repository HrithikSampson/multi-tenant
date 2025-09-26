import { Router } from "express";
import logger from "../../utils/logger";
const router = Router();

router.get("/", (req, res) => {
    logger.info("")
});

export default router;