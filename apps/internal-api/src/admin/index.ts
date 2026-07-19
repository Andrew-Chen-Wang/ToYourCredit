import { Hono } from "hono"
import { RegExpRouter } from "hono/router/reg-exp-router"
import onboarding from "./onboarding"
import post from "./post"
import stats from "./stats"
import user from "./user"

const app = new Hono({
  router: new RegExpRouter(),
})
  .basePath("/admin")
  .route("/users", user)
  .route("/posts", post)
  .route("/stats", stats)
  .route("/onboarding", onboarding)

export default app
