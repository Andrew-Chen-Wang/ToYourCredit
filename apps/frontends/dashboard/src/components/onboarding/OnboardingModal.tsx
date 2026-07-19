import { useEffect, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useRouterState } from "@tanstack/react-router"
import { Button } from "@ui/base/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@ui/base/ui/dialog"
import { Input } from "@ui/base/ui/input"
import { Label } from "@ui/base/ui/label"
import { getApiV1AuthMeOptions } from "@lib/api-client/generated/@tanstack/react-query.gen"
import { postApiV1Onboarding } from "@lib/api-client/generated/sdk.gen"
import { toast } from "sonner"

const LINK_FIELDS = [
  {
    key: "profileLink",
    label: "Public commentary profile",
    hint: "A profile where ALL your commentary is public (e.g. your Reddit user page).",
  },
  {
    key: "opinionLink",
    label: "Serious political opinion or suggestion",
    hint: "Direct link to a comment showing a serious political opinion or policy suggestion.",
  },
  {
    key: "criticalThinkingLink",
    label: "Critical thinking",
    hint: "Direct link to a comment demonstrating critical thinking.",
  },
  {
    key: "acceptWrongLink",
    label: "Accepting being wrong",
    hint: "Direct link to a comment where you accepted being wrong.",
  },
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

/**
 * Membership-application modal shown to signed-in users who have not yet
 * submitted their invite code + four required links. Dismissible, but reopens
 * on every navigation until the application is submitted.
 */
export function OnboardingModal() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(true)
  const [inviteCode, setInviteCode] = useState("")
  const [links, setLinks] = useState<Record<LinkKey, string>>({
    profileLink: "",
    opinionLink: "",
    criticalThinkingLink: "",
    acceptWrongLink: "",
  })

  // Reopen whenever the user navigates somewhere else.
  const routeKey = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => {
    setOpen(true)
  }, [routeKey])

  const submit = useMutation({
    mutationFn: () =>
      postApiV1Onboarding({
        body: { inviteCode: inviteCode.trim(), ...links },
        throwOnError: true,
      }),
    onSuccess: () => {
      toast.success("Application submitted — an admin will review it soon")
      void queryClient.invalidateQueries({ queryKey: getApiV1AuthMeOptions().queryKey })
    },
    onError: () => {
      toast.error("Could not submit your application. Check the invite code and links.")
    },
  })

  const valid =
    inviteCode.trim().length > 0 && LINK_FIELDS.every((f) => isHttpUrl(links[f.key].trim()))

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete your membership application</DialogTitle>
          <DialogDescription>
            ToYourCredit is an invite-only community for serious political-policy discussion. Until
            your application is approved you can read and save content, but not post, comment, or
            vote.
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid && !submit.isPending) submit.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="onboarding-invite-code">Invite code</Label>
            <Input
              id="onboarding-invite-code"
              value={inviteCode}
              onChange={(e) => {
                setInviteCode(e.target.value)
              }}
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              A single-use code from an existing member.
            </p>
          </div>
          {LINK_FIELDS.map((field) => (
            <div key={field.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`onboarding-${field.key}`}>{field.label}</Label>
              <Input
                id={`onboarding-${field.key}`}
                type="url"
                value={links[field.key]}
                onChange={(e) => {
                  setLinks((prev) => ({ ...prev, [field.key]: e.target.value }))
                }}
                placeholder="https://"
              />
              <p className="text-xs text-muted-foreground">{field.hint}</p>
            </div>
          ))}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false)
              }}
            >
              Later
            </Button>
            <Button type="submit" disabled={!valid || submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit application"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
