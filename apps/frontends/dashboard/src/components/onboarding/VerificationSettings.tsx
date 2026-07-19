import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Badge } from "@ui/base/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/base/ui/card"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { LoadingButton } from "@ui/base/ui/loading-button"
import { getApiV1AuthMeOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { getApiV1OnboardingMe, patchApiV1Onboarding } from "@lib/api-client/generated/sdk.gen"
import { toast } from "sonner"

const LINK_FIELDS = [
  { key: "profileLink", label: "Public commentary profile" },
  { key: "opinionLink", label: "Serious political opinion or suggestion" },
  { key: "criticalThinkingLink", label: "Critical thinking" },
  { key: "acceptWrongLink", label: "Accepting being wrong" },
] as const

type LinkKey = (typeof LINK_FIELDS)[number]["key"]

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Awaiting review",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  },
  approved: { label: "Approved", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
}

/**
 * Settings tab showing the user's onboarding application: current status,
 * rejection reason, and an edit form for the four links. Editing while pending
 * updates in place; editing after a rejection resubmits.
 */
export function VerificationSettings() {
  const queryClient = useQueryClient()
  const application = useQuery({
    queryKey: ["onboarding-me"],
    queryFn: () => getApiV1OnboardingMe({ throwOnError: true }).then((r) => r.data.application),
  })

  const [links, setLinks] = useState<Record<LinkKey, string> | null>(null)
  useEffect(() => {
    if (application.data && links === null) {
      setLinks({
        profileLink: application.data.profileLink,
        opinionLink: application.data.opinionLink,
        criticalThinkingLink: application.data.criticalThinkingLink,
        acceptWrongLink: application.data.acceptWrongLink,
      })
    }
  }, [application.data, links])

  const update = useMutation({
    mutationFn: () => {
      if (!links) throw new Error("Application not loaded")
      return patchApiV1Onboarding({ body: links, throwOnError: true })
    },
    onSuccess: () => {
      toast.success(
        application.data?.status === "rejected"
          ? "Application resubmitted for review"
          : "Application updated",
      )
      void queryClient.invalidateQueries({ queryKey: ["onboarding-me"] })
      void queryClient.invalidateQueries({ queryKey: getApiV1AuthMeOptions().queryKey })
    },
    onError: () => {
      toast.error("Could not update your application")
    },
  })

  if (application.isLoading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>
  }

  if (!application.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You haven't submitted a membership application yet. Navigate anywhere in the app and the
            application form will appear.
          </p>
        </CardContent>
      </Card>
    )
  }

  const status = application.data.status
  const badge = STATUS_BADGE[status]
  const editable = status !== "approved"
  const valid = links !== null && LINK_FIELDS.every((f) => isHttpUrl(links[f.key].trim()))

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Verification</CardTitle>
        {badge ? <Badge className={badge.className}>{badge.label}</Badge> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status === "rejected" && application.data.rejectionReason ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
            <p className="font-semibold">Rejection reason</p>
            <p className="mt-1">{application.data.rejectionReason}</p>
            <p className="mt-1 text-muted-foreground">
              Update your links below and save to resubmit.
            </p>
          </div>
        ) : null}
        {status === "approved" ? (
          <p className="text-sm text-muted-foreground">
            Your application was approved — you have full access. These are the links you applied
            with.
          </p>
        ) : null}
        {LINK_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`verification-${field.key}`}>{field.label}</Label>
            <Input
              id={`verification-${field.key}`}
              type="url"
              disabled={!editable}
              value={links?.[field.key] ?? ""}
              onChange={(e) => {
                setLinks((prev) => (prev ? { ...prev, [field.key]: e.target.value } : prev))
              }}
            />
          </div>
        ))}
        {editable ? (
          <LoadingButton
            className="self-end"
            disabled={!valid}
            loading={update.isPending}
            onClick={() => {
              update.mutate()
            }}
          >
            {status === "rejected" ? "Resubmit application" : "Save changes"}
          </LoadingButton>
        ) : null}
      </CardContent>
    </Card>
  )
}
