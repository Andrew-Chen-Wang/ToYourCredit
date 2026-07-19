import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Badge } from "@ui/base/ui/badge"
import { Button } from "@ui/base/ui/button"
import { Input } from "@ui/base/ui/input"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/base/ui/table"
import {
  deleteApiV1InviteCodeById,
  getApiV1InviteCode,
  patchApiV1InviteCodeByIdNickname,
  postApiV1InviteCode,
} from "@lib/api-client/generated/sdk.gen"
import { Check, Copy, Pencil, X } from "lucide-react"
import { toast } from "sonner"

export const Route = createFileRoute("/referrals")({
  component: ReferralsPage,
})

const QUERY_KEY = ["invite-codes"]

function ReferralsPage() {
  const queryClient = useQueryClient()
  const codes = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => getApiV1InviteCode({ throwOnError: true }).then((r) => r.data),
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nicknameDraft, setNicknameDraft] = useState("")

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }

  const generate = useMutation({
    mutationFn: () => postApiV1InviteCode({ throwOnError: true }),
    onSuccess: () => {
      toast.success("Invite code created")
      invalidate()
    },
    onError: () => {
      toast.error("Could not create an invite code — you may have hit a limit")
    },
  })

  const revoke = useMutation({
    mutationFn: (id: string) => deleteApiV1InviteCodeById({ path: { id }, throwOnError: true }),
    onSuccess: () => {
      toast.success("Invite code revoked")
      invalidate()
    },
    onError: () => {
      toast.error("Could not revoke that code")
    },
  })

  const rename = useMutation({
    mutationFn: (vars: { id: string; nickname: string }) =>
      patchApiV1InviteCodeByIdNickname({
        path: { id: vars.id },
        body: { nickname: vars.nickname },
        throwOnError: true,
      }),
    onSuccess: () => {
      setEditingId(null)
      invalidate()
    },
    onError: () => {
      toast.error("Could not rename the referral")
    },
  })

  const data = codes.data
  const atActiveCap = data ? data.activeCount >= data.maxActive : false
  const atTotalCap = data ? data.totalCount >= data.maxTotal : false

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-2 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Referrals</h1>
        <LoadingButton
          loading={generate.isPending}
          disabled={atActiveCap || atTotalCap}
          onClick={() => {
            generate.mutate()
          }}
        >
          Generate code
        </LoadingButton>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Each code invites one person into ToYourCredit.{" "}
        {data
          ? `${data.activeCount} of ${data.maxActive} active · ${data.totalCount} of ${data.maxTotal} ever created.`
          : null}
        {atTotalCap ? " You've used all your invite codes." : ""}
      </p>

      {codes.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data || data.data.length === 0 ? (
        <div className="rounded-lg border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">
            No invite codes yet. Generate one to bring someone into the community.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Referral</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.data.map((code) => (
                <TableRow key={code.id}>
                  <TableCell className="font-mono text-xs">
                    <span className="inline-flex items-center gap-1.5">
                      {code.code}
                      {code.status === "active" ? (
                        <button
                          type="button"
                          aria-label="Copy invite code"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            void navigator.clipboard.writeText(code.code)
                            toast.success("Code copied")
                          }}
                        >
                          <Copy className="size-3.5" />
                        </button>
                      ) : null}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        code.status === "used"
                          ? "default"
                          : code.status === "active"
                            ? "secondary"
                            : "outline"
                      }
                    >
                      {code.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {code.referral ? (
                      editingId === code.id ? (
                        <span className="flex items-center gap-1.5">
                          <Input
                            value={nicknameDraft}
                            onChange={(e) => {
                              setNicknameDraft(e.target.value)
                            }}
                            className="h-7 w-40 text-sm"
                            maxLength={50}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            disabled={!nicknameDraft.trim() || rename.isPending}
                            aria-label="Save nickname"
                            onClick={() => {
                              rename.mutate({ id: code.id, nickname: nicknameDraft.trim() })
                            }}
                          >
                            <Check className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="Cancel"
                            onClick={() => {
                              setEditingId(null)
                            }}
                          >
                            <X className="size-3.5" />
                          </Button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-sm">
                          <span className="font-medium">{code.referral.nickname}</span>
                          <span className="text-muted-foreground">u/{code.referral.username}</span>
                          <button
                            type="button"
                            aria-label="Rename referral"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditingId(code.id)
                              setNicknameDraft(code.referral?.nickname ?? "")
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        </span>
                      )
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {code.status === "active" ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        disabled={revoke.isPending}
                        onClick={() => {
                          revoke.mutate(code.id)
                        }}
                      >
                        Revoke
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
