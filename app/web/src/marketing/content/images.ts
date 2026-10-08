// Every photo on the marketing site, in one place. All are Unsplash photos served from images.unsplash.com
// (allowed by the production CSP: img-src https:). Each URL was checked to return 200 on 2026-10-08.

export interface MarketingImage {
  /** Unsplash photo id (the part after `photo-`) */
  id: string;
  /** what the photo shows, for screen readers */
  alt: string;
  /** intrinsic aspect ratio of the crop we ask for (width / height) */
  ratio?: number;
}

/** Unsplash URL at a given width: images.unsplash.com/photo-…?auto=format&fit=crop&w=…&q=80 */
export function imageUrl(img: MarketingImage, width = 1200): string {
  return `https://images.unsplash.com/photo-${img.id}?auto=format&fit=crop&w=${width}&q=80`;
}

/** `srcset` with the widths the layouts need */
export function imageSrcSet(img: MarketingImage, widths: number[] = [480, 800, 1200, 1600]): string {
  return widths.map((w) => `${imageUrl(img, w)} ${w}w`).join(', ');
}

export const images = {
  // PLACEHOLDER image — replace before launch
  teamPlanning: { id: '1552664730-d307ca884978', alt: 'A team planning work with sticky notes on a glass wall' },
  // PLACEHOLDER image — replace before launch
  colleaguesReview: { id: '1531482615713-2afd69097998', alt: 'Two colleagues reviewing work together on a laptop' },
  // PLACEHOLDER image — replace before launch
  analyticsLaptop: { id: '1460925895917-afdab827c52f', alt: 'A laptop on a desk showing an analytics dashboard' },
  // PLACEHOLDER image — replace before launch
  analyticsMonitor: { id: '1551288049-bebda4e38f71', alt: 'A monitor showing analytics charts' },
  // PLACEHOLDER image — replace before launch
  teamAtDesks: { id: '1551434678-e076c223a692', alt: 'Colleagues working at their desks in a bright office' },
  // PLACEHOLDER image — replace before launch
  teamTable: { id: '1522071820081-009f0129c71c', alt: 'A team working together at a table with laptops' },
  // PLACEHOLDER image — replace before launch
  overheadDesk: { id: '1519389950473-47ba0277781c', alt: "Overhead view of a team's shared desk with laptops and notebooks" },
  // PLACEHOLDER image — replace before launch
  meetingPresenter: { id: '1542744173-8e7e53415bb0', alt: 'A team meeting around a long table while one person presents' },
  // PLACEHOLDER image — replace before launch
  growthChartPaper: { id: '1543286386-713bdd548da4', alt: 'A hand-drawn growth chart on paper with a ruler and pen' },
  // PLACEHOLDER image — replace before launch
  notesLaptop: { id: '1454165804606-c3d57bc86b40', alt: 'Two people taking notes beside their laptops' },
  // PLACEHOLDER image — replace before launch
  serverRoom: { id: '1573164713988-8665fc963095', alt: 'Two engineers with a laptop and a tablet in a server room' },
  // PLACEHOLDER image — replace before launch
  brightOffice: { id: '1497366811353-6870744d04b2', alt: 'A bright open office with a meeting table and tall windows' },
  // PLACEHOLDER image — replace before launch
  openOffice: { id: '1504384308090-c894fdcc538d', alt: 'A large open-plan office with people at their desks' },
  // PLACEHOLDER image — replace before launch
  loftTeam: { id: '1556761175-b413da4baf72', alt: 'A team working at a shared desk in a loft office' },
  // PLACEHOLDER image — replace before launch
  loftPresenter: { id: '1556761175-5973dc0f32e7', alt: 'A presenter talking to a team in a loft office' },
  // PLACEHOLDER image — replace before launch
  meetingGesture: { id: '1517245386807-bb43f82c33c4', alt: 'A colleague explaining an idea in a meeting' },
  // PLACEHOLDER image — replace before launch
  celebration: { id: '1600880292203-757bb62b4baf', alt: 'Two colleagues celebrating a result at their desk' },
} satisfies Record<string, MarketingImage>;

export type ImageKey = keyof typeof images;
