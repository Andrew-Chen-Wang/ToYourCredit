import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Badge } from "@ui/base/ui/badge"
import { Button } from "@ui/base/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/base/ui/table"
import { Textarea } from "@ui/base/ui/textarea"
import {
  getApiAdminUsersByIdStrikesOptions,
  getApiAdminUsersByIdStrikesQueryKey,
  getApiAdminUsersOptions,
  getApiAdminUsersQueryKey,
  postApiAdminUsersByIdStrikeByStrikeIdRevokeMutation,
  postApiAdminUsersByIdStrikeMutation,
  postApiAdminUsersByIdSuspendMutation,
  postApiAdminUsersByIdUnsuspendMutation,
} from "@frontends/admin/lib/adminApi"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/users")({
  component: UsersPage,
})

interface SuspendTarget {
  id: string
  username: string
}

interface StrikeTarget {
  id: string
  username: string
}

function UsersPage() {
  const queryClient = useQueryClient()
  const [input, setInput] = useState("")
  const [q, setQ] = useState("")
  const [suspendTarget, setSuspendTarget] = useState<SuspendTarget | null>(null)
  const [reason, setReason] = useState("")
  const [strikeTarget, setStrikeTarget] = useState<StrikeTarget | null>(null)
  const [strikeReason, setStrikeReason] = useState("")
  const [strikesViewTarget, setStrikesViewTarget] = useState<StrikeTarget | null>(null)

  const listOptions = getApiAdminUsersOptions({ query: q ? { q } : {} })
  const { data, isLoading } = useQuery(listOptions)

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getApiAdminUsersQueryKey() })
  }

  const suspendMutation = useMutation({
    ...postApiAdminUsersByIdSuspendMutation(),
    onSuccess: () => {
      toast.success("User suspended")
      setSuspendTarget(null)
      setReason("")
      invalidate()
    },
    onError: () => toast.error("Could not suspend user"),
  })

  const unsuspendMutation = useMutation({
    ...postApiAdminUsersByIdUnsuspendMutation(),
    onSuccess: () => {
      toast.success("Suspension lifted")
      invalidate()
    },
    onError: () => toast.error("Could not lift suspension"),
  })

  const strikeMutation = useMutation({
    ...postApiAdminUsersByIdStrikeMutation(),
    onSuccess: (result, variables) => {
      toast.success(
        result.suspended
          ? `Strike issued (${result.activeCount} active) — user was auto-suspended`
          : `Strike issued (${result.activeCount} active)`,
      )
      setStrikeTarget(null)
      setStrikeReason("")
      invalidate()
      void queryClient.invalidateQueries({
        queryKey: getApiAdminUsersByIdStrikesQueryKey({ path: { id: variables.path.id } }),
      })
    },
    onError: () => toast.error("Could not issue strike"),
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Users</h1>
      </div>

      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setQ(input.trim())
        }}
      >
        <Input
          placeholder="Search by username or email"
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
          }}
          className="max-w-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Karma</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Strikes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !data || data.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              data.data.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">u/{user.username}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>{(user.postKarma + user.commentKarma).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto px-1.5 py-0.5"
                      onClick={() => {
                        setStrikesViewTarget({ id: user.id, username: user.username })
                      }}
                    >
                      <Badge variant={user.activeStrikeCount >= 3 ? "destructive" : "secondary"}>
                        {user.activeStrikeCount}
                      </Badge>
                    </Button>
                  </TableCell>
                  <TableCell>
                    {user.suspendedAt ? (
                      <Badge variant="destructive">Suspended</Badge>
                    ) : (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      className="mr-2"
                      onClick={() => {
                        setStrikeTarget({ id: user.id, username: user.username })
                      }}
                    >
                      Strike
                    </Button>
                    {user.suspendedAt ? (
                      <LoadingButton
                        variant="outline"
                        size="sm"
                        loading={
                          unsuspendMutation.isPending &&
                          unsuspendMutation.variables?.path?.id === user.id
                        }
                        onClick={() => {
                          unsuspendMutation.mutate({ path: { id: user.id } })
                        }}
                      >
                        Unsuspend
                      </LoadingButton>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSuspendTarget({ id: user.id, username: user.username })
                        }}
                      >
                        Suspend
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={suspendTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSuspendTarget(null)
            setReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend u/{suspendTarget?.username}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
              }}
              placeholder="Why is this account being suspended?"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSuspendTarget(null)
              }}
            >
              Cancel
            </Button>
            <LoadingButton
              variant="destructive"
              loading={suspendMutation.isPending}
              onClick={() => {
                if (!suspendTarget) return
                suspendMutation.mutate({
                  path: { id: suspendTarget.id },
                  body: { reason: reason.trim() ? reason.trim() : null },
                })
              }}
            >
              Suspend
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={strikeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setStrikeTarget(null)
            setStrikeReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Strike u/{strikeTarget?.username}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Strikes are public on the user&apos;s profile. The 5th active strike within 365 days
            automatically suspends the account.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="strike-reason">Reason</Label>
            <Textarea
              id="strike-reason"
              value={strikeReason}
              onChange={(e) => {
                setStrikeReason(e.target.value)
              }}
              placeholder="What rule-breaking behavior is this strike for?"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setStrikeTarget(null)
              }}
            >
              Cancel
            </Button>
            <LoadingButton
              variant="destructive"
              disabled={strikeReason.trim().length === 0}
              loading={strikeMutation.isPending}
              onClick={() => {
                if (!strikeTarget) return
                strikeMutation.mutate({
                  path: { id: strikeTarget.id },
                  body: { reason: strikeReason.trim() },
                })
              }}
            >
              Issue strike
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserStrikesDialog
        target={strikesViewTarget}
        onClose={() => {
          setStrikesViewTarget(null)
        }}
        onChanged={invalidate}
      />
    </div>
  )
}

