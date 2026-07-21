import { fetchUser } from "@lib/dao/user/fetch"
import { sha256 } from "@oslojs/crypto/sha2"
import { encodeHexLowerCase } from "@oslojs/encoding"
import { db } from "@template-nextjs/db"
import { Hono } from "hono"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import adminUsers from "./user"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const targetId = v7()
const adminId = v7()
const adminSessionToken = `tok-${v7()}`
const adminSessionKey = encodeHexLowerCase(sha256(new TextEncoder().encode(adminSessionToken)))
const adminCookie = `session=${adminSessionToken}`

const app = new Hono().route("/users", adminUsers)

async function issueStrike(body: Record<string, unknown>): Promise<Response> {
  return await app.request(`/users/${targetId}/strike`, {
    method: "POST",
    headers: { Cookie: adminCookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      { id: targetId, username: `stk-t-${suffix}`, email: `stkt-${suffix}@example.invalid` },
      {
        id: adminId,
        username: `stk-m-${suffix}`,
        email: `stkm-${suffix}@example.invalid`,
        isAdmin: true,
      },
    ])
    .execute()
  await db
    .insertInto("session")
    .values({
      sessionKey: adminSessionKey,
      userId: adminId,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("notification").where("userId", "=", targetId).execute()
  await db.deleteFrom("userStrike").where("userId", "=", targetId).execute()
  await db.deleteFrom("session").where("sessionKey", "=", adminSessionKey).execute()
  await db.deleteFrom("user").where("id", "in", [targetId, adminId]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("admin strike endpoints", () => {
  it("rejects self-strikes and missing users", async () => {
    const self = await app.request(`/users/${adminId}/strike`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "self" }),
    })
    expect(self.status).toBe(400)

    const missing = await app.request(`/users/${v7()}/strike`, {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "ghost" }),
    })
    expect(missing.status).toBe(404)
  })

  it("auto-suspends on the 5th active strike and notifies the user", async () => {
    for (let i = 1; i <= 4; i++) {
      const res = await issueStrike({ reason: `strike ${i}` })
      expect(res.status).toBe(200)
      const json = (await res.json()) as { activeCount: number; suspended: boolean }
      expect(json.activeCount).toBe(i)
      expect(json.suspended).toBe(false)
    }
    const user = await fetchUser(db).getOne(targetId, ["suspendedAt"])
    expect(user?.suspendedAt).toBeNull()

    const fifth = await issueStrike({ reason: "strike 5" })
    const fifthJson = (await fifth.json()) as { activeCount: number; suspended: boolean }
    expect(fifthJson.activeCount).toBe(5)
    expect(fifthJson.suspended).toBe(true)

    const suspendedUser = await fetchUser(db).getOne(targetId, ["suspendedAt", "suspensionReason"])
    expect(suspendedUser?.suspendedAt).not.toBeNull()
    expect(suspendedUser?.suspensionReason).toBe("Automatic suspension: 5 strikes within 365 days")

    const notifications = await db
      .selectFrom("notification")
      .select(["type", "actorUserId"])
      .where("userId", "=", targetId)
      .where("type", "=", "account_strike")
      .execute()
    expect(notifications.length).toBe(5)
    expect(notifications.every((n) => n.actorUserId === null)).toBe(true)
  })

  it("a 6th strike does not overwrite the suspension", async () => {
    const sixth = await issueStrike({ reason: "strike 6" })
    const json = (await sixth.json()) as { activeCount: number; suspended: boolean }
    expect(json.activeCount).toBe(6)
    expect(json.suspended).toBe(false)

    const user = await fetchUser(db).getOne(targetId, ["suspensionReason"])
    expect(user?.suspensionReason).toBe("Automatic suspension: 5 strikes within 365 days")
  })

  it("revoking a strike does not auto-unsuspend", async () => {
    const list = await app.request(`/users/${targetId}/strikes`, {
      headers: { Cookie: adminCookie },
    })
    expect(list.status).toBe(200)
    const listJson = (await list.json()) as {
      data: { id: string; revokedAt: string | null }[]
      activeCount: number
    }
    expect(listJson.activeCount).toBe(6)
    const first = listJson.data.find((s) => s.revokedAt === null)
    expect(first).toBeDefined()

    const revoke = await app.request(`/users/${targetId}/strike/${first?.id ?? ""}/revoke`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    })
    expect(revoke.status).toBe(200)

    const again = await app.request(`/users/${targetId}/strike/${first?.id ?? ""}/revoke`, {
      method: "POST",
      headers: { Cookie: adminCookie },
    })
    expect(again.status).toBe(400)

    const user = await fetchUser(db).getOne(targetId, ["suspendedAt"])
    expect(user?.suspendedAt).not.toBeNull()
  })
})
