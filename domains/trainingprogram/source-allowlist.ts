/**
 * Credible-source allowlist for the on-demand content pipeline (see
 * docs/training-content-pipeline.md) -- the automated "spot check" the
 * user asked for: every citation on a new training_programs row must
 * resolve to an entry here, checked deterministically by
 * scripts/training-content/verify-sources.ts, not judged by a model.
 *
 * Two kinds of credible source:
 *  - institutions (certifying bodies, national governing bodies,
 *    peer-reviewed journals) -- broad, generic, evidence-based guidance.
 *  - individual specialists -- named, recognized coaches/practitioners
 *    with a real, verifiable public track record, so programs can be
 *    genuinely expert-informed rather than institutionally vanilla.
 *
 * Adding a new legitimate entry is a one-line, reviewable diff -- but
 * only after confirming a real, resolving official domain via research
 * (never guess a domain; see docs/training-content-pipeline.md's
 * "domain verification" step). Pure, no DB/server imports, so both the
 * app and scripts can import this directly.
 */

export type SourceCategory =
  | "certifying_body"
  | "governing_body"
  | "peer_reviewed_journal"
  | "individual_specialist"
  /** Useful for identifying who the right specialist is per archetype,
   * not itself a program-methodology citation -- see Huberman Lab below. */
  | "discovery_source";

export type AllowlistedSource = {
  domain: string;
  /** Scopes a shared platform domain (e.g. youtube.com) to one creator's
   * channel/path, so allowlisting a specific person doesn't accidentally
   * allowlist the whole platform. Not needed for the personal/branded
   * apex domains seeded below, but available for that case later. */
  pathPrefix?: string;
  organization: string;
  category: SourceCategory;
  /** For individual_specialist entries, what they're recognized for --
   * guides the "specialist discovery" step in picking the right person
   * per archetype rather than citing whoever's convenient. */
  specialty?: string;
};

export const CREDIBLE_SOURCE_ALLOWLIST: AllowlistedSource[] = [
  // Institutions
  { domain: "nsca.com", organization: "National Strength and Conditioning Association", category: "certifying_body" },
  { domain: "acsm.org", organization: "American College of Sports Medicine", category: "certifying_body" },
  { domain: "nasm.org", organization: "National Academy of Sports Medicine", category: "certifying_body" },
  { domain: "usaweightlifting.org", organization: "USA Weightlifting", category: "governing_body" },
  { domain: "usacycling.org", organization: "USA Cycling", category: "governing_body" },
  { domain: "usatriathlon.org", organization: "USA Triathlon", category: "governing_body" },
  { domain: "usatf.org", organization: "USA Track & Field", category: "governing_body" },
  { domain: "pubmed.ncbi.nlm.nih.gov", organization: "PubMed / NIH", category: "peer_reviewed_journal" },
  { domain: "ncbi.nlm.nih.gov", organization: "NIH / NCBI", category: "peer_reviewed_journal" },
  {
    domain: "journals.lww.com",
    organization: "Wolters Kluwer (e.g. Journal of Strength & Conditioning Research)",
    category: "peer_reviewed_journal",
  },

  // Individual specialists -- domains verified via live web search when
  // this allowlist was built (2026-08), not guessed.
  {
    domain: "athleanx.com",
    organization: "Jeff Cavaliere / ATHLEAN-X",
    category: "individual_specialist",
    specialty: "hypertrophy, injury-aware bodybuilding",
  },
  {
    domain: "andygalpin.com",
    organization: "Dr. Andy Galpin",
    category: "individual_specialist",
    specialty: "broad evidence-based human performance, exercise physiology",
  },
  {
    domain: "performpodcast.com",
    organization: "Dr. Andy Galpin (Perform podcast)",
    category: "individual_specialist",
    specialty: "broad evidence-based human performance, exercise physiology",
  },
  {
    domain: "gunnarpeterson.com",
    organization: "Gunnar Peterson",
    category: "individual_specialist",
    specialty: "general fitness, celebrity/athlete conditioning",
  },
  {
    domain: "completehumanperformance.com",
    organization: "Alex Viada / Complete Human Performance",
    category: "individual_specialist",
    specialty: "hybrid/concurrent strength and endurance athlete training -- widely credited with popularizing the term \"hybrid athlete\"",
  },

  // Discovery source -- Huberman is a neuroscientist who interviews
  // strength/conditioning/endurance specialists, not a coach himself.
  // Useful for identifying who to research next per archetype; not a
  // stand-in citation for a program's actual methodology.
  {
    domain: "hubermanlab.com",
    organization: "Andrew Huberman / Huberman Lab",
    category: "discovery_source",
  },
];

/** Returns the matching allowlist entry for a URL, or null if none
 * matches -- an exact domain or any subdomain of it, and (if the entry
 * specifies one) the URL path must start with `pathPrefix`. */
export function matchAllowlist(url: string): AllowlistedSource | null {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }

  return (
    CREDIBLE_SOURCE_ALLOWLIST.find((source) => {
      const domainMatches = hostname === source.domain || hostname.endsWith(`.${source.domain}`);
      if (!domainMatches) return false;
      if (!source.pathPrefix) return true;
      return new URL(url).pathname.startsWith(source.pathPrefix);
    }) ?? null
  );
}
