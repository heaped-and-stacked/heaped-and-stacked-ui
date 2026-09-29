import { useState } from "react";
import {
  useAddInvite,
  useCurrentUser,
  useDeleteUser,
  useInvites,
  useOverview,
  useRemoveInvite,
  useUpdateUserRole,
  useUpdateUserStatus,
  useUsers,
} from "@/api/queries";
import type { User, UserRole } from "@/api/types";
import { NotFound } from "@/components/Layout";
import {
  Avatar,
  Badge,
  Button,
  ErrorMessage,
  inputClass,
  Loading,
  PAGE_SIZE,
  PageHeading,
  Pager,
  Stat,
} from "@/components/ui";
import { roleLabels } from "@/labels";

/**
 * Where the head coach (admin) manages people: who is gym staff, who is blocked, and deleting an
 * account on request (optionally with their sets, votes and feedback). Changing someone's role,
 * blocking or deleting them signs them out everywhere; they pick up a new role at their next
 * sign-in. The house account, which owns the gym's content, can't be changed.
 *
 * At the top, the head coach's numbers: members, this week's newcomers, athletes and sets, open
 * feedback and exercises waiting for approval. Then INVITES: who may sign in while the gym is
 * invite-only (none: anyone may).
 *
 * To anyone but an admin, visitors included, this page doesn't exist: they get the usual 404, and
 * nothing links here for them (the FRONT DESK button shows only to admins). The API refuses them too.
 */
export function FrontDeskPage() {
  const { data: user, isPending, error } = useCurrentUser();

  if (isPending) return <Loading what="checking your membership card" />;
  if (error) return <ErrorMessage error={error} />;
  if (user?.role !== "ADMIN") return <NotFound />;

  return (
    <>
      <PageHeading prompt="sudo ls /members" title="FRONT DESK">
        Who trains here, and who helps run the place.
      </PageHeading>
      <GymOverview />
      <Invites />
      <Members me={user} />
    </>
  );
}

/**
 * The head coach's numbers: who trains here, this week's activity (green), and what waits for a
 * decision (amber). Rendered only for admins, so nobody else asks the API for them.
 */
function GymOverview() {
  const { data: overview, isPending, error } = useOverview();
  return (
    <section aria-label="Gym overview" className="mt-10">
      {isPending && <Loading what="counting heads" />}
      <ErrorMessage error={error} />
      {overview && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 xl:grid-cols-6">
          <Stat value={overview.users} label="members" color="text-pixel" />
          <Stat
            value={overview.newUsersThisWeek}
            label="new members this week"
            color="text-pixel"
          />
          <Stat
            value={overview.activeUsersThisWeek}
            label="athletes active this week"
            color="text-pixel"
          />
          <Stat value={overview.answersThisWeek} label="sets this week" color="text-pixel" />
          <Stat value={overview.openReports} label="open feedback" color="text-amber-ink" />
          <Stat
            value={overview.questionsAwaitingReview}
            label="exercises waiting for approval"
            color="text-amber-ink"
          />
        </div>
      )}
    </section>
  );
}

// The roles the front desk gives. Admins come only from the API's configuration
// (BOOTSTRAP_ADMIN_IDS): an admin's role isn't changed here.
const roles: UserRole[] = ["MEMBER", "STAFF"];

/**
 * Who may sign in: with no invites anyone with a GitHub account can; with any, only the invited
 * usernames (in any case) and head coaches. A change applies at the next sign-in, no restart:
 * removing someone doesn't end a session they already have (BLOCK does).
 */
