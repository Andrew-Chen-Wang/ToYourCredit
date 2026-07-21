import { useEffect, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
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
import { LoadingButton } from "@ui/base/ui/loading-button"
import {
  getApiV1AuthMeOptions,
  getApiV1UserMeOptions,
  getApiV1UserUsernameAvailableOptions,
} from "@lib/api-client/generated/@tanstack/react-query.gen"
import {
  postApiV1Onboarding,
  postApiV1OnboardingCheckCode,
  postApiV1OnboardingUsername,
} from "@lib/api-client/generated/sdk.gen"
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

const USERNAME_PATTERN = /^[A-Za-z0-9_-]{3,20}$/

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
 * submitted their application. Three steps: claim a username (first-come-first-served,
 * doesn't consume the one-time change), then an optional invite code (it only
 * records who referred you), then the four required links — admin superuser
 * bypass codes skip the links entirely and auto-verify on Next. Dismissible,
 * but reopens on every navigation until done.
 */
export function OnboardingModal() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(true)
  const [step, setStep] = useState<"username" | "code" | "links">("username")
  const [inviteCode, setInviteCode] = useState("")
  const [codeError, setCodeError] = useState<string | null>(null)
  const [links, setLinks] = useState<Record<LinkKey, string>>({
    profileLink: "",
    opinionLink: "",
    criticalThinkingLink: "",
    acceptWrongLink: "",
  })

  const { data: me } = useQuery(getApiV1UserMeOptions())
  const [username, setUsername] = useState<string | null>(null)
  // Seed the draft with the auto-generated username once loaded.
  const draft = username ?? me?.username ?? ""
  const [debouncedDraft, setDebouncedDraft] = useState("")
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDraft(draft.trim())
    }, 400)
    return () => {
      clearTimeout(timer)
    }
  }, [draft])

  // Reopen whenever the user navigates somewhere else.
  const routeKey = useRouterState({ select: (s) => s.location.pathname })
  useEffect(() => {
    setOpen(true)
  }, [routeKey])

  const submit = useMutation({
    mutationFn: (body: { inviteCode?: string } & Partial<Record<LinkKey, string>>) =>
      postApiV1Onboarding({ body, throwOnError: true }),
    onSuccess: ({ data }) => {
      toast.success(
        data.superuser
          ? "Welcome — your account is verified"
          : "Application submitted — an admin will review it soon",
      )
      void queryClient.invalidateQueries({ queryKey: getApiV1AuthMeOptions().queryKey })
    },
    onError: () => {
      toast.error("Could not submit your application. Check the links and try again.")
    },
  })

  // Own current username reads as "taken" from this endpoint, so skip the check
  // when the draft is unchanged — keeping it is always allowed.
  const isOwnUsername = debouncedDraft.toLowerCase() === me?.username.toLowerCase()
  const availability = useQuery({
    ...getApiV1UserUsernameAvailableOptions({ query: { username: debouncedDraft } }),
    enabled: USERNAME_PATTERN.test(debouncedDraft) && me != null && !isOwnUsername,
  })

  const claim = useMutation({
    mutationFn: (claimed: string) =>
      postApiV1OnboardingUsername({ body: { username: claimed }, throwOnError: true }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: getApiV1UserMeOptions().queryKey })
      setStep("code")
    },
    onError: () => {
      toast.error("Could not claim that username — it may have just been taken.")
      void availability.refetch()
    },
  })

  const checkCode = useMutation({
    mutationFn: () =>
      postApiV1OnboardingCheckCode({
        body: { inviteCode: inviteCode.trim() },
        throwOnError: true,
      }),
    onSuccess: ({ data }) => {
      if (!data.valid) {
        setCodeError("That invite code is not valid or was already used.")
        return
      }
      if (data.superuser) {
        // Admin bypass: no links needed, submit right away.
        submit.mutate({ inviteCode: inviteCode.trim() })
        return
      }
      setStep("links")
    },
    onError: () => {
      setCodeError("Could not check that code. Try again.")
    },
  })

  const linksValid = LINK_FIELDS.every((f) => isHttpUrl(links[f.key].trim()))
  const busy = claim.isPending || checkCode.isPending || submit.isPending

  const usernameValid = USERNAME_PATTERN.test(draft.trim())
  const usernameTaken =
    !isOwnUsername && debouncedDraft === draft.trim() && availability.data?.available === false

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Complete your membership application</DialogTitle>
          <DialogDescription>
            ToYourCredit is an application-based community for serious political-policy discussion.
            Until your application is approved you can read and save content, but not post, comment,
            or vote.
          </DialogDescription>
        </DialogHeader>

        {step === "username" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (busy || !usernameValid || usernameTaken) return
              const next = draft.trim()
              // Keeping the current name needs no claim.
              if (next.toLowerCase() === me?.username.toLowerCase()) {
                setStep("code")
                return
              }
              claim.mutate(next)
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onboarding-username">Username</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">u/</span>
                <Input
                  id="onboarding-username"
                  value={draft}
                  maxLength={20}
                  autoComplete="off"
                  onChange={(e) => {
                    setUsername(e.target.value.replace(/\s/g, ""))
                  }}
                />
              </div>
              {usernameTaken ? (
                <p className="text-xs text-destructive">That username is taken.</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Claim your username now — this doesn&apos;t use your one-time username change
                  later. 3-20 letters, numbers, underscores, or hyphens.
                </p>
              )}
            </div>
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
              <LoadingButton
                type="submit"
                disabled={!usernameValid || usernameTaken}
                loading={claim.isPending}
              >
                Next
              </LoadingButton>
            </div>
          </form>
        ) : step === "code" ? (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (busy) return
              setCodeError(null)
              // No code entered: the code is optional, go straight to the links.
              if (inviteCode.trim()) {
                checkCode.mutate()
              } else {
                setStep("links")
              }
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="onboarding-invite-code">Invite code</Label>
              <Input
                id="onboarding-invite-code"
                value={inviteCode}
                onChange={(e) => {
                  setInviteCode(e.target.value)
                  setCodeError(null)
                }}
                placeholder="XXXX-XXXX-XXXX"
                autoComplete="off"
              />
              {codeError ? (
                <p className="text-xs text-destructive">{codeError}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Optional — a single-use code from an existing member, so we know who referred you.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("username")
                }}
              >
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false)
                  }}
                >
                  Later
                </Button>
                <LoadingButton type="submit" loading={busy}>
                  Next
                </LoadingButton>
              </div>
            </div>
          </form>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (linksValid && !busy) {
                const code = inviteCode.trim()
                submit.mutate({ ...(code ? { inviteCode: code } : {}), ...links })
              }
            }}
          >
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
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStep("code")
                }}
              >
                Back
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setOpen(false)
                  }}
                >
                  Later
                </Button>
                <LoadingButton type="submit" disabled={!linksValid} loading={submit.isPending}>
                  Submit application
                </LoadingButton>
              </div>
            </div>
          </form>
        )}

        <div className="flex items-center justify-center gap-2" aria-hidden="true">
          {(["username", "code", "links"] as const).map((s) => (
            <span
              key={s}
              className={`size-2 rounded-full transition-colors ${
                step === s ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
