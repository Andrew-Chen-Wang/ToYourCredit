import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Badge } from "@ui/base/ui/badge"
import { Button } from "@ui/base/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/base/ui/table"
import { Textarea } from "@ui/base/ui/textarea"
import {
  getApiAdminInviteCodeOptions,
  getApiAdminInviteCodeQueryKey,
  getApiAdminOnboardingInfiniteOptions,
  getApiAdminOnboardingInfiniteQueryKey,
  postApiAdminInviteCodeMutation,
  postApiAdminOnboardingByIdApproveMutation,
  postApiAdminOnboardingByIdRejectMutation,
} from "@frontends/admin/lib/adminApi"
import { useState } from "react"
import { toast } from "sonner"

export const Route = createFileRoute("/onboarding")({
  component: OnboardingPage,
})

type StatusFilter = "pending" | "approved" | "rejected"

const STATUS_FILTERS: StatusFilter[] = ["pending", "approved", "rejected"]

const STATUS_LABELS: Record<StatusFilter, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
}

function SuperuserCodesCard() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery(getApiAdminInviteCodeOptions())
  const codes = data?.data ?? []

  const createMutation = useMutation({
    ...postApiAdminInviteCodeMutation(),
    onSuccess: ({ code }) => {
      toast.success(`Superuser code created: ${code}`)
      void queryClient.invalidateQueries({ queryKey: getApiAdminInviteCodeQueryKey() })
    },
    onError: () => toast.error("Could not create superuser code"),
  })

  return (
    <div className="mb-8">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Superuser invite codes</h2>
          <p className="text-sm text-muted-foreground">
            Single-use codes that skip the four-link application and auto-verify the redeemer.
          </p>
        </div>
        <LoadingButton
          loading={createMutation.isPending}
          onClick={() => {
            createMutation.mutate({})
          }}
        >
          Generate code
        </LoadingButton>
      </div>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Created by</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Redeemed by</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : codes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No superuser codes yet.
                </TableCell>
              </TableRow>
            ) : (
              codes.map((code) => (
                <TableRow key={code.id}>
                  <TableCell className="font-mono text-xs">
                    <button
                      type="button"
                      className="hover:underline"
                      title="Copy code"
                      onClick={() => {
                        void navigator.clipboard.writeText(code.code)
                        toast.success("Code copied")
                      }}
                    >
                      {code.code}
                    </button>
                  </TableCell>
                  <TableCell>u/{code.createdByUsername}</TableCell>
                  <TableCell>{new Date(code.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {code.usedByUsername ? (
                      <span>u/{code.usedByUsername}</span>
                    ) : (
                      <Badge variant="secondary">unused</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

interface RejectTarget {
  id: string
  username: string
}

function OnboardingPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<StatusFilter>("pending")
  const [rejectTarget, setRejectTarget] = useState<RejectTarget | null>(null)
  const [reason, setReason] = useState("")

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    ...getApiAdminOnboardingInfiniteOptions({ query: { status } }),
    initialPageParam: {},
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  const applications = data?.pages.flatMap((page) => page.data) ?? []

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getApiAdminOnboardingInfiniteQueryKey() })
  }

  const approveMutation = useMutation({
    ...postApiAdminOnboardingByIdApproveMutation(),
    onSuccess: () => {
      toast.success("Application approved")
      invalidate()
    },
    onError: () => toast.error("Could not approve application"),
  })

  const rejectMutation = useMutation({
    ...postApiAdminOnboardingByIdRejectMutation(),
    onSuccess: () => {
      toast.success("Application rejected")
      setRejectTarget(null)
      setReason("")
      invalidate()
    },
    onError: () => toast.error("Could not reject application"),
  })

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Onboarding</h1>
      </div>

      <SuperuserCodesCard />

      <div className="mb-4 flex gap-2">
        {STATUS_FILTERS.map((filter) => (
          <Button
            key={filter}
            variant={status === filter ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setStatus(filter)
            }}
          >
            {STATUS_LABELS[filter]}
          </Button>
        ))}
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Inviter</TableHead>
              <TableHead>Links</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No applications found.
                </TableCell>
              </TableRow>
            ) : (
              applications.map((application) => (
                <TableRow key={application.id}>
                  <TableCell>
                    <div className="font-medium">u/{application.applicant.username}</div>
                    <div className="text-muted-foreground">{application.applicant.email}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(application.submittedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {application.inviter ? `u/${application.inviter.username}` : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <ExternalLink href={application.profileLink} label="Profile" />
                      <ExternalLink href={application.opinionLink} label="Opinion" />
                      <ExternalLink
                        href={application.criticalThinkingLink}
                        label="Critical thinking"
                      />
                      <ExternalLink
                        href={application.acceptWrongLink}
                        label="Accepts being wrong"
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={application.status} />
                    {application.status === "rejected" && application.rejectionReason ? (
                      <div className="mt-1 max-w-xs text-xs text-muted-foreground">
                        {application.rejectionReason}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right">
                    {application.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <LoadingButton
                          variant="outline"
                          size="sm"
                          loading={
                            approveMutation.isPending &&
                            approveMutation.variables?.path?.id === application.id
                          }
                          onClick={() => {
                            approveMutation.mutate({ path: { id: application.id } })
                          }}
                        >
                          Approve
                        </LoadingButton>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setRejectTarget({
                              id: application.id,
                              username: application.applicant.username,
                            })
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {hasNextPage ? (
        <div className="mt-4 flex justify-center">
          <LoadingButton
            variant="outline"
            loading={isFetchingNextPage}
            onClick={() => {
              void fetchNextPage()
            }}
          >
            Load more
          </LoadingButton>
        </div>
      ) : null}

      <Dialog
        open={rejectTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null)
            setReason("")
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject u/{rejectTarget?.username}&apos;s application</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reject-reason">Reason</Label>
            <Textarea
              id="reject-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
              }}
              placeholder="Why is this application being rejected?"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null)
              }}
            >
              Cancel
            </Button>
            <LoadingButton
              variant="destructive"
              loading={rejectMutation.isPending}
              disabled={!reason.trim()}
              onClick={() => {
                if (!rejectTarget) return
                rejectMutation.mutate({
                  path: { id: rejectTarget.id },
                  body: { reason: reason.trim() },
                })
              }}
            >
              Reject
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-sm text-primary hover:underline"
    >
      {label}
    </a>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return <Badge>Approved</Badge>
  }
  if (status === "rejected") {
    return <Badge variant="destructive">Rejected</Badge>
  }
  return <Badge variant="secondary">Pending</Badge>
}
