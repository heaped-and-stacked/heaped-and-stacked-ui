import type { ReactNode } from "react";
import { SIGN_IN_URL, signInHere } from "@/api/client";
import { useCurrentUser } from "@/api/queries";
import type { CurrentUser } from "@/api/types";
import { buttonClass, Card, ErrorMessage, Loading } from "./ui";

/**
 * Renders its children only for a signed-in user, and a "members only" card otherwise.
 * The API enforces this too; this only keeps visitors from seeing empty pages.
 */
export function RequireSignIn({
  area,
  children,
}: {
  area: string;
  children: (user: CurrentUser) => ReactNode;
}) {
  const { data: user, isPending, error } = useCurrentUser();

  if (isPending) return <Loading what="checking your membership card" />;
  if (error) return <ErrorMessage error={error} />;
  if (user) return <>{children(user)}</>;

  return (
    <Card className="mx-auto max-w-md text-center">
      <p className="font-display text-xs">MEMBERS ONLY</p>
      <p className="mt-4 text-sm font-medium leading-relaxed text-ink/70">
        Sign in with GitHub to enter the {area}. <br />
        <span className="text-faded">// new here? signing in is signing up</span>
      </p>
      <a
        href={SIGN_IN_URL}
        onClick={(event) => {
          event.preventDefault();
          signInHere(); // back to this page afterwards, not the home page
        }}
        className={`${buttonClass("ink")} mt-6`}
      >
        SIGN IN WITH GITHUB
      </a>
    </Card>
  );
}
