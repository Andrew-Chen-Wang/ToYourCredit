export const metadata = {
  title: "Community Terms",
  description:
    "The four principles every ToYourCredit member agrees to: be respectful, acknowledge when you're wrong, be logical, and don't abuse.",
}

const TERMS: { title: string; body: string }[] = [
  {
    title: "Be respectful.",
    body: "Political disagreement is the entire point of this community, but contempt is not. Attack the argument, never the person — no insults, no dogpiling, no dismissing someone because of where they come from or what they believe. You can dismantle a position thoroughly while still treating its author as someone worth arguing with.",
  },
  {
    title: "Acknowledge when you're wrong.",
    body: "Being wrong in public is the price of admission here, and conceding a point is a contribution, not a defeat. When someone presents better evidence or a sharper argument, say so plainly instead of moving the goalposts or quietly disappearing from the thread. Members who cannot accept being wrong will not remain members.",
  },
  {
    title: "Be logical.",
    body: "Claims need support: cite your sources, distinguish facts from opinions, and be prepared to show your reasoning when challenged. Fallacies, strawmen, and inflammatory rhetoric drown out the discussion this community exists to have. If an argument only works when it's shouted, it doesn't work.",
  },
  {
    title: "Don't abuse.",
    body: "Don't game credit, coordinate downvotes, harass other members, or use the reason-based downvote system to punish opinions rather than flag genuine problems. The transparency of our voting only works if it's used honestly. Abuse of the platform or its members is grounds for removal.",
  },
]

export default function CommunityTermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-16">
      <h1 className="text-3xl font-bold">Community Terms</h1>
      <p className="text-muted-foreground">
        ToYourCredit is a curated community for serious discussion of political policy. Membership
        is an agreement to uphold four principles in every post, comment, and vote.
      </p>
      <ol className="flex flex-col gap-6">
        {TERMS.map(({ title, body }, i) => (
          <li key={title} className="flex gap-3">
            <span className="font-semibold text-primary">{i + 1}.</span>
            <div className="flex flex-col gap-1">
              <span className="font-semibold">{title}</span>
              <span className="text-muted-foreground">{body}</span>
            </div>
          </li>
        ))}
      </ol>
    </main>
  )
}
