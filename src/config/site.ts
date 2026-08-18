import type { Domain } from "@/config/taxonomy";

/** The built-in views. Adding a view is a code change (a new component), not config. */
export type ViewId =
  | "landscape"
  | "flows"
  | "sequences"
  | "stores"
  | "migrations"
  | "history";

export interface SiteConfig {
  /** Short brand name, e.g. used in prose. */
  name: string;
  /** Header title shown top-left in the app. */
  headerTitle: string;
  /** Header subtitle under the title. */
  headerSubtitle: string;
  /** Browser tab title (`<title>`). */
  metaTitle: string;
  /** Meta description. */
  metaDescription: string;
  /** Which tab opens first. */
  defaultView: ViewId;
  /** Which domain chip is selected first in the Data Flows view. */
  defaultDomain: Domain;
}

/**
 * Per-client branding + defaults. This is one of the handful of files to edit when
 * standing up a new client — see `docs/new-client.md`.
 */
export const site: SiteConfig = {
  name: "Acme Outfitters",
  headerTitle: "Acme Outfitters Architecture",
  headerSubtitle: "Systems, data flows, and migrations",
  metaTitle: "Acme Outfitters Architecture Explorer",
  metaDescription:
    "Interactive map of Acme Outfitters' systems, data flows, data stores, and migrations",
  defaultView: "landscape",
  defaultDomain: "orders",
};
