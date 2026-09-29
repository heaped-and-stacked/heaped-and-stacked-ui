import { useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useDeleteAccount, useSignOut, useUpdateProfile } from "@/api/queries";
import type { User } from "@/api/types";
import { RequireSignIn } from "@/components/RequireSignIn";
import {
  Avatar,
  Badge,
  Button,
  Card,
  ErrorMessage,
  Field,
  inputClass,
  PageHeading,
} from "@/components/ui";
import { roleLabels } from "@/labels";

/** The signed-in user's own account, behind their avatar in the top bar: display name, signing out, deleting the account. */
export function LockerRoomPage() {
  return (
    <RequireSignIn area="locker room">
      {(user) => (
        <>
          <PageHeading prompt="whoami" title="LOCKER ROOM">
            Your name on the leaderboard, and the door out.
          </PageHeading>
          {/* A short profile form: kept narrow, even on wide screens. */}
          <div className="mt-12 grid max-w-3xl gap-6">
            <ProfileCard user={user} />
            <ExitCard />
          </div>
        </>
      )}
    </RequireSignIn>
  );
}

function ProfileCard({ user }: { user: User }) {
  const updateProfile = useUpdateProfile();
  const [displayName, setDisplayName] = useState(user.displayName ?? "");

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    updateProfile.mutate({ displayName: displayName.trim() });
  };

  return (
    <Card>
      <div className="flex items-center gap-4">
        <Avatar url={user.avatarUrl} name={user.displayName} className="size-16" />
        <div>
          <p className="text-sm font-bold">{user.displayName ?? "athlete"}</p>
          <div className="mt-2 flex items-center gap-2">
            <Badge color={user.role === "MEMBER" ? "pixel" : "ink"}>{roleLabels[user.role]}</Badge>
            <span className="text-[11px] text-faded">
              since {new Date(user.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-3">
        <Field label="DISPLAY NAME" hint="what other athletes see">
          <input
            required
            maxLength={200}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            className={inputClass}
          />
        </Field>
        <ErrorMessage error={updateProfile.error} />
        {updateProfile.isSuccess && (
          <p role="status" className="mt-4 text-xs font-semibold text-pixel">
            ✓ name tag updated
          </p>
        )}
        <Button type="submit" className="mt-6" disabled={updateProfile.isPending}>
          SAVE
        </Button>
      </form>
    </Card>
  );
}

function ExitCard() {
  const navigate = useNavigate();
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Signing out re-renders this page as "members only" before a mutate() callback could run,
  // so wait for the promise instead. Failures are shown by ErrorMessage below.
  const leave = (action: () => Promise<unknown>) =>
    action().then(
      () => navigate({ to: "/" }),
      () => undefined,
    );

  return (
    <Card>
      <h2 className="font-display text-xs">EXIT</h2>

      <Button
        variant="paper"
        className="mt-6 w-full"
        disabled={signOut.isPending}
        onClick={() => leave(signOut.mutateAsync)}
      >
        SIGN OUT
      </Button>
      <ErrorMessage error={signOut.error} />

      <div className="mt-8 border-t-2 border-dashed border-ink/20 pt-6">
        <p className="text-xs font-medium leading-relaxed text-faded">
          Deleting your account removes your name and GitHub link for good. Exercises you wrote stay
          in the gym.
        </p>
        {confirmingDelete ? (
          <div className="mt-4 grid gap-2">
            <Button
              variant="danger"
              disabled={deleteAccount.isPending}
              onClick={() => leave(deleteAccount.mutateAsync)}
            >
              YES, DELETE IT
            </Button>
            <Button variant="paper" onClick={() => setConfirmingDelete(false)}>
              KEEP MY ACCOUNT
            </Button>
          </div>
        ) : (
          <Button
            variant="danger"
            className="mt-4 w-full"
            onClick={() => setConfirmingDelete(true)}
          >
            DELETE ACCOUNT
          </Button>
        )}
        <ErrorMessage error={deleteAccount.error} />
      </div>
    </Card>
  );
}
