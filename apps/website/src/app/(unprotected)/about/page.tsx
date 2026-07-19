import Link from "next/link"

export const metadata = {
  title: "About ToYourCredit",
  description:
    "ToYourCredit is a curated, invite-only international community for serious discussion of political policy.",
}

const DOWNVOTE_REASONS = [
  "Bad source",
  "Needs a better source",
  "Inflammatory commentary",
  "Being a dick",
  "Trolling",
  "Not willing to accept being wrong",
  "Off-topic",
  "Unsupported argument",
  "Spam",
]

export default function AboutPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold">About ToYourCredit</h1>
      <p className="text-muted-foreground">
        ToYourCredit is a curated, invite-only international community for serious discussion of
        political policy. We bring together people who want to argue in good faith: to cite their
        sources, follow the logic wherever it leads, and change their minds when the evidence
        demands it.
      </p>

      <h2 className="text-xl font-semibold">Why we exist</h2>
      <p className="text-muted-foreground">
        Our design starts from an idea that most social platforms have drifted away from:
      </p>
      <blockquote className="border-l-4 border-primary bg-muted/40 p-4 italic text-muted-foreground">
        The original purpose of Reddit&apos;s upvote and downvote system was for quality control
        rather than expressing simple likes or dislikes. Upvotes were meant to elevate content that
        contributed to the conversation, while downvotes were designed to hide off-topic,
        rule-breaking, or non-contributing posts so the community could self-regulate.
      </blockquote>
      <p className="text-muted-foreground">
        ToYourCredit takes that original intent seriously and builds it into the mechanics of the
        site itself. Here is how we differ from Reddit.
      </p>

      <h2 className="text-xl font-semibold">Credit, not karma</h2>
      <p className="text-muted-foreground">
        Our upvote is a coin called <strong>credit</strong>. Users garner credit for contributions
        that move a conversation forward — a well-sourced argument, a sharp question, a genuine
        concession. And unlike an anonymous upvote, credit is given in the open: the list of users
        who gave credit to a post or comment is public. Hover over the count to see how many, and
        press it to see exactly who.
      </p>

      <h2 className="text-xl font-semibold">Downvotes require a reason</h2>
      <p className="text-muted-foreground">
        There is no bare downvote on ToYourCredit. To downvote, you must choose one or more stated
        reasons:
      </p>
      <ul className="flex flex-col gap-1 text-muted-foreground">
        {DOWNVOTE_REASONS.map((reason) => (
          <li key={reason} className="flex gap-3">
            <span className="text-primary">•</span>
            <span>{reason}</span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        You can select as many reasons as apply, but you only count once toward the downvote total.
        Per-reason counts are visible on every post and comment, and pressing a count reveals
        exactly who downvoted and why. Downvoters are publicly accountable — which prevents the
        anonymous pile-ons that turn other platforms into echo chambers.
      </p>
      <p className="text-muted-foreground">
        The voting system is not one-size-fits-all: individual communities can change it if their
        needs call for something different.
      </p>

      <h2 className="text-xl font-semibold">Membership by invitation</h2>
      <p className="text-muted-foreground">
        Joining ToYourCredit requires an invite code from an existing member, plus an application
        with links demonstrating that you can offer serious political opinion, critical thinking,
        and — most importantly — acceptance of being wrong. Applicants must also provide a
        fully-public commentary history, such as a Reddit profile where everything is visible. Every
        application is reviewed before approval. Curation is the point: a smaller community that
        argues well beats a larger one that argues loudly.
      </p>

      <p className="text-muted-foreground">
        Everyone here agrees to the same standards. Read our{" "}
        <Link
          href="/community-terms"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Community Terms
        </Link>{" "}
        and the{" "}
        <Link href="/rules" className="font-medium text-primary underline-offset-4 hover:underline">
          site rules
        </Link>{" "}
        to see what we expect from every member.
      </p>
    </main>
  )
}
