import { useMutation } from "@tanstack/react-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { Textarea } from "@ui/base/ui/textarea"
import { postApiAdminUsersByIdStrike } from "@lib/api-client/admin-generated/sdk.gen"
import { useState } from "react"
import { toast } from "sonner"

export type StrikeTarget = {
  type: "post" | "comment"
  id: string
  authorUserId: string
  authorUsername: string
}

export type StrikeDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: StrikeTarget
  /** Called after the strike is issued so callers can refresh isStriked state. */
  onStruck?: () => void
}

/**
 * Admin-only flow: issue a site-wide strike against the author of a post or
 * comment. Standalone dialog opened from the overflow menus, mirroring
 * ReportDialog's controlled open/target shape.
 */
export function StrikeDialog({ open, onOpenChange, target, onStruck }: StrikeDialogProps) {
  const [reason, setReason] = useState("")

  const strikeMutation = useMutation({
    mutationFn: () =>
      postApiAdminUsersByIdStrike({
        path: { id: target.authorUserId },
        body: {
          reason: reason.trim(),
          postId: target.type === "post" ? target.id : null,
          commentId: target.type === "comment" ? target.id : null,
        },
        throwOnError: true,
      }),
    onSuccess: ({ data }) => {
      toast.success(
        data.suspended
          ? `Strike issued (${data.activeCount} active) — u/${target.authorUsername} was auto-suspended`
          : `Strike issued (${data.activeCount} active) against u/${target.authorUsername}`,
      )
      setReason("")
      onOpenChange(false)
      onStruck?.()
    },
    onError: () => {
      toast.error("Could not issue strike")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Strike u/{target.authorUsername}</DialogTitle>
          <DialogDescription>
            Strikes are public on the user&apos;s profile and the struck {target.type} can no longer
            be edited or deleted by its author. The 5th active strike within 365 days automatically
            suspends the account.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="strike-dialog-reason">Reason</Label>
          <Textarea
            id="strike-dialog-reason"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
            }}
            placeholder="What rule-breaking behavior is this strike for?"
          />
        </div>
        <DialogFooter>
          <LoadingButton
            variant="destructive"
            disabled={reason.trim().length === 0}
            loading={strikeMutation.isPending}
            onClick={() => {
              strikeMutation.mutate()
            }}
          >
            Issue strike
          </LoadingButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
