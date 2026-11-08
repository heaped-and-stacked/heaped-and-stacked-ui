/**
 * The facts the footer pages (pages/SitePages.tsx) state about who runs the gym and where. Fill
 * in every "[...]" before release: they show on the pages as they are.
 */
export const site = {
  /** Who runs the gym: a person's name is enough. */
  owner: "Haprean Manuel",
  /** Questions, bugs, privacy requests. */
  contactEmail: "hello@heapedstacked.dev",
  /**
   * Where the off-site copy of the nightly backups goes (the privacy policy names it), e.g.
   * "Cloudflare (R2)". Servers and database are fixed in the policy: Contabo and Neon. Empty: no
   * off-site copy yet, and the policy doesn't mention one.
   */
  backupProvider: "Cloudflare (R2, in the European Union)",
  /** Who keeps the mail sent to contactEmail (Cloudflare Email Routing forwards it there). */
  emailProvider: "Google (Gmail)",
  /** Whose law governs the terms. */
  country: "Romania",
  /** When the privacy policy and terms last changed. */
  lastUpdated: "8 November 2026",
  /** The code: the GitHub organization, which shows both public repositories. */
  sourceUrl: "https://github.com/heaped-and-stacked",
  /** Where bugs are reported. */
  issuesUrl: "https://github.com/heaped-and-stacked/heaped-and-stacked-ui/issues",
  /** The Buy Me a Coffee page; the footer link stays hidden while this is empty. */
  coffeeUrl: "https://buymeacoffee.com/heapedstacked",
};