function Invites() {
  const { data: invites, error } = useInvites();
  const addInvite = useAddInvite();
  const removeInvite = useRemoveInvite();
  const [login, setLogin] = useState("");

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    addInvite.mutate(login.trim(), { onSuccess: () => setLogin("") });
  };

  return (
    <section className="mt-10">
      <p className="font-display text-[9px] text-ink/70">INVITES</p>
      <p className="mt-2 text-xs font-semibold text-faded">
        {invites && invites.length > 0
          ? "// invite-only: only these GitHub accounts and head coaches can sign in. Remove them all to open it again."
          : "// open: anyone with a GitHub account can sign in. Add a username to make it invite-only."}
      </p>
      <form onSubmit={add} className="mt-3 flex flex-wrap items-center gap-3">
        <input
          aria-label="GitHub username to invite"
          value={login}
          onChange={(event) => {
            setLogin(event.target.value);
            addInvite.reset();
          }}
          placeholder="github username"
          className={`${inputClass} mt-0! max-w-64`}
        />
        <Button type="submit" size="sm" disabled={login.trim() === "" || addInvite.isPending}>
          + INVITE
        </Button>
      </form>
      <ErrorMessage error={error ?? addInvite.error ?? removeInvite.error} />
      {invites && invites.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {invites.map((invite) => (
            <span
              key={invite.id}
              className="flex items-center gap-2 border-2 border-line bg-card px-2 py-1 text-xs font-semibold"
            >
              {invite.login}
              <button
                type="button"
                onClick={() => {
                  addInvite.reset();
                  removeInvite.mutate(invite.id);
                }}
                disabled={removeInvite.isPending}
                aria-label={`Remove the invite for ${invite.login}`}
                title="Remove the invite: they can't sign in again (a session they have keeps going)"
                className="text-faded hover:text-danger"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function Members({ me }: { me: User }) {
  const { data: users, isPending, error } = useUsers();
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();
  const deleteUser = useDeleteUser();
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(0);
  const busy = updateRole.isPending || updateStatus.isPending || deleteUser.isPending;

  const nameOf = (user: User) => user.displayName ?? "athlete";
  const needle = filter.trim().toLowerCase();
  const shown =
    users?.filter(
      (user) => !needle || nameOf(user).toLowerCase().includes(needle) || `#${user.id}` === needle,
    ) ?? [];
  // Everyone is loaded already (the filter needs them all), so the pages are cut here.
  const totalPages = Math.ceil(shown.length / PAGE_SIZE);
  // A list that shrank under the page shows its new last page.
  const current = Math.min(page, Math.max(totalPages - 1, 0));
  const pageUsers = shown.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const changeRole = (user: User, role: UserRole) => {
    if (
      window.confirm(
        `Make ${nameOf(user)} ${roleLabels[role].toLowerCase()}? They'll be signed out, and get it at their next sign-in.`,
      )
    ) {
      updateRole.mutate({ userId: user.id, role });
    }
  };

  const block = (user: User) => {
    if (
      window.confirm(
        `Block ${nameOf(user)}? They're signed out at once and can't sign in until you let them back.`,
      )
    ) {
      updateStatus.mutate({ userId: user.id, status: "BLOCKED" });
    }
  };

  // Two questions, so nothing is erased by a slip: delete at all, then erase the activity too.
  const remove = (user: User) => {
    if (
      !window.confirm(
        `Delete ${nameOf(user)}'s account? Their name, picture and GitHub link go, and they're signed out everywhere. This can't be undone.`,
      )
    ) {
      return;
    }
    const eraseActivity = window.confirm(
      "Also erase their sets, votes and feedback?\n\nOK: erase them too. Cancel: keep them, without a name. Exercises they wrote stay either way.",
    );
    deleteUser.mutate({ userId: user.id, eraseActivity });
  };

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs font-semibold text-faded">
          <span className="text-ink">{users?.length ?? 0}</span> accounts · gym staff curate every
          muscle and exercise; only head coaches manage people
        </p>
        <input
          aria-label="Find a member"
          value={filter}
          onChange={(event) => {
            setFilter(event.target.value);
            setPage(0);
          }}
          placeholder="find by name or #id"
          className={`${inputClass} mt-0! max-w-64`}
        />
      </div>

      <ErrorMessage error={updateRole.error ?? updateStatus.error ?? deleteUser.error} />

      <div className="pixel-shadow mt-4 divide-y-2 divide-ink/10 border-2 border-line bg-card">
        {isPending && (
          <div className="p-6">
            <Loading what="checking the sign-in sheet" />
          </div>
        )}
        {error && (
          <div className="p-6">
            <ErrorMessage error={error} />
          </div>
        )}
        {users && shown.length === 0 && (
          <p className="p-6 text-xs font-medium text-faded">// nobody by that name</p>
        )}

        {pageUsers.map((user) => {
          const isMe = user.id === me.id;
          const deleted = user.status === "DELETED";
          // The house account owns the gym's content and never signs in (the API guards it too).
          const isHouse = user.displayName === "Heaped & Stacked" && user.lastLoginAt === null;
          return (
            <article
              key={user.id}
              className={`flex flex-col gap-3 p-5 md:flex-row md:items-center ${
                user.status === "ACTIVE" ? "" : "bg-muted/40"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar url={user.avatarUrl} name={user.displayName} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">
                    {nameOf(user)}
                    {isMe && <span className="font-medium text-faded"> (you)</span>}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-faded">
                    <span>#{user.id}</span>
                    <span>since {new Date(user.createdAt).toLocaleDateString()}</span>
                    {user.lastLoginAt && (
                      <span>last in {new Date(user.lastLoginAt).toLocaleDateString()}</span>
                    )}
                    {user.status === "BLOCKED" && <Badge color="ink">BLOCKED</Badge>}
                    {deleted && <Badge color="muted">DELETED ACCOUNT</Badge>}
                    {isHouse && <Badge color="muted">HOUSE ACCOUNT · OWNS THE CONTENT</Badge>}
                  </p>
                </div>
              </div>

              {/* Your own row is read-only (no locking yourself out by accident: your own account is
                  deleted in the Locker Room), and so is the house account's. */}
              {deleted || isMe || isHouse ? (
                <Badge color={user.role === "MEMBER" ? "pixel" : "ink"}>
                  {roleLabels[user.role]}
                </Badge>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {user.role === "ADMIN" ? (
                    <span title="Admins are set in the API's configuration, not here">
                      <Badge color="ink">{roleLabels.ADMIN}</Badge>
                    </span>
                  ) : (
                    <select
                      aria-label={`Role of ${nameOf(user)}`}
                      value={user.role}
                      disabled={busy}
                      onChange={(event) => changeRole(user, event.target.value as UserRole)}
                      className={`${inputClass} mt-0! w-auto! py-2!`}
                    >
                      {roles.map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role].toLowerCase()}
                        </option>
                      ))}
                    </select>
                  )}
                  {user.status === "BLOCKED" ? (
                    <Button
                      variant="paper"
                      className="px-3 py-2 text-[9px]"
                      disabled={busy}
                      onClick={() => updateStatus.mutate({ userId: user.id, status: "ACTIVE" })}
                      title="Let them sign in again"
                    >
                      UNBLOCK
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      className="px-3 py-2 text-[9px]"
                      disabled={busy}
                      onClick={() => block(user)}
                      title="Sign them out and keep them out"
                    >
                      BLOCK
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    className="px-3 py-2 text-[9px]"
                    disabled={busy}
                    onClick={() => remove(user)}
                    title="On their request: their name, picture and GitHub link go"
                  >
                    DELETE
                  </Button>
                </div>
              )}
            </article>
          );
        })}
      </div>
      <Pager label="Pages of members" page={current} totalPages={totalPages} onPage={setPage} />
    </section>
  );
}
