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
  <a href={`mailto:${site.contactEmail}`} className="font-semibold text-pixel hover:underline">
    {site.contactEmail}
  </a>
);

const LastUpdated = () => <p className="text-xs text-faded">Last updated: {site.lastUpdated}</p>;

export function AboutPage() {
  return (
    <TextPage prompt="cat README.md" title="ABOUT" intro="A gym for your brain.">
      <p>
        Heaped &amp; Stacked is where programmers train like athletes. Pick a muscle (a topic such
        as Java concurrency or Spring Security), take an exercise, and write your answer before you
        look at anything else. Then compare it with the model answer, and with your own earlier
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
        is the rep; the model answer is the spotter.
      </p>
      <h2>SPOTTER'S NOTE</h2>
      <p>
        Some exercises are written with the help of AI or submitted by other members, and not all of
        them have been reviewed. The gym brings you the exercises; checking them, and working on
        your form, is up to you. Something wrong? After the model answer, mark the exercise "▼ not
        great" and say what.
      </p>
      <h2>COACHES WELCOME</h2>
      <p>
        Signed-in members can add exercises and muscles in Coach's Corner. New exercises on the
        gym's muscles are checked before they go live.
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
        <li>what you contribute: exercises, muscles, and your decisions on others' exercises</li>
        <li>
          when you joined and when you last signed in, and your role (athlete, gym staff, head
          coach).
        </li>
      </ul>
      <p>
        <strong>To keep the service running</strong>, our server writes logs: the time, what was
        requested, a request number, and for sign-ins and administrative actions, your user number.
        Our hosting provider may also log IP addresses, for security.
      </p>
      <p>
        <strong>In your browser</strong>, the app keeps your theme choice and your picked muscles
        (local storage), and the workout you're in, draft answer included (session storage, gone
        when you close the tab). These stay on your device; we don't read them.
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
          <strong>{site.hostingProvider}</strong> runs our servers and database, in{" "}
          {site.hostingRegion}.
        </li>
      </ul>
      <p>Nothing else: the fonts and everything else on the page come from our own site.</p>

      <h2>WHY (LEGAL BASES, FOR THE GDPR)</h2>
      <ul>
        <li>
          To give you the service you signed up for: your account, workouts and history (contract).
        </li>
        <li>
          To keep the service safe and working: logs, backups, abuse prevention (legitimate
          interest).
        </li>
      </ul>

      <h2>HOW LONG WE KEEP IT</h2>
      <ul>
        <li>
          <strong>Your account and training data:</strong> until you delete your account.
        </li>
        <li>
          <strong>Logs:</strong> {site.logRetentionDays} days. <strong>Backups:</strong>{" "}
          {site.backupRetentionDays} days.
        </li>
        <li>
          <strong>The session cookie:</strong> 14 days, or until you sign out.
        </li>
      </ul>

      <h2>DELETING YOUR ACCOUNT</h2>
      <p>
        In the Locker Room, <strong>Delete account</strong> removes your name, your picture and the
        link to your GitHub account straight away, and signs you out everywhere. Your answers and
        contributions stay, attached to an account without a name, so exercises other people train
        with don't vanish. If you want those erased too, email us and we'll do it.
      </p>

      <h2>YOUR RIGHTS</h2>
      <p>
        You can ask for a copy of your data, to correct it, to erase it, or object to how we use it:
        write to <Mail />. If you're in the EU, you can also complain to your data protection
        authority.
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
          <strong>Free, as is.</strong> The gym is free to use and provided as is. Model answers can
          be wrong or out of date: don't rely on them for anything important without checking.
        </li>
        <li>
          <strong>Your account.</strong> You sign in with GitHub and are responsible for what
          happens under your account. You must be old enough to use GitHub.
        </li>
        <li>
          <strong>What you contribute.</strong> Exercises, model answers and muscles you submit must
          be your own work, or properly credited and allowed to be shared. You keep your rights to
          them, and you give Heaped &amp; Stacked a free, permanent licence to show them to other
          members and visitors, and to edit them for clarity or correctness.
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
          that break these terms or the Code of Conduct.
        </li>
        <li>
          <strong>Changes and ending.</strong> We may change these terms (with notice on the site
          for important changes) or close the gym. You can stop using it and delete your account at
          any time.
        </li>
        <li>
          <strong>Liability.</strong> To the extent the law allows, we're not liable for losses from
          using the gym or from wrong answers in it.
        </li>
        <li>
          <strong>Law.</strong> These terms are governed by the law of {site.country}.
        </li>
      </ol>
      <p>
        Contact: <Mail />.
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
          <strong>Make it worth a rep.</strong> Clear question, correct model answer, honest load
          (difficulty).
        </li>
        <li>
          <strong>Spot kindly.</strong> When you review or report, be specific about what's wrong,
          not about who wrote it. Reports are anonymous; keep them fair.
        </li>
        <li>
          <strong>Respect everyone.</strong> No harassment, insults, discrimination or personal
          attacks, in exercises, notes or names.
        </li>
        <li>
          <strong>No gaming the gym.</strong> No vote rings, no spam, no sockpuppet accounts.
        </li>
      </ul>
      <p>Breaking these rules can get content retired and accounts blocked.</p>
      <p>
        <strong>Seen a problem?</strong> Mark the exercise "▼ not great", or write to <Mail />.
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
        Something wrong with an exercise? The quickest way is "▼ not great", under the model answer.
      </p>
      <p>
        When something breaks, the error message shows a short reference ("ref …"). Including it in
        your message helps find what went wrong.
      </p>
    </TextPage>
  );
}
