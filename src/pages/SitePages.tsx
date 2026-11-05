import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Card, PageHeading } from "@/components/ui";
import { site } from "@/site";

/**
 * The pages behind the footer links: About, Privacy, Terms, Code of Conduct and Contact. Plain
 * text in the gym's style. The facts only the owner knows (name, contact, hosting, ...) come from
 * site.ts. Change these texts together with what the app does: the privacy policy must stay true.
 */

/** A readable column of text under a page heading. */
function TextPage({
  prompt,
  title,
  intro,
  children,
}: {
  prompt: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeading prompt={prompt} title={title}>
        {intro}
      </PageHeading>
      <Card className="mt-10 max-w-3xl">
        <div className="grid gap-4 text-sm leading-relaxed text-ink/90 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-xs [&_h2]:leading-relaxed [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_strong]:text-ink [&_ul]:grid [&_ul]:gap-1.5 [&_ol]:grid [&_ol]:gap-1.5">
          {children}
        </div>
      </Card>
    </>
  );
}

const Mail = () => (
  <a href={`mailto:${site.contactEmail}`} className="font-semibold text-blue hover:underline">
    {site.contactEmail}
  </a>
);

/** The way to reach the gym from the other pages: the address itself is on Contact (and Privacy). */
const ContactLink = ({ children = "the contact page" }: { children?: ReactNode }) => (
  <Link to="/contact" className="font-semibold text-blue hover:underline">
    {children}
  </Link>
);

const LastUpdated = () => <p className="text-xs text-faded">Last updated: {site.lastUpdated}</p>;

export function AboutPage() {
  return (
    <TextPage prompt="cat README.md" title="ABOUT" intro="A gym for your brain.">
      <p>
        Heaped &amp; Stacked is where programmers train like athletes. Pick a muscle (a topic such
        as Java concurrency or Spring Security), take an exercise, and write your answer before you
        look at anything else. Then compare it with the sample set, and with your own earlier
        attempts.
      </p>
      <p>
        No multiple choice, no streaks to protect, no leaderboard: open questions, your own words,
        and the honest comparison afterwards. That's where the learning happens.
      </p>
      <h2>WHY IT EXISTS</h2>
      <p>
        {site.owner} built it while preparing for senior Java and Spring interviews, after noticing
        that reading answers feels like knowing them, until someone asks. Writing the answer first
        is the rep; the coach's sample set comes after.
      </p>
      <h2>COACH'S NOTE</h2>
      <p>
        Some exercises are written with the help of AI or added by members, and not all of them are
        verified yet: the ones marked ✓ VERIFIED are the ones a reviewer has checked. Don't take
        anything for granted: the gym brings you the exercises, but working on your form is up to
        you. Something wrong? Mark the exercise "▼ not great" and say what.
      </p>
      <h2>WHO WRITES THE EXERCISES</h2>
      <p>
        The gym's staff write and check the exercises. Members can add their own in Coach's Corner:
        on the gym's muscles, staff say yes before one goes live. Members can also open muscles of
        their own, in the community, and look after them themselves; staff step in when something
        breaks the house rules. Exercises marked ✓ verified have been checked. Your votes and notes
        tell us which ones to fix.
      </p>
    </TextPage>
  );
}

