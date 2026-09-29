import { HeadContent, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { SIGN_IN_URL, signInHere } from "@/api/client";
import { useCurrentUser } from "@/api/queries";
import { roleLabels } from "@/labels";
import { site } from "@/site";
import { Avatar, buttonClass, Logo } from "./ui";
import { WorkoutBar } from "./WorkoutBar";

/**
 * The frame around every page: the background (the same calm `bg-room` everywhere, so moving
 * between pages doesn't change the room), top bar, the workout bar (visitors too: they may try a
 * workout), page content, footer (disclaimer, site links). Content uses the full width up to
 * max-w-[96rem].
 */
export function Layout() {
  return (
    <div className="bg-room relative flex min-h-screen flex-col overflow-x-clip">
      {/* The page's tab title, from its route's head (router.tsx); React moves it into <head>. */}
      <HeadContent />
      <TopBar />
      <WorkoutBar />
      {/* flex-1 pushes the footer to the bottom of the window on short pages */}
      <main className="relative mx-auto flex w-full max-w-[96rem] flex-1 flex-col px-6 pb-10 pt-8 short:pb-6 short:pt-6">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

/** The usual site links (pages/SitePages.tsx), and Buy me a coffee once site.ts has its address. */
const footerLinks = [
  { label: "About", to: "/about" },
  { label: "Privacy", to: "/privacy" },
  { label: "Terms", to: "/terms" },
  { label: "Code of Conduct", to: "/code-of-conduct" },
  { label: "Contact", to: "/contact" },
] as const;

/** A slim strip: the disclaimer and the motto, then copyright and the site links. */
function Footer() {
  return (
    <footer className="relative border-t-2 border-ink/15 bg-paper/80">
      <div className="mx-auto grid w-full max-w-[96rem] gap-3 px-6 py-4 text-[11px] font-medium text-faded md:grid-cols-[1fr_auto] md:items-center md:gap-x-10">
        <p className="leading-relaxed">
          <span className="font-semibold text-ink/70">Spotter's note:</span> some exercises are
          written with the help of AI or submitted by users, and not all of them have been reviewed.
          Do your own research and don't take anything for granted: the gym brings you the right
          exercises, but working on your form is up to you.
        </p>
        <p className="md:text-right">{"/* while (!stacked) { train(); } */"}</p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t-2 border-dashed border-ink/10 pt-3 md:col-span-2">
          <span>© {new Date().getFullYear()} Heaped &amp; Stacked</span>
          <nav aria-label="Site" className="flex flex-wrap gap-x-5 gap-y-2">
            {footerLinks.map((link) => (
              <Link key={link.to} to={link.to} className="hover:text-ink hover:underline">
                {link.label}
              </Link>
            ))}
            {site.coffeeUrl && (
              <a
                href={site.coffeeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-ink hover:underline"
              >
                ☕ Buy me a coffee
              </a>
            )}
          </nav>
        </div>
      </div>
    </footer>
  );
}

/** Nav links look like small pixel buttons; the current page's one is inked in. */
const navButtonClass =
  "pixel-shadow-sm border-2 border-line bg-card px-3 py-2.5 font-display text-[9px] leading-none transition hover:-translate-y-0.5 data-[status=active]:bg-ink data-[status=active]:text-paper";

function TopBar() {
  const { data: user, isPending } = useCurrentUser();

  return (
    <header className="relative mx-auto w-full max-w-[96rem] px-6 py-5">
      <nav className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <Link to="/" className="flex items-center gap-3" aria-label="Heaped & Stacked, home">
          <Logo className="size-10" />
          <span className="hidden md:block">
            <span className="block font-display text-xs leading-none">HEAPED &amp; STACKED</span>
            <span className="mt-1 block text-xs font-medium text-faded">// brain_gym</span>
          </span>
        </Link>

        {/* On phones the buttons wrap onto a second row rather than run off the screen. */}
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          <ThemeSwitch />
          {user ? (
            <Link
              to="/locker-room"
              className="flex items-center gap-2 border-2 border-transparent px-1 py-1 text-xs font-semibold transition hover:border-line data-[status=active]:border-line"
              title="Locker room"
            >
              <Avatar url={user.avatarUrl} name={user.displayName} />
              {/* The role above the name, like a title on a membership card. */}
              <span className="hidden max-w-32 lg:block">
                <span className="block font-display text-[9px] leading-none text-faded">
                  {roleLabels[user.role]}
                </span>
                <span className="mt-1 block truncate">{user.displayName ?? "athlete"}</span>
              </span>
            </Link>
          ) : (
            !isPending && (
              <a
                href={SIGN_IN_URL}
                onClick={(event) => {
                  event.preventDefault();
                  signInHere(); // back to this page afterwards, not the home page
                }}
                className={`${navButtonClass} bg-ink! text-paper`}
              >
                <span className="sm:hidden">SIGN IN</span>
                <span className="hidden sm:inline">SIGN IN WITH GITHUB</span>
              </a>
            )
          )}

          <Link
            to="/train"
            className={navButtonClass}
            title="Back to the exercise you're working on"
          >
            <span className="sm:hidden">RACK</span>
            <span className="hidden sm:inline">TRAINING RACK</span>
          </Link>

          <Link to="/workouts" className={navButtonClass}>
            <span className="sm:hidden">WORKOUTS</span>
            <span className="hidden sm:inline">PAST WORKOUTS</span>
          </Link>

          {/* Only for whoever may add exercises: staff, and members when the gym opens it to them. */}
          {user?.canContribute && (
            <Link to="/coach" className={navButtonClass}>
              <span className="sm:hidden">COACH</span>
              <span className="hidden sm:inline">COACH'S CORNER</span>
            </Link>
          )}

          {/* Only for head coaches: managing people. */}
          {user?.role === "ADMIN" && (
            <Link to="/front-desk" className={navButtonClass}>
              <span className="sm:hidden">DESK</span>
              <span className="hidden sm:inline">FRONT DESK</span>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}

/**
 * Switches between the dark theme (the default) and the light one: the `dark` class on <html>,
 * which index.html sets before the first paint. The choice is a convenience in localStorage.
 */
function ThemeSwitch() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggle = () => {
    const next = !dark;
    const root = document.documentElement;
    // No transitions for the switch itself (see .theme-switching in styles.css).
    root.classList.add("theme-switching");
    root.classList.toggle("dark", next);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => root.classList.remove("theme-switching")),
    );
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // Storage can be blocked; the switch still works for this visit.
    }
    setDark(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to the light theme" : "Switch to the dark theme"}
      title={dark ? "Lights on" : "Lights off"}
      className="pixel-shadow-sm grid h-[34px] w-10 place-items-center border-2 border-line bg-card text-lg leading-none text-amber-ink transition hover:-translate-y-0.5"
    >
      <span aria-hidden>{dark ? "☀" : "☾"}</span>
    </button>
  );
}

export function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="font-display text-5xl">404</p>
      <p className="mt-6 text-sm font-medium text-ink/70">
        This machine is out of order. <br />
        <span className="text-faded">// the page you're looking for skipped leg day</span>
      </p>
      <Link to="/" className={`${buttonClass("paper")} mt-8`}>
        BACK TO THE GYM
      </Link>
    </div>
  );
}

/**
 * When a page itself crashes (a bug in the app, not an API error: those show in ErrorMessage).
 * Says so plainly, without technical details, and offers a reload or a way home. The details go
 * to the browser console for whoever debugs it.
 */
export function AppError({ error }: { error: unknown }) {
  console.error(error);
  return (
    <div className="py-16 text-center">
      <p className="font-display text-3xl">OUCH</p>
      <p className="mt-6 text-sm font-medium text-ink/70">
        Something broke on this page. <br />
        <span className="text-faded">// pulled a muscle. a reload usually helps.</span>
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className={buttonClass("ink")}
        >
          RELOAD
        </button>
        <a href="/" className={buttonClass("paper")}>
          BACK TO THE GYM
        </a>
      </div>
    </div>
  );
}
