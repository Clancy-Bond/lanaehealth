// Endolog-style categorized pain locations

export interface PainLocationCategory {
  name: string
  locations: string[]
}

export const PAIN_LOCATION_CATEGORIES: PainLocationCategory[] = [
  {
    name: 'Pelvic & Abdominal',
    locations: ['Abdomen', 'Groin', 'Lower Abdomen', 'Lower Belly', 'Ovaries', 'Pelvis', 'Uterus', 'Vagina'],
  },
  {
    name: 'Back & Spine',
    locations: ['Lower Back', 'Spine', 'Tailbone', 'Upper Back'],
  },
  {
    name: 'Digestive',
    locations: ['Bowels', 'Intestines', 'Rectum'],
  },
  {
    name: 'Urinary',
    locations: ['Bladder'],
  },
  {
    name: 'Legs & Hips',
    locations: ['Calf', 'Hips', 'Knees', 'Legs', 'Thigh', 'Upper Thigh'],
  },
  {
    name: 'Chest & Upper Body',
    locations: ['Breasts', 'Chest', 'Diaphragm', 'Neck', 'Shoulders'],
  },
  {
    name: 'Arms',
    locations: ['Arms', 'Forearm'],
  },
  {
    name: 'Head',
    locations: ['Head', 'Headache'],
  },
  {
    name: 'Joints & Other',
    locations: ['Joints', 'Whole Body'],
  },
]

export const ALL_PAIN_LOCATIONS: string[] = PAIN_LOCATION_CATEGORIES.flatMap((c) => c.locations)
