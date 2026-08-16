# Deploying bullground (and adding runtime env vars)

Covers the OVH production host. For SSH access see `../prod/ovh-ssh-instructions.md` (kept outside
this repo because it sits next to a private key).

```sh
ssh -i ~/.ssh/id_ovh_toyourcredit ubuntu@40.160.59.152
# or, with the ~/.ssh/config entry from those instructions:
ssh ovh-toyourcredit
```

Everything lives in `/opt/toyourcredit` on the server.

---

## The two env files — they are not interchangeable

Neither file is in this repo. Both are hand-maintained on the server and are the only copy, so
treat them as state, not as something a deploy recreates.

| File                                | Read by                                                                   | Holds                                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/opt/toyourcredit/.env`            | Docker Compose, for `${...}` interpolation **in the compose file itself** | `POSTGRES_PASSWORD`, `VALKEY_PASSWORD`, `ELASTIC_PASSWORD`, and the image tags `API_BLUE_TAG` / `API_GREEN_TAG` / `BULLGROUND_TAG` (the tags are written by the deploy scripts — don't hand-edit those) |
| `/opt/toyourcredit/.env.production` | The **containers**, via `env_file:`                                       | Application runtime config: `DATABASE_URL`, `VALKEY_URL`, `ELASTICSEARCH_URL`, the `S3_*` block (Cloudflare R2 in prod, not garage), and anything the app code reads from `process.env`                 |

The rule: **if application code reads it via `process.env`, it goes in `.env.production`.** If the
compose file interpolates it as `${...}`, it goes in `.env`.

---

## Adding a runtime env var

`CLAUDE_CODE_OAUTH_TOKEN` as the worked example — it's read by
`apps/bullground/src/feeds/classify/llm.ts`, so it belongs in `.env.production`.

```sh
ssh ovh-toyourcredit
cd /opt/toyourcredit

# Append it. Note the leading space: with default bash HISTCONTROL=ignorespace
# this keeps the secret out of ~/.bash_history.
 sudo sh -c 'printf "CLAUDE_CODE_OAUTH_TOKEN=%s\n" "sk-ant-oat01-..." >> .env.production'

# Confirm the key is present without printing its value.
grep -c '^CLAUDE_CODE_OAUTH_TOKEN=' .env.production   # -> 1

# env_file is read when a container is CREATED, not on restart.
# `restart` will NOT pick this up — the container must be recreated.
docker compose -f docker-compose.production.yml up -d --force-recreate bullground
```

Then verify the process actually sees it:

```sh
docker exec toyourcredit_bullground printenv CLAUDE_CODE_OAUTH_TOKEN | cut -c1-12
docker logs --tail 50 toyourcredit_bullground | grep feed-classify
```

Absent the credential the worker logs
`[feed-classify] no Claude credential configured; using keyword classifier` once at first use.
Silence there means it picked the token up.

### Why not `/etc/environment`?

It looks like the obvious place for a host-wide variable, and it does not work here: **Docker
containers do not inherit the host's `/etc/environment`.** That file is read by PAM when a login
session starts. The daemon does not propagate it, and a container's environment comes only from the
image, `environment:`, and `env_file:`. Setting it there leaves the variable visible to you over
SSH and invisible to the worker — which is a genuinely confusing failure, because `printenv` on the
host succeeds while the app keeps logging that no credential is configured.

It is also the wrong place for a secret regardless: `/etc/environment` is system-wide and normally
world-readable, so every user and process on the box can read it. `.env.production` is scoped to
the containers that declare it.

### Gotchas

- **No quotes.** Compose `env_file` parsing is not a shell — `FOO="bar"` makes the value include
  the quote characters.
- **Restart is not enough.** `docker compose restart` reuses the existing container and its baked-in
  environment. Use `up -d --force-recreate`.
- **`FEED_CLASSIFIER_MODEL` is optional.** Unset means `claude-opus-5`. Set it to
  `claude-haiku-4-5` to cut per-article classification cost.
- **Rotate before you paste.** Any token that has appeared in a terminal, a chat window, or a
  transcript should be replaced with a freshly issued one before it goes on the server.

---

## Deploying a new image

From a laptop with the repo checked out:

```sh
DATABASE_URL='<prod connection string>' bin/deploy/deploy.sh bullground <image-tag>
```

`deploy.sh` runs prod migrations **first**, then deploys — so the schema is always ahead of the
image, which is what the new `feed_item` / `feed_source_state` tables need. Set `SKIP_MIGRATIONS=1`
only when you know the schema is already current.

On the server, `deploy-bullground.sh` writes `BULLGROUND_TAG` into `.env`, pulls, and recreates the
container. Because that is a recreate, **a deploy also picks up `.env.production` changes** — so if
you are shipping code anyway, adding the env var beforehand means no separate recreate.

Pushing to `main` under `apps/bullground/**`, `lib/**` or `packages/**` triggers the same path via
`.github/workflows/deploy-bullground.yml`.

### Draining

bullground has a 9.5-minute SIGTERM drain and a 600s `stop_grace_period`. A deploy can therefore
take up to ten minutes to swap containers. That is deliberate — let it finish rather than killing it.

---

## After deploying the feed pipeline

```sh
# The 30-minute scheduler should be registered.
docker logs --tail 100 toyourcredit_bullground | grep feed-ingest

# Sources that failed their last fetch (the staleness signal):
#   select source_id, last_status, last_error from feed_source_state where last_status = 'error';
```

The first run posts nothing older than 24 hours and at most 3 items per source, so it ramps rather
than dumping a backlog. See [`adding-a-feed-source.md`](./adding-a-feed-source.md) for diagnosing a
source that goes quiet.