export function PrivacyPage() {
  return (
    <TextPage prompt="grep -r personal_data ." title="PRIVACY POLICY">
      <LastUpdated />
      <p>
        Heaped &amp; Stacked is run by {site.owner} ("we"). This page says what we collect, why, and
        what you can do about it. Questions: <Mail />.
      </p>

      <h2>WHAT WE COLLECT</h2>
      <p>
        <strong>When you sign in with GitHub</strong>, GitHub tells us:
      </p>
      <ul>
        <li>your GitHub account number and username</li>
        <li>
          your name and the address of your profile picture, as they are on your GitHub profile.
        </li>
      </ul>
      <p>
        We don't ask GitHub for your email address, and we don't get access to your repositories.
      </p>
      <p>
        <strong>When you use the gym</strong>, we store:
      </p>
      <ul>
        <li>
          your answers ("sets"), each with a copy of the exercise as it was when you answered it,
          and your optional self-assessment (how it went, how hard it felt)
        </li>
        <li>your votes on exercises, and your reports (the reason and your optional note)</li>
        <li>
          what you contribute: exercises, muscles, your decisions on others' exercises, and the
          exercises you verify
        </li>
        <li>
          when you joined and when you last signed in, and your role (athlete, gym staff, head
          coach).
        </li>
      </ul>
      <p>
        <strong>To keep the service running</strong>, our server writes logs: the time, what was
        requested, a request number, and for sign-ins and administrative actions, your user number.
        Our server also sees your IP address, as any website does, and our hosting providers may log
        it, for security.
      </p>
      <p>
        <strong>In your browser</strong>, the app keeps your theme choice, your picked muscles and
        which exercises you train (local storage), and the workout you're in, draft answer included,
        and the page to come back to after signing in (session storage, gone when you close the
        tab). These stay on your device; we don't read them.
      </p>
      <p>
        <strong>One cookie:</strong> the sign-in session cookie. It's strictly necessary, so no
        consent banner is needed. There are no analytics, no advertising and no tracking cookies,
        and we don't sell or share your data.
      </p>

      <h2>WHO SEES WHAT</h2>
      <ul>
        <li>
          <strong>Your answers and self-assessments:</strong> only you.
        </li>
        <li>
          <strong>Your display name and picture:</strong> you, and the head coach (to manage
          members).
        </li>
        <li>
          <strong>Exercises and muscles you publish:</strong> everyone, including visitors who
          aren't signed in.
        </li>
        <li>
          <strong>Your reports:</strong> the exercise's author, the muscle's owner and gym staff see
          the report, but never who sent it.
        </li>
        <li>
          <strong>Vote totals:</strong> the exercise's author sees how many votes it got, never who
          voted.
        </li>
      </ul>

      <h2>WHO PROCESSES IT FOR US</h2>
      <ul>
        <li>
          <strong>GitHub</strong> (sign-in): see GitHub's privacy statement.
        </li>
        <li>
          <strong>Contabo</strong> runs our servers, in Germany.
        </li>
        <li>
          <strong>Neon</strong> runs our database, on Amazon Web Services in Frankfurt, Germany.
        </li>
        {site.backupProvider && (
          <li>
            <strong>{site.backupProvider}</strong> keeps an encrypted copy of our nightly backups.
          </li>
        )}
        <li>
          <strong>Cloudflare</strong> (Email Routing) forwards the mail you send us, and{" "}
          <strong>{site.emailProvider}</strong> keeps it.
        </li>
        {site.coffeeUrl && (
          <li>
            <strong>Buy Me a Coffee</strong> (with Stripe for payments) handles donations, under its
            own privacy policy. It shows us what a supporter chooses to share (a name, a message,
            and usually an email address); we keep that as long as tax law requires, and use it only
            to say thanks.
          </li>
        )}
      </ul>
      <p>Nothing else: the fonts and everything else on the page come from our own site.</p>

      <h2>OUTSIDE THE EU</h2>
      <p>
        Your data is stored in Germany. GitHub, Cloudflare, Google and Neon are US companies, so US
        authorities may be able to ask them for what they handle for us. Such transfers rely on the
        EU–US Data Privacy Framework, or where a company isn't part of it, on the EU's standard
        contractual clauses.
      </p>

      <h2>WHY (LEGAL BASES, FOR THE GDPR)</h2>
      <ul>
        <li>
          To give you the service you signed up for: your account, workouts and history (contract).
        </li>
        <li>
          To keep the service safe and working: logs, backups, abuse prevention (legitimate
          interest).
        </li>
        <li>To answer the mail you send us (legitimate interest).</li>
      </ul>
      <p>
        You need a GitHub account to sign in; without one you can still try the exercises, but
        nothing is saved. We make no automated decisions about you and build no profile of you:
        which exercise comes next is picked at random, from what you've trained.
      </p>

      <h2>HOW LONG WE KEEP IT</h2>
      <ul>
        <li>
          <strong>Your account and training data:</strong> until you delete your account.
        </li>
        <li>
          <strong>Logs:</strong> a fixed amount per service (the newest 50 MB); older entries are
          overwritten as new ones come in.
        </li>
        <li>
          <strong>Backups:</strong> the database provider can restore the last 7 days; our nightly
          backups are kept 14 days on our server
          {site.backupProvider ? " and 30 days off-site" : ""}.
        </li>
        <li>
          <strong>The session cookie:</strong> 14 days, or until you sign out.
        </li>
        <li>
          <strong>Mail you send us:</strong> as long as we need it to answer you.
        </li>
      </ul>

      <h2>DELETING YOUR ACCOUNT</h2>
      <p>
        In the Locker Room, <strong>Delete account</strong> removes your name, your picture and the
        link to your GitHub account straight away, and signs you out everywhere. Your answers and
        contributions stay, attached to an account without a name, so exercises other people train
        with don't vanish, and any muscle you own passes to the gym's staff. If you want those
        erased too, email us and we'll do it.
      </p>

      <h2>YOUR RIGHTS</h2>
      <p>
        You can ask for a copy of your data (also in a machine-readable form, to take elsewhere), to
        correct it, to erase it, to restrict how we use it, or object to it: write to us (
        <ContactLink />
        ). We answer within a month. You can also complain to a data protection authority: ours is
        Romania's ANSPDCP (dataprotection.ro), or the one where you live in the EU.
      </p>

      <h2>CHANGES</h2>
      <p>
        If this policy changes, we'll update the date at the top, and say so on the site for
        important changes.
      </p>
    </TextPage>
  );
}

