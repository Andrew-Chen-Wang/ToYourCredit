import { db } from "@template-nextjs/db"
import { v7 } from "uuid"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { crudUserStrike } from "./crud"
import { fetchUserStrike } from "./fetch"

declare const process: { env: Record<string, string | undefined> }

const suffix = v7().slice(0, 8)
const userId = v7()
const adminId = v7()
const communityId = v7()
const postId = v7()

beforeAll(async () => {
  await db
    .insertInto("user")
    .values([
      { id: userId, username: `stk-u-${suffix}`, email: `stku-${suffix}@example.invalid` },
      {
        id: adminId,
        username: `stk-a-${suffix}`,
        email: `stka-${suffix}@example.invalid`,
        isAdmin: true,
      },
    ])
    .execute()
  await db
    .insertInto("community")
    .values({
      id: communityId,
      name: `stktest${suffix}`,
      description: "strike test",
      visibility: "public",
      memberCount: 0,
    })
    .execute()
  await db
    .insertInto("post")
    .values({
      id: postId,
      authorUserId: userId,
      communityId,
      type: "text",
      title: `striked post ${suffix}`,
    })
    .execute()
})

afterAll(async () => {
  await db.deleteFrom("userStrike").where("userId", "=", userId).execute()
  await db.deleteFrom("post").where("id", "=", postId).execute()
  await db.deleteFrom("community").where("id", "=", communityId).execute()
  await db.deleteFrom("user").where("id", "in", [userId, adminId]).execute()
  await db.destroy()
})

describe.skipIf(process.env.CI === "true")("user strike DAO", () => {
  it("counts issued strikes within the rolling window", async () => {
    expect(await fetchUserStrike(db).countActive(userId)).toBe(0)

    await crudUserStrike(db).issue({ userId, issuedByUserId: adminId, reason: "first strike" })
    expect(await fetchUserStrike(db).countActive(userId)).toBe(1)
  })

  it("excludes strikes older than 365 days from the active count but keeps them listed", async () => {
    const oldId = v7()
    await db
      .insertInto("userStrike")
      .values({
        id: oldId,
        userId,
        issuedByUserId: adminId,
        reason: "ancient strike",
        createdAt: new Date(Date.now() - 366 * 24 * 60 * 60 * 1000),
      })
      .execute()

    expect(await fetchUserStrike(db).countActive(userId)).toBe(1)
    const listed = await fetchUserStrike(db).listForUser(userId, ["id"])
    expect(listed.map((s) => s.id)).toContain(oldId)
  })

  it("flags content with an active strike and enforces one active strike per content", async () => {
    expect(await fetchUserStrike(db).hasActiveForContent({ postId })).toBe(false)

    const strike = await crudUserStrike(db).issue({
      userId,
      issuedByUserId: adminId,
      reason: "strike on post",
      postId,
    })
    expect(await fetchUserStrike(db).hasActiveForContent({ postId })).toBe(true)

    await expect(
      crudUserStrike(db).issue({ userId, issuedByUserId: adminId, reason: "dup", postId }),
    ).rejects.toThrow("duplicate key")

    expect(await crudUserStrike(db).revoke(strike.id, adminId)).toBe(true)
    expect(await fetchUserStrike(db).hasActiveForContent({ postId })).toBe(false)
  })

  it("revoking is idempotent and revoked strikes stop counting", async () => {
    const strike = await crudUserStrike(db).issue({
      userId,
      issuedByUserId: adminId,
      reason: "to revoke",
    })
    const before = await fetchUserStrike(db).countActive(userId)

    expect(await crudUserStrike(db).revoke(strike.id, adminId)).toBe(true)
    expect(await crudUserStrike(db).revoke(strike.id, adminId)).toBe(false)
    expect(await fetchUserStrike(db).countActive(userId)).toBe(before - 1)

    const publicList = await fetchUserStrike(db).listForUser(userId, ["id"])
    expect(publicList.map((s) => s.id)).not.toContain(strike.id)

    const adminList = await fetchUserStrike(db).listForUserAdmin(userId)
    const revoked = adminList.find((s) => s.id === strike.id)
    expect(revoked?.revokedAt).not.toBeNull()
    expect(revoked?.revokedByUsername).toBe(`stk-a-${suffix}`)
  })
})
