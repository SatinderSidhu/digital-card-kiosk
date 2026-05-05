export type CardDetails = {
  fullName: string;
  title: string;
  company: string;
  phone: string;
  email: string;
  website: string;
};

export const emptyCard: CardDetails = {
  fullName: "",
  title: "",
  company: "",
  phone: "",
  email: "",
  website: "",
};

export type TemplateId =
  | "aurora"
  | "mono"
  | "sunset"
  | "neon"
  | "forest"
  | "noir";

export type Orientation = "landscape" | "portrait";

export const TEMPLATE_ORIENTATION: Record<TemplateId, Orientation> = {
  aurora: "landscape",
  mono: "landscape",
  sunset: "landscape",
  neon: "portrait",
  forest: "portrait",
  noir: "portrait",
};

/** Templates exposed on the kiosk picker. */
export const PAGE_TEMPLATES: TemplateId[] = [
  "aurora",
  "mono",
  "sunset",
  "neon",
  "forest",
  "noir",
];

/** The "factory" default template — used as the live preview at step 1
 *  before the user has explicitly picked anything, and as the target of
 *  the "Reset to default" action in the template picker. */
export const FACTORY_DEFAULT_TEMPLATE: TemplateId = "aurora";

export type SectionId = "capture" | "personalize" | "build" | "share";

export const SECTIONS: { id: SectionId; title: string; subtitle: string }[] = [
  { id: "capture", title: "Start here", subtitle: "Tap to take your photo" },
  { id: "personalize", title: "Make it yours", subtitle: "Preview — add your details to update" },
  { id: "build", title: "Pick your style", subtitle: "Tap a card to build it" },
  { id: "share", title: "Take it with you", subtitle: "Scan or email to your phone" },
];
