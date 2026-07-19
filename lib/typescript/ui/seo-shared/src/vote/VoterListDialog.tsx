"use client"

import { useCallback, useEffect, useState } from "react"
import { Avatar, AvatarFallback } from "@ui/base/ui/avatar"
import { Button } from "@ui/base/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ui/base/ui/dialog"
import { SeoLink } from "@ui/seo-shared/_internal/seo-link"
import { RelativeTime } from "@ui/seo-shared/RelativeTime"

export type VoterListItem = {
  userId: string
  username: string
  displayName: string | null
  votedAt: string | Date
}

export type VoterListPage = {
  data: VoterListItem[]
  nextCursor: string | null
}

export type VoterListDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** Fetches one page of voters; called again with `nextCursor` on "Load more". */
  fetchPage: (cursor?: string) => Promise<VoterListPage>
  /** Builds the profile href for a username (router-specific). */
  userHref?: (username: string) => string
}

/**
 * Public voter list: who gave credit, or who downvoted (optionally per category).
 * Fetch-agnostic — the caller supplies `fetchPage` backed by the relevant
 * upvoters/downvoters endpoint.
 */
export function VoterListDialog({
  open,
  onOpenChange,
  title,
  fetchPage,
  userHref,
}: VoterListDialogProps) {
  const [voters, setVoters] = useState<VoterListItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const loadFirstPage = useCallback(() => {
    setLoading(true)
    setError(false)
    fetchPage()
      .then((page) => {
        setVoters(page.data)
        setNextCursor(page.nextCursor)
      })
      .catch(() => {
        setError(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [fetchPage])

  useEffect(() => {
    if (open) {
      loadFirstPage()
    } else {
      setVoters([])
      setNextCursor(null)
      setError(false)
    }
  }, [open, loadFirstPage])

  function loadMore() {
    if (!nextCursor) return
    setLoading(true)
    fetchPage(nextCursor)
      .then((page) => {
        setVoters((prev) => [...prev, ...page.data])
        setNextCursor(page.nextCursor)
      })
      .catch(() => {
        setError(true)
      })
      .finally(() => {
        setLoading(false)
      })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[70vh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-muted-foreground">Couldn't load voters.</p>
        ) : voters.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground">No one yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {voters.map((voter) => {
              const name = (
                <>
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs uppercase">
                      {voter.username.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate font-medium">u/{voter.username}</span>
                  <span className="text-xs text-muted-foreground">
                    <RelativeTime date={voter.votedAt} />
                  </span>
                </>
              )
              return (
                <li key={voter.userId}>
                  {userHref ? (
                    <SeoLink
                      href={userHref(voter.username)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      {name}
                    </SeoLink>
                  ) : (
                    <span className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                      {name}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {nextCursor && !loading ? (
          <Button variant="outline" size="sm" onClick={loadMore}>
            Load more
          </Button>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