export function TermsPage() {
  return (
    <TextPage prompt="man terms" title="TERMS OF USE">
      <LastUpdated />
      <p>By using Heaped &amp; Stacked you agree to these terms. They're short on purpose.</p>
      <ol>
        <li>
          <strong>Free, as is.</strong> The gym is free to use and provided as is, with no promise
          that it's always available. Sample sets can be wrong or out of date: don't rely on them
          for anything important without checking.
        </li>
        <li>
          <strong>Your account.</strong> You sign in with GitHub and are responsible for what
          happens under your account. You must be at least 16.
        </li>
        <li>
          <strong>What you contribute.</strong> Exercises, sample sets and muscles you submit must
          be your own work, or properly credited and allowed to be shared. You keep your rights to
          them, and you give Heaped &amp; Stacked a free, permanent licence to show them to other
          members and visitors, and to edit them for clarity or correctness. The licence goes on if
          you delete your account (your name comes off them), so exercises others train with don't
          vanish.
        </li>
        <li>
          <strong>Don't copy books or courses.</strong> Cite sources; don't paste their text.
        </li>
        <li>
          <strong>Acceptable use.</strong> No spam, no abuse or harassment, no attempts to break,
          overload or scrape the service, and nothing illegal.
        </li>
        <li>
          <strong>Moderation.</strong> We may edit, retire or delete content, and block accounts,
          that break these terms or the Code of Conduct. Found something illegal or infringing your
          rights? Write to us (<ContactLink />
          ): we'll look at it promptly and tell you what we did. Disagree with a decision about your
          content or account? Write to us too.
        </li>
        <li>
          <strong>Changes and ending.</strong> We may change these terms (with notice on the site
          for important changes) or close the gym. You can stop using it and delete your account at
          any time.
        </li>
        {site.coffeeUrl && (
          <li>
            <strong>Support.</strong> A coffee on Buy Me a Coffee is a voluntary gift: it buys no
            features, rights or say over the gym, and isn't refundable except where the law
            requires. Payments are handled by Buy Me a Coffee and Stripe, under their own terms.
          </li>
        )}
        <li>
          <strong>Liability.</strong> To the extent the law allows, we're not liable for losses from
          using the gym or from wrong answers in it.
        </li>
        <li>
          <strong>Law.</strong> These terms are governed by the law of {site.country}. If you use
          the gym as a consumer in another EU country, its consumer protections still apply to you.
        </li>
      </ol>
      <p>
        Questions: <ContactLink />.
      </p>
    </TextPage>
  );
}

export function CodeOfConductPage() {
  return (
    <TextPage
      prompt="cat CONTRIBUTING.md"
      title="CODE OF CONDUCT"
      intro="The gym works because people add good exercises and point out bad ones. A few house rules."
    >
      <ul>
        <li>
          <strong>Bring original work, or credit it.</strong> Write exercises in your own words.
          Link sources; don't paste them.
        </li>
        <li>
          <strong>Make it worth a rep.</strong> Clear question, correct sample set, honest load
          (difficulty).
        </li>
        <li>
          <strong>Review kindly.</strong> When you review or report, be specific about what's wrong,
          not about who wrote it. The author never sees who reported; keep it fair.
        </li>
        <li>
          <strong>Respect everyone.</strong> No harassment, insults, discrimination or personal
          attacks, in exercises, notes or names.
        </li>
        <li>
          <strong>No gaming the gym.</strong> No vote rings, no spam, no sockpuppet accounts.
        </li>
      </ul>
      <p>
        The gym's staff and head coach enforce these rules: breaking them can get content retired
        and accounts blocked. Think a decision was wrong? Write to us, and we'll look again.
      </p>
      <p>
        <strong>Seen a problem?</strong> Mark the exercise "▼ not great", or write to us (
        <ContactLink />
        ).
      </p>
    </TextPage>
  );
}

export function ContactPage() {
  return (
    <TextPage prompt="ping hello" title="CONTACT">
      <p>
        Questions, bugs, ideas or a privacy request: <Mail />.
      </p>
      <p>
        Something wrong with an exercise? The quickest way is "▼ not great", on the exercise itself.
      </p>
      <p>
        When something breaks, the error message shows a short reference ("ref …"). Including it in
        your message helps find what went wrong.
      </p>
    </TextPage>
  );
}