function UserStrikesDialog({
  target,
  onClose,
  onChanged,
}: {
  target: StrikeTarget | null
  onClose: () => void
  onChanged: () => void
}) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    ...getApiAdminUsersByIdStrikesOptions({ path: { id: target?.id ?? "" } }),
    enabled: target !== null,
  })

  const revokeMutation = useMutation({
    ...postApiAdminUsersByIdStrikeByStrikeIdRevokeMutation(),
    onSuccess: (_data, variables) => {
      toast.success(
        "Strike revoked. The user remains suspended if they were — unsuspend manually if appropriate.",
      )
      void queryClient.invalidateQueries({
        queryKey: getApiAdminUsersByIdStrikesQueryKey({ path: { id: variables.path.id } }),
      })
      onChanged()
    },
    onError: () => toast.error("Could not revoke strike"),
  })

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Strikes for u/{target?.username}
            {data ? ` — ${String(data.activeCount)} active` : ""}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : !data || data.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No strikes.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.data.map((strike) => (
              <li key={strike.id} className="rounded-md border p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {strike.revokedAt ? (
                      <Badge variant="outline">Revoked</Badge>
                    ) : strike.active ? (
                      <Badge variant="destructive">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Expired</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(strike.createdAt).toLocaleDateString()}
                      {strike.issuedByUsername ? ` · by u/${strike.issuedByUsername}` : ""}
                      {strike.revokedAt && strike.revokedByUsername
                        ? ` · revoked by u/${strike.revokedByUsername}`
                        : ""}
                    </span>
                  </div>
                  {!strike.revokedAt && (
                    <LoadingButton
                      variant="outline"
                      size="sm"
                      loading={
                        revokeMutation.isPending &&
                        revokeMutation.variables?.path?.strikeId === strike.id
                      }
                      onClick={() => {
                        if (!target) return
                        revokeMutation.mutate({ path: { id: target.id, strikeId: strike.id } })
                      }}
                    >
                      Revoke
                    </LoadingButton>
                  )}
                </div>
                <p className="text-sm">{strike.reason}</p>
                {(strike.postId ?? strike.commentId) && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Attached to{" "}
                    {strike.postId ? `post ${strike.postId}` : `comment ${strike.commentId ?? ""}`}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
