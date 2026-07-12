// India state/UT coordinates for the interactive map
// Simplified: state center points on India's geographic layout

export const INDIA_MAP_POINTS: Record<string, { x: number; y: number; name: string }> = {
  JK: { x: 280, y: 90, name: "Jammu & Kashmir" },
  HP: { x: 320, y: 150, name: "Himachal Pradesh" },
  PB: { x: 305, y: 170, name: "Punjab" },
  UK: { x: 360, y: 170, name: "Uttarakhand" },
  HR: { x: 325, y: 200, name: "Haryana" },
  DL: { x: 345, y: 215, name: "Delhi" },
  UP: { x: 410, y: 240, name: "Uttar Pradesh" },
  RJ: { x: 290, y: 260, name: "Rajasthan" },
  BR: { x: 480, y: 280, name: "Bihar" },
  JH: { x: 480, y: 320, name: "Jharkhand" },
  WB: { x: 550, y: 360, name: "West Bengal" },
  AS: { x: 580, y: 280, name: "Assam" },
  AR: { x: 620, y: 250, name: "Arunachal Pradesh" },
  GA: { x: 240, y: 470, name: "Goa" },
  GJ: { x: 230, y: 350, name: "Gujarat" },
  MH: { x: 310, y: 400, name: "Maharashtra" },
  MP: { x: 380, y: 340, name: "Madhya Pradesh" },
  CG: { x: 430, y: 380, name: "Chhattisgarh" },
  OD: { x: 490, y: 420, name: "Odisha" },
  TS: { x: 380, y: 460, name: "Telangana" },
  AP: { x: 410, y: 510, name: "Andhra Pradesh" },
  KA: { x: 330, y: 510, name: "Karnataka" },
  KL: { x: 320, y: 580, name: "Kerala" },
  TN: { x: 380, y: 580, name: "Tamil Nadu" },
};

export function scoreColor(score: number): string {
  if (score >= 75) return "#10B981"; // green
  if (score >= 65) return "#3B82F6"; // blue
  if (score >= 55) return "#F59E0B"; // amber
  if (score >= 45) return "#F97316"; // orange
  return "#EF4444"; // red
}
