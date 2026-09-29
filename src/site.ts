/**
 * The facts the footer pages (pages/SitePages.tsx) state about who runs the gym and where. Fill
 * in every "[...]" before release: they show on the pages as they are.
 */
export const site = {
  /** Who runs the gym: a person's name is enough. */
  owner: "Haprean Manuel",
  /** Questions, bugs, privacy requests. */
  contactEmail: "hapreanmanuel@gmail.com",
  /**
   * Where the off-site copy of the nightly backups goes (the privacy policy names it), e.g.
   * "Hetzner (Storage Box, Germany)" or "Cloudflare (R2)". Servers and database are fixed in the
   * policy: Hetzner and Neon.
   */
  backupProvider: "[BACKUP PROVIDER]",
  /** Who holds the mail sent to contactEmail. */
  emailProvider: "Google (Gmail)",
  /** Whose law governs the terms. */
  country: "Romania",
  /** When the privacy policy and terms last changed. */
  lastUpdated: "23 October 2026",
  /** The Buy Me a Coffee or Ko-fi page; the footer link stays hidden while this is empty. */
  coffeeUrl: "",
};
