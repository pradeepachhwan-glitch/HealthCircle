import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { generalRateLimiter, aiRateLimiter, adminRateLimiter, authRateLimiter } from "./middleware/rateLimiter";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(clerkMiddleware());

// Rate limiting — additive guards, not changing route logic. Order matters:
// the most specific limiters (AI, admin, auth) MUST be registered before the
// general /api limiter so express-rate-limit applies them first.
app.use("/api/chat", aiRateLimiter);
app.use("/api/ai", aiRateLimiter);
app.use("/api/health-search", aiRateLimiter);
app.use("/api/admin", adminRateLimiter);
app.use("/api/auth", authRateLimiter);
app.use("/api", generalRateLimiter);

app.use("/api", router);

export default app;
