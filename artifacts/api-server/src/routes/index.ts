import { Router, type IRouter } from "express";
import healthRouter from "./health";
import communitiesRouter from "./communities";
import postsRouter from "./posts";
import commentsRouter from "./comments";
import usersRouter from "./users";
import gamificationRouter from "./gamification";
import searchRouter from "./search";
import adminRouter from "./admin";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(communitiesRouter);
router.use(postsRouter);
router.use(commentsRouter);
router.use(usersRouter);
router.use(gamificationRouter);
router.use(searchRouter);
router.use(adminRouter);
router.use(aiRouter);

export default router;
