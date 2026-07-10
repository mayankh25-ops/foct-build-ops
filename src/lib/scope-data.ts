/**
 * Scope module dataset — the owner's contract-scope read (Aurora Scope
 * Explorer import, 2026-07-10), renamed to the demo cast per CLAUDE.md.
 * Numbers are contract truth and reconcile to: 393.0 h/wk contracted,
 * 222 active + 16 optional scope items, 60.0 weekday / 46.5 weekend h/day.
 * Structure mirrors the uploaded seed exactly — do not hand-edit tasks.
 */

export interface ScopeTask { t: string; f: string }
export interface ScopeZone { name: string; tasks: ScopeTask[] }
export interface ScopeEntity {
  id: string; name: string; sub: string; included: boolean;
  days: string; publicHolidays: string; crew: string;
  weeklyHours: number; opDaysPerYear: number; zones: ScopeZone[];
}
export interface ScopeShift { s: number; e: number; h: number }
export interface ScopePosition {
  code: string; oc: string; role: string;
  wk: ScopeShift | null; we: ScopeShift | null; note: string;
}
export interface ScopeSeed {
  contract: { title: string; building: string; dated: string; note: string };
  frequencies: Array<{ key: string; perYearBasis: string }>;
  ocs: ScopeEntity[];
  positions: ScopePosition[];
  security: {
    code: string; role: string; days: string; hours: number; shift: string;
    status: string; weeklyHours: number; uniform: string;
  };
  gateService: {
    name: string; frequency: string; commencement: string;
    assets: string[]; tasks: string[];
  };
  flags: string[];
}

export const SCOPE_SEED: ScopeSeed = {
  "contract": {
    "title": "FOCT Cleaning — Service Agreement",
    "building": "Aurora on Collins (AUR)",
    "dated": "September 2020",
    "note": "All cleaner start/finish times are 'to be advised' in the agreement. Shift times shown are indicative rostering proposals only. A complete revised schedule is due within the first 3 months of each OC scope."
  },
  "frequencies": [
    {
      "key": "3x Daily",
      "perYearBasis": "3 × operating days"
    },
    {
      "key": "2x Daily",
      "perYearBasis": "2 × operating days"
    },
    {
      "key": "Daily",
      "perYearBasis": "operating days"
    },
    {
      "key": "3 days/week",
      "perYearBasis": "156"
    },
    {
      "key": "Weekly",
      "perYearBasis": "52"
    },
    {
      "key": "Monthly",
      "perYearBasis": "12"
    },
    {
      "key": "Quarterly",
      "perYearBasis": "4"
    },
    {
      "key": "Bi-Annually",
      "perYearBasis": "2"
    },
    {
      "key": "Annually",
      "perYearBasis": "1"
    },
    {
      "key": "Check Daily",
      "perYearBasis": "operating days (ad hoc)"
    },
    {
      "key": "As Required",
      "perYearBasis": "ad hoc"
    }
  ],
  "ocs": [
    {
      "id": "OC1",
      "name": "Building Common Areas",
      "sub": "Entry, lifts, hallways, amenities, loading dock, communal",
      "included": true,
      "days": "Mon–Sun",
      "publicHolidays": "Included",
      "crew": "2 cleaners × 8.0 h/day, 7 days",
      "weeklyHours": 112,
      "opDaysPerYear": 365,
      "zones": [
        {
          "name": "Main entry areas",
          "tasks": [
            {
              "t": "Spot check flooring and areas throughout the day (morning & afternoon)",
              "f": "2x Daily"
            },
            {
              "t": "Vacuum or sweep front floor surfaces to remove dirt, soil and loose matter",
              "f": "Daily"
            },
            {
              "t": "Spot clean and damp wipe all ledges, skirting, walls, window seals, furniture, plants, mirrors and handrails",
              "f": "Weekly"
            },
            {
              "t": "Remove cobwebs from ceilings and corners",
              "f": "As Required"
            },
            {
              "t": "Squeegee wash main foyer entry glass",
              "f": "Weekly"
            },
            {
              "t": "Spot clean main foyer entry glass",
              "f": "Daily"
            },
            {
              "t": "Collect litter and junk mail from post boxes, dispose into rubbish bin",
              "f": "Daily"
            },
            {
              "t": "Damp cloth wipe and clean post boxes",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Garbage rooms",
          "tasks": [
            {
              "t": "Deodorising disinfectant wash of chute room floors and surrounds on all levels; spot clean on weekends",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean all garbage room walls to keep a clean appearance",
              "f": "As Required"
            },
            {
              "t": "Inspect and tidy lower garbage room collection areas to minimise smells and odours",
              "f": "Daily"
            },
            {
              "t": "Rotate bins in compactor room so empty bins are always available for the chute",
              "f": "Daily"
            },
            {
              "t": "Sort recycling and rubbish into appropriate bins",
              "f": "Daily"
            },
            {
              "t": "Remove bins to collection point and return after collection",
              "f": "As Required"
            },
            {
              "t": "Run water sanitisation system in garbage chutes on all foyers",
              "f": "Quarterly"
            }
          ]
        },
        {
          "name": "Common hallways & lifts",
          "tasks": [
            {
              "t": "Thoroughly vacuum all floor surfaces",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean and damp wipe ledges, skirting, walls, window seals, door jambs and rails",
              "f": "Weekly"
            },
            {
              "t": "Spot clean marks on walls",
              "f": "As Required"
            },
            {
              "t": "Spot clean marks from corridor mirrors",
              "f": "Daily"
            },
            {
              "t": "Dust and wipe down all vents",
              "f": "Quarterly"
            },
            {
              "t": "Spot check lifts throughout the day for spillages",
              "f": "2x Daily"
            },
            {
              "t": "Vacuum all lift floor surfaces",
              "f": "2x Daily"
            },
            {
              "t": "Remove finger marks, streaks and stains from lift mirror panels and external wall panels",
              "f": "Daily"
            },
            {
              "t": "Vacuum and wipe clean lift door tracks on each floor",
              "f": "Monthly"
            }
          ]
        },
        {
          "name": "Fire escape stairways",
          "tasks": [
            {
              "t": "Spot clean fire stairways to remove dirt, soil and loose matter",
              "f": "Annually"
            },
            {
              "t": "Wipe fire stair handrails and remove cobwebs",
              "f": "Annually"
            }
          ]
        },
        {
          "name": "Toilets / change rooms / gyms",
          "tasks": [
            {
              "t": "Vacuum or sweep all floor surfaces",
              "f": "Daily"
            },
            {
              "t": "Damp mop floors with deodorising disinfectant",
              "f": "Daily"
            },
            {
              "t": "Empty rubbish bins, replace liners, wash bins when required",
              "f": "Daily"
            },
            {
              "t": "Dust and damp wipe sills, ledges, door tops, accessible pipes and horizontal surfaces",
              "f": "Daily"
            },
            {
              "t": "Clean toilet seats top and underside with approved deodorising disinfectant, wipe dry",
              "f": "Daily"
            },
            {
              "t": "Wash hand basins inside and underside with approved disinfectant, wipe dry",
              "f": "Daily"
            },
            {
              "t": "Remove finger marks, streaks and stains from mirror panels",
              "f": "Daily"
            },
            {
              "t": "Remove marks and stains from tiled surrounds with approved disinfectant",
              "f": "Daily"
            },
            {
              "t": "Wash shower tiles and glass with approved compound to remove soap and grease build-up",
              "f": "Weekly"
            },
            {
              "t": "Replenish hand soap, toilet paper, hand towels, urinal cubes and other requisites",
              "f": "Daily"
            },
            {
              "t": "Disinfectant wipe-down of all gymnasium equipment surfaces",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Loading dock",
          "tasks": [
            {
              "t": "Spot clean floor to remove loose items",
              "f": "Daily"
            },
            {
              "t": "Machine scrub loading dock and service ways",
              "f": "Monthly"
            }
          ]
        },
        {
          "name": "Communal / cinema / meeting rooms",
          "tasks": [
            {
              "t": "Vacuum floor surfaces",
              "f": "Daily"
            },
            {
              "t": "Dust and wipe all furniture and fittings",
              "f": "Daily"
            },
            {
              "t": "Wipe and clean sinks, cupboards, microwave, fridge and benches",
              "f": "Daily"
            },
            {
              "t": "Damp mop flooring to remove spills and dust",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Miscellaneous",
          "tasks": [
            {
              "t": "High dusting of hallways, entry areas and garbage rooms to 3 m",
              "f": "Quarterly"
            },
            {
              "t": "Clean meter rooms, pump rooms, plant rooms, store rooms and rooftops",
              "f": "Quarterly"
            },
            {
              "t": "Cleaning to building manager's office",
              "f": "As Required"
            }
          ]
        }
      ]
    },
    {
      "id": "OC3",
      "name": "Car Park",
      "sub": "All car park areas incl. individual bays",
      "included": true,
      "days": "Mon–Sun",
      "publicHolidays": "Included",
      "crew": "1 cleaner × 2.5 h/day, 7 days",
      "weeklyHours": 17.5,
      "opDaysPerYear": 365,
      "zones": [
        {
          "name": "Car park areas",
          "tasks": [
            {
              "t": "Spot check and remove all loose litter from car park areas",
              "f": "Daily"
            },
            {
              "t": "Wipe clean all handrails and other fixtures",
              "f": "Monthly"
            },
            {
              "t": "Auto-scrubber wet wash of all car park areas including individual car parks",
              "f": "Bi-Annually"
            },
            {
              "t": "Dust down all high pipes in car park areas (high ladder hire at additional cost)",
              "f": "Annually"
            }
          ]
        }
      ]
    },
    {
      "id": "OC5",
      "name": "Offices",
      "sub": "Office common areas — after-hours service",
      "included": true,
      "days": "Mon–Fri",
      "publicHolidays": "Excluded",
      "crew": "1 cleaner × 1.5 h/day, weekdays only",
      "weeklyHours": 7.5,
      "opDaysPerYear": 260,
      "zones": [
        {
          "name": "Main entry & common hallways",
          "tasks": [
            {
              "t": "Spot check flooring and areas throughout the day",
              "f": "Daily"
            },
            {
              "t": "Vacuum or sweep front floor surfaces",
              "f": "Daily"
            },
            {
              "t": "Spot clean and damp wipe ledges, skirting, walls, window seals, furniture, plants, mirrors and handrails",
              "f": "Weekly"
            },
            {
              "t": "Remove cobwebs from ceilings and corners",
              "f": "As Required"
            },
            {
              "t": "Thoroughly vacuum all floor surfaces",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean and damp wipe ledges, skirting, walls, window seals, door jambs and rails",
              "f": "Weekly"
            },
            {
              "t": "Spot clean marks on walls",
              "f": "As Required"
            },
            {
              "t": "Spot clean marks from corridor mirrors, if any",
              "f": "Daily"
            },
            {
              "t": "Dust and wipe down all vents",
              "f": "Quarterly"
            },
            {
              "t": "Spot check lifts throughout the day for spillages",
              "f": "2x Daily"
            },
            {
              "t": "Vacuum and wipe clean lift door tracks on each floor",
              "f": "Monthly"
            },
            {
              "t": "Shampoo carpets in all common areas",
              "f": "Annually"
            }
          ]
        }
      ]
    },
    {
      "id": "OC6",
      "name": "Residential L10–32",
      "sub": "Lower residential tower",
      "included": true,
      "days": "Mon–Sun",
      "publicHolidays": "Weekend cleaner incl. public holidays",
      "crew": "Mon–Fri 2 × 8.0 h · Sat–Sun 1 × 8.0 h",
      "weeklyHours": 96,
      "opDaysPerYear": 365,
      "zones": [
        {
          "name": "Main entry areas",
          "tasks": [
            {
              "t": "Spot check flooring and areas throughout the day (morning & afternoon)",
              "f": "2x Daily"
            },
            {
              "t": "Vacuum or sweep front floor surfaces to remove dirt, soil and loose matter",
              "f": "Daily"
            },
            {
              "t": "Spot clean and damp wipe all ledges, skirting, walls, window seals, furniture, plants, mirrors and handrails",
              "f": "Weekly"
            },
            {
              "t": "Remove cobwebs from ceilings and corners",
              "f": "As Required"
            },
            {
              "t": "Spot clean foyer entry glass and mirrors, if applicable",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Garbage rooms",
          "tasks": [
            {
              "t": "Deodorising disinfectant wash of chute room floors and surrounds on all levels; spot clean on weekends",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean all garbage room walls to keep a clean appearance",
              "f": "As Required"
            },
            {
              "t": "Inspect and tidy lower garbage room collection areas to minimise smells and odours",
              "f": "Daily"
            },
            {
              "t": "Rotate bins in compactor room so empty bins are always available for the chute",
              "f": "Daily"
            },
            {
              "t": "Sort recycling and rubbish into appropriate bins",
              "f": "Daily"
            },
            {
              "t": "Remove bins to collection point and return after collection",
              "f": "As Required"
            },
            {
              "t": "Run water sanitisation system in garbage chutes on all foyers, if installed",
              "f": "Quarterly"
            }
          ]
        },
        {
          "name": "Common hallways & lifts",
          "tasks": [
            {
              "t": "Thoroughly vacuum all floor surfaces",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean and damp wipe ledges, skirting, walls, window seals, door jambs and rails",
              "f": "Weekly"
            },
            {
              "t": "Spot clean marks on walls",
              "f": "As Required"
            },
            {
              "t": "Spot clean marks from corridor mirrors",
              "f": "Daily"
            },
            {
              "t": "Dust and wipe down all vents",
              "f": "Quarterly"
            },
            {
              "t": "Spot check lifts throughout the day for spillages",
              "f": "2x Daily"
            },
            {
              "t": "Vacuum all lift floor surfaces",
              "f": "2x Daily"
            },
            {
              "t": "Remove finger marks, streaks and stains from lift mirror panels and external wall panels",
              "f": "Daily"
            },
            {
              "t": "Vacuum and wipe clean lift door tracks on each floor",
              "f": "Monthly"
            },
            {
              "t": "Shampoo carpets in all common areas",
              "f": "Annually"
            }
          ]
        }
      ]
    },
    {
      "id": "OC8",
      "name": "Residential L67–92",
      "sub": "Upper tower incl. yoga room, library, kitchen/BBQ",
      "included": true,
      "days": "Mon–Sun",
      "publicHolidays": "Not stated — confirm",
      "crew": "1 cleaner × 8.0 h/day, 7 days",
      "weeklyHours": 56,
      "opDaysPerYear": 365,
      "zones": [
        {
          "name": "Main entry areas",
          "tasks": [
            {
              "t": "Spot check flooring and areas throughout the day (morning & afternoon)",
              "f": "2x Daily"
            },
            {
              "t": "Vacuum or sweep front floor surfaces to remove dirt, soil and loose matter",
              "f": "Daily"
            },
            {
              "t": "Spot clean and damp wipe all ledges, skirting, walls, window seals, furniture, plants, mirrors and handrails",
              "f": "Weekly"
            },
            {
              "t": "Remove cobwebs from ceilings and corners",
              "f": "As Required"
            },
            {
              "t": "Squeegee wash main foyer entry glass",
              "f": "Weekly"
            },
            {
              "t": "Spot clean main foyer entry glass",
              "f": "Daily"
            },
            {
              "t": "Collect litter and junk mail from post boxes, dispose into rubbish bin",
              "f": "Daily"
            },
            {
              "t": "Damp cloth wipe and clean post boxes",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Garbage rooms",
          "tasks": [
            {
              "t": "Deodorising disinfectant wash of chute room floors and surrounds on all levels; spot clean on weekends",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean all garbage room walls to keep a clean appearance",
              "f": "As Required"
            },
            {
              "t": "Inspect and tidy lower garbage room collection areas to minimise smells and odours",
              "f": "Daily"
            },
            {
              "t": "Rotate bins in compactor room so empty bins are always available for the chute",
              "f": "Daily"
            },
            {
              "t": "Sort recycling and rubbish into appropriate bins",
              "f": "Daily"
            },
            {
              "t": "Remove bins to collection point and return after collection",
              "f": "As Required"
            },
            {
              "t": "Run water sanitisation system in garbage chutes on all foyers",
              "f": "Quarterly"
            }
          ]
        },
        {
          "name": "Common hallways & lifts",
          "tasks": [
            {
              "t": "Thoroughly vacuum all floor surfaces",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean and damp wipe ledges, skirting, walls, window seals, door jambs and rails",
              "f": "Weekly"
            },
            {
              "t": "Spot clean marks on walls",
              "f": "As Required"
            },
            {
              "t": "Spot clean marks from corridor mirrors",
              "f": "Daily"
            },
            {
              "t": "Dust and wipe down all vents",
              "f": "Quarterly"
            },
            {
              "t": "Spot check lifts throughout the day for spillages",
              "f": "2x Daily"
            },
            {
              "t": "Vacuum all lift floor surfaces",
              "f": "2x Daily"
            },
            {
              "t": "Remove finger marks, streaks and stains from lift mirror panels and external wall panels",
              "f": "Daily"
            },
            {
              "t": "Vacuum and wipe clean lift door tracks on each floor",
              "f": "Monthly"
            }
          ]
        },
        {
          "name": "Toilets / change rooms / gym / yoga room",
          "tasks": [
            {
              "t": "Vacuum or sweep all floor surfaces",
              "f": "Daily"
            },
            {
              "t": "Damp mop floors with deodorising disinfectant",
              "f": "Daily"
            },
            {
              "t": "Empty rubbish bins, replace liners, wash bins when required",
              "f": "Daily"
            },
            {
              "t": "Dust and damp wipe sills, ledges, door tops, accessible pipes and horizontal surfaces",
              "f": "Daily"
            },
            {
              "t": "Clean toilet seats top and underside with approved deodorising disinfectant, wipe dry",
              "f": "Daily"
            },
            {
              "t": "Wash hand basins inside and underside with approved disinfectant, wipe dry",
              "f": "Daily"
            },
            {
              "t": "Remove finger marks, streaks and stains from mirror panels",
              "f": "Daily"
            },
            {
              "t": "Remove marks and stains from tiled surrounds with approved disinfectant",
              "f": "Daily"
            },
            {
              "t": "Wash shower tiles and glass with approved compound to remove soap and grease build-up",
              "f": "Weekly"
            },
            {
              "t": "Replenish hand soap, toilet paper, hand towels, urinal cubes and other requisites",
              "f": "Daily"
            },
            {
              "t": "Disinfectant wipe-down of all gymnasium equipment surfaces",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Communal / cinema / library",
          "tasks": [
            {
              "t": "Vacuum floor surfaces",
              "f": "Daily"
            },
            {
              "t": "Dust and wipe all furniture and fittings",
              "f": "Daily"
            },
            {
              "t": "Wipe and clean sinks, cupboards, microwave, fridge and benches",
              "f": "Daily"
            },
            {
              "t": "Damp mop flooring to remove spills and dust",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Kitchen / BBQ",
          "tasks": [
            {
              "t": "Clean, wipe and maintain BBQ and kitchen as required — ad hoc cleaning",
              "f": "Check Daily"
            }
          ]
        },
        {
          "name": "Miscellaneous",
          "tasks": [
            {
              "t": "High dusting of hallways, entry areas and garbage rooms to 3 m",
              "f": "Quarterly"
            },
            {
              "t": "Clean meter rooms, pump rooms, plant rooms and store rooms",
              "f": "Quarterly"
            },
            {
              "t": "Shampoo carpets in all common areas",
              "f": "Annually"
            }
          ]
        }
      ]
    },
    {
      "id": "OC9",
      "name": "Residential L33–91",
      "sub": "Mid tower incl. pool surrounds",
      "included": true,
      "days": "Mon–Sun",
      "publicHolidays": "Weekend shift incl. public holidays",
      "crew": "Mon–Fri 1 × 8.0 h · Sat–Sun 1 × 4.0 h",
      "weeklyHours": 48,
      "opDaysPerYear": 365,
      "zones": [
        {
          "name": "Main entry areas",
          "tasks": [
            {
              "t": "Spot check flooring and areas throughout the day (morning & afternoon)",
              "f": "2x Daily"
            },
            {
              "t": "Vacuum or sweep front floor surfaces to remove dirt, soil and loose matter",
              "f": "Daily"
            },
            {
              "t": "Spot clean and damp wipe all ledges, skirting, walls, window seals, furniture, plants, mirrors and handrails",
              "f": "Weekly"
            },
            {
              "t": "Remove cobwebs from ceilings and corners",
              "f": "As Required"
            },
            {
              "t": "Squeegee wash main foyer entry glass",
              "f": "Weekly"
            },
            {
              "t": "Spot clean main foyer entry glass",
              "f": "Daily"
            },
            {
              "t": "Collect litter and junk mail from post boxes, dispose into rubbish bin",
              "f": "Daily"
            },
            {
              "t": "Damp cloth wipe and clean post boxes",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Garbage rooms",
          "tasks": [
            {
              "t": "Deodorising disinfectant wash of chute room floors and surrounds on all levels; spot clean on weekends",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean all garbage room walls to keep a clean appearance",
              "f": "As Required"
            },
            {
              "t": "Inspect and tidy lower garbage room collection areas to minimise smells and odours",
              "f": "Daily"
            },
            {
              "t": "Rotate bins in compactor room so empty bins are always available for the chute",
              "f": "Daily"
            },
            {
              "t": "Sort recycling and rubbish into appropriate bins",
              "f": "Daily"
            },
            {
              "t": "Remove bins to collection point and return after collection",
              "f": "As Required"
            },
            {
              "t": "Run water sanitisation system in garbage chutes on all foyers",
              "f": "Quarterly"
            }
          ]
        },
        {
          "name": "Common hallways & lifts",
          "tasks": [
            {
              "t": "Thoroughly vacuum all floor surfaces",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean and damp wipe ledges, skirting, walls, window seals, door jambs and rails",
              "f": "Weekly"
            },
            {
              "t": "Spot clean marks on walls",
              "f": "As Required"
            },
            {
              "t": "Spot clean marks from corridor mirrors",
              "f": "Daily"
            },
            {
              "t": "Dust and wipe down all vents",
              "f": "Quarterly"
            },
            {
              "t": "Spot check lifts throughout the day for spillages",
              "f": "2x Daily"
            },
            {
              "t": "Vacuum all lift floor surfaces",
              "f": "2x Daily"
            },
            {
              "t": "Remove finger marks, streaks and stains from lift mirror panels and external wall panels",
              "f": "Daily"
            },
            {
              "t": "Vacuum and wipe clean lift door tracks on each floor",
              "f": "Monthly"
            }
          ]
        },
        {
          "name": "Toilets / change rooms / gym",
          "tasks": [
            {
              "t": "Vacuum or sweep all floor surfaces",
              "f": "Daily"
            },
            {
              "t": "Damp mop floors with deodorising disinfectant",
              "f": "Daily"
            },
            {
              "t": "Empty rubbish bins, replace liners, wash bins when required",
              "f": "Daily"
            },
            {
              "t": "Dust and damp wipe sills, ledges, door tops, accessible pipes and horizontal surfaces",
              "f": "Daily"
            },
            {
              "t": "Clean toilet seats top and underside with approved deodorising disinfectant, wipe dry",
              "f": "Daily"
            },
            {
              "t": "Wash hand basins inside and underside with approved disinfectant, wipe dry",
              "f": "Daily"
            },
            {
              "t": "Remove finger marks, streaks and stains from mirror panels",
              "f": "Daily"
            },
            {
              "t": "Remove marks and stains from tiled surrounds with approved disinfectant",
              "f": "Daily"
            },
            {
              "t": "Wash shower tiles and glass with approved compound to remove soap and grease build-up",
              "f": "Weekly"
            },
            {
              "t": "Replenish hand soap, toilet paper, hand towels, urinal cubes and other requisites",
              "f": "Daily"
            },
            {
              "t": "Disinfectant wipe-down of all gymnasium equipment surfaces",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Pool surrounds",
          "tasks": [
            {
              "t": "Wipe clean all pool furniture with an approved chemical",
              "f": "As Required"
            },
            {
              "t": "Damp mop all hard floors with deodorising disinfectant",
              "f": "Daily"
            },
            {
              "t": "Dust or vacuum vents, grilles, blinds, power points and accessible fixtures and fittings",
              "f": "Weekly"
            },
            {
              "t": "Squeegee wash glass and metal panels within the pool area",
              "f": "Monthly"
            }
          ]
        },
        {
          "name": "Communal / cinema / meeting rooms",
          "tasks": [
            {
              "t": "Vacuum floor surfaces",
              "f": "Daily"
            },
            {
              "t": "Dust and wipe all furniture and fittings",
              "f": "Daily"
            },
            {
              "t": "Wipe and clean sinks, cupboards, microwave, fridge and benches",
              "f": "Daily"
            },
            {
              "t": "Damp mop flooring to remove spills and dust",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Miscellaneous",
          "tasks": [
            {
              "t": "High dusting of hallways, entry areas and garbage rooms to 3 m",
              "f": "Quarterly"
            },
            {
              "t": "Clean meter rooms, pump rooms, plant rooms and store rooms",
              "f": "Quarterly"
            },
            {
              "t": "Cleaning to building manager's office",
              "f": "As Required"
            },
            {
              "t": "Shampoo carpets in all common areas",
              "f": "Annually"
            }
          ]
        }
      ]
    },
    {
      "id": "OC10",
      "name": "Levels 9–91",
      "sub": "Mixed levels incl. pool surrounds and loading dock",
      "included": true,
      "days": "Mon–Sun",
      "publicHolidays": "Weekend shift incl. public holidays",
      "crew": "1 cleaner × 8.0 h/day, 7 days",
      "weeklyHours": 56,
      "opDaysPerYear": 365,
      "zones": [
        {
          "name": "Main entry areas",
          "tasks": [
            {
              "t": "Spot check flooring and areas throughout the day (morning & afternoon)",
              "f": "2x Daily"
            },
            {
              "t": "Vacuum or sweep front floor surfaces to remove dirt, soil and loose matter",
              "f": "Daily"
            },
            {
              "t": "Spot clean and damp wipe all ledges, skirting, walls, window seals, furniture, plants, mirrors and handrails",
              "f": "Weekly"
            },
            {
              "t": "Remove cobwebs from ceilings and corners",
              "f": "As Required"
            },
            {
              "t": "Squeegee wash main foyer entry glass",
              "f": "Weekly"
            },
            {
              "t": "Spot clean main foyer entry glass",
              "f": "Daily"
            },
            {
              "t": "Collect litter and junk mail from post boxes, dispose into rubbish bin",
              "f": "Daily"
            },
            {
              "t": "Damp cloth wipe and clean post boxes",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Garbage rooms",
          "tasks": [
            {
              "t": "Deodorising disinfectant wash of chute room floors and surrounds on all levels; spot clean on weekends",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean all garbage room walls to keep a clean appearance",
              "f": "As Required"
            },
            {
              "t": "Inspect and tidy lower garbage room collection areas to minimise smells and odours",
              "f": "Daily"
            },
            {
              "t": "Rotate bins in compactor room so empty bins are always available for the chute",
              "f": "Daily"
            },
            {
              "t": "Sort recycling and rubbish into appropriate bins",
              "f": "Daily"
            },
            {
              "t": "Remove bins to collection point and return after collection",
              "f": "As Required"
            },
            {
              "t": "Run water sanitisation system in garbage chutes on all foyers",
              "f": "Quarterly"
            }
          ]
        },
        {
          "name": "Common hallways & lifts",
          "tasks": [
            {
              "t": "Thoroughly vacuum all floor surfaces",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean and damp wipe ledges, skirting, walls, window seals, door jambs and rails",
              "f": "Weekly"
            },
            {
              "t": "Spot clean marks on walls",
              "f": "As Required"
            },
            {
              "t": "Spot clean marks from corridor mirrors",
              "f": "Daily"
            },
            {
              "t": "Dust and wipe down all vents",
              "f": "Quarterly"
            },
            {
              "t": "Spot check lifts throughout the day for spillages",
              "f": "2x Daily"
            },
            {
              "t": "Vacuum all lift floor surfaces",
              "f": "2x Daily"
            },
            {
              "t": "Remove finger marks, streaks and stains from lift mirror panels and external wall panels",
              "f": "Daily"
            },
            {
              "t": "Vacuum and wipe clean lift door tracks on each floor",
              "f": "Monthly"
            }
          ]
        },
        {
          "name": "Toilets / change rooms / gym",
          "tasks": [
            {
              "t": "Vacuum or sweep all floor surfaces",
              "f": "Daily"
            },
            {
              "t": "Damp mop floors with deodorising disinfectant",
              "f": "Daily"
            },
            {
              "t": "Empty rubbish bins, replace liners, wash bins when required",
              "f": "Daily"
            },
            {
              "t": "Dust and damp wipe sills, ledges, door tops, accessible pipes and horizontal surfaces",
              "f": "Daily"
            },
            {
              "t": "Clean toilet seats top and underside with approved deodorising disinfectant, wipe dry",
              "f": "Daily"
            },
            {
              "t": "Wash hand basins inside and underside with approved disinfectant, wipe dry",
              "f": "Daily"
            },
            {
              "t": "Remove finger marks, streaks and stains from mirror panels",
              "f": "Daily"
            },
            {
              "t": "Remove marks and stains from tiled surrounds with approved disinfectant",
              "f": "Daily"
            },
            {
              "t": "Wash shower tiles and glass with approved compound to remove soap and grease build-up",
              "f": "Weekly"
            },
            {
              "t": "Replenish hand soap, toilet paper, hand towels, urinal cubes and other requisites",
              "f": "Daily"
            },
            {
              "t": "Disinfectant wipe-down of all gymnasium equipment surfaces",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Pool surrounds",
          "tasks": [
            {
              "t": "Wipe clean all pool furniture with an approved chemical",
              "f": "As Required"
            },
            {
              "t": "Damp mop all hard floors with deodorising disinfectant",
              "f": "Daily"
            },
            {
              "t": "Dust or vacuum vents, grilles, blinds, power points and accessible fixtures and fittings",
              "f": "Weekly"
            },
            {
              "t": "Squeegee wash glass and metal panels within the pool area",
              "f": "Monthly"
            }
          ]
        },
        {
          "name": "Loading dock",
          "tasks": [
            {
              "t": "Spot clean floor to remove loose items",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Communal / cinema / meeting rooms",
          "tasks": [
            {
              "t": "Vacuum floor surfaces",
              "f": "Daily"
            },
            {
              "t": "Dust and wipe all furniture and fittings",
              "f": "Daily"
            },
            {
              "t": "Wipe and clean sinks, cupboards, microwave, fridge and benches",
              "f": "Daily"
            },
            {
              "t": "Damp mop flooring to remove spills and dust",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Miscellaneous",
          "tasks": [
            {
              "t": "High dusting of hallways, entry areas and garbage rooms to 3 m",
              "f": "Quarterly"
            },
            {
              "t": "Clean meter rooms, pump rooms, plant rooms and store rooms",
              "f": "Quarterly"
            },
            {
              "t": "Cleaning to building manager's office",
              "f": "As Required"
            },
            {
              "t": "Shampoo carpets in all common areas",
              "f": "Annually"
            }
          ]
        }
      ]
    },
    {
      "id": "OC2",
      "name": "Retail Lots (Private)",
      "sub": "OPTIONAL EXTRA — not included in this agreement",
      "included": false,
      "days": "Mon–Sun",
      "publicHolidays": "Included",
      "crew": "1 × 8.0 h + 1 × 4.0 h, 7 days",
      "weeklyHours": 84,
      "opDaysPerYear": 365,
      "zones": [
        {
          "name": "Main areas",
          "tasks": [
            {
              "t": "Spot check flooring and areas throughout the day",
              "f": "3x Daily"
            },
            {
              "t": "Vacuum or sweep front floor surfaces to remove dirt, soil and loose matter",
              "f": "Daily"
            },
            {
              "t": "Spot clean and damp wipe all ledges, skirting, walls, window seals, furniture, plants, mirrors and handrails",
              "f": "Weekly"
            },
            {
              "t": "Remove cobwebs from ceilings and corners",
              "f": "As Required"
            },
            {
              "t": "Squeegee wash main foyer entry glass",
              "f": "Weekly"
            },
            {
              "t": "Spot clean main foyer entry glass",
              "f": "Daily"
            },
            {
              "t": "Collect litter and junk mail from post boxes, dispose into rubbish bin",
              "f": "Daily"
            },
            {
              "t": "Damp cloth wipe and clean post boxes",
              "f": "Daily"
            }
          ]
        },
        {
          "name": "Garbage room",
          "tasks": [
            {
              "t": "Deodorising disinfectant wash of chute room floors and surrounds on all levels; spot clean on weekends",
              "f": "3 days/week"
            },
            {
              "t": "Spot clean all garbage room walls to keep a clean appearance",
              "f": "As Required"
            },
            {
              "t": "Inspect and tidy lower garbage room collection areas to minimise smells and odours",
              "f": "Daily"
            },
            {
              "t": "Rotate bins in compactor room so empty bins are always available for the chute",
              "f": "Daily"
            },
            {
              "t": "Sort recycling and rubbish into appropriate bins",
              "f": "Daily"
            },
            {
              "t": "Remove bins to collection point and return after collection",
              "f": "As Required"
            }
          ]
        },
        {
          "name": "Miscellaneous",
          "tasks": [
            {
              "t": "High dusting of hallways, entry areas and garbage rooms to 3 m",
              "f": "Quarterly"
            },
            {
              "t": "Clean meter rooms, pump rooms, plant rooms and store rooms",
              "f": "Quarterly"
            }
          ]
        }
      ]
    }
  ],
  "positions": [
    {
      "code": "OC1-C1",
      "oc": "OC1",
      "role": "Cleaner 1",
      "wk": {
        "s": 6,
        "e": 14.5,
        "h": 8
      },
      "we": {
        "s": 6,
        "e": 14.5,
        "h": 8
      },
      "note": "AM cover — morning entry and lift checks"
    },
    {
      "code": "OC1-C2",
      "oc": "OC1",
      "role": "Cleaner 2",
      "wk": {
        "s": 10.5,
        "e": 19,
        "h": 8
      },
      "we": {
        "s": 10.5,
        "e": 19,
        "h": 8
      },
      "note": "PM cover — afternoon checks, amenities second pass"
    },
    {
      "code": "OC3-C1",
      "oc": "OC3",
      "role": "Cleaner 1",
      "wk": {
        "s": 6,
        "e": 8.5,
        "h": 2.5
      },
      "we": {
        "s": 6,
        "e": 8.5,
        "h": 2.5
      },
      "note": "Car park litter sweep before peak movements"
    },
    {
      "code": "OC5-C1",
      "oc": "OC5",
      "role": "Cleaner 1",
      "wk": {
        "s": 17.5,
        "e": 19,
        "h": 1.5
      },
      "we": null,
      "note": "After-hours office common areas, weekdays only"
    },
    {
      "code": "OC6-C1",
      "oc": "OC6",
      "role": "Cleaner 1",
      "wk": {
        "s": 7,
        "e": 15.5,
        "h": 8
      },
      "we": null,
      "note": "AM cover L10–32"
    },
    {
      "code": "OC6-C2",
      "oc": "OC6",
      "role": "Cleaner 2",
      "wk": {
        "s": 10.5,
        "e": 19,
        "h": 8
      },
      "we": null,
      "note": "PM cover L10–32"
    },
    {
      "code": "OC6-C3",
      "oc": "OC6",
      "role": "Cleaner 3",
      "wk": null,
      "we": {
        "s": 8,
        "e": 16.5,
        "h": 8
      },
      "note": "Weekend and public holiday cover L10–32"
    },
    {
      "code": "OC8-C1",
      "oc": "OC8",
      "role": "Cleaner 1",
      "wk": {
        "s": 7,
        "e": 15.5,
        "h": 8
      },
      "we": {
        "s": 7,
        "e": 15.5,
        "h": 8
      },
      "note": "L67–92 incl. yoga room, library, kitchen/BBQ"
    },
    {
      "code": "OC9-C1",
      "oc": "OC9",
      "role": "Cleaner 1",
      "wk": {
        "s": 7,
        "e": 15.5,
        "h": 8
      },
      "we": {
        "s": 8,
        "e": 12,
        "h": 4
      },
      "note": "L33–91 incl. pool level — 4.0 h weekend shift"
    },
    {
      "code": "OC10-C1",
      "oc": "OC10",
      "role": "Cleaner 1",
      "wk": {
        "s": 7,
        "e": 15.5,
        "h": 8
      },
      "we": {
        "s": 7,
        "e": 15.5,
        "h": 8
      },
      "note": "L9–91 incl. pool surrounds and loading dock"
    }
  ],
  "security": {
    "code": "SEC-1",
    "role": "Security officer",
    "days": "Mon–Sun",
    "hours": 8,
    "shift": "23:00–07:00",
    "status": "Shift hours 'to be determined' in the agreement",
    "weeklyHours": 56,
    "uniform": "Smartly uniformed, visible ID badge at all times on duty"
  },
  "gateService": {
    "name": "Car park & boom gate preventative maintenance",
    "frequency": "Quarterly",
    "commencement": "End of DLP period — date to be determined",
    "assets": [
      "1 × car park door",
      "1 × loading dock door",
      "2 × boom gates"
    ],
    "tasks": [
      "Check operation of door(s)",
      "Lubricate equipment as required using heavy-duty zinc oxide grease",
      "Lubricate motor drive chain as required",
      "Check wire ropes, guide tracks, wheels, end clips and pulleys"
    ]
  },
  "flags": [
    "Every cleaning shift's start/finish time is 'to be advised' — the roster shown is an indicative proposal until times are locked with each OC.",
    "Public holiday coverage is inconsistent: OC1, OC3 and the weekend shifts on OC6/OC9/OC10 include public holidays; OC5 excludes them; OC8 is silent — confirm before pricing penalty rates.",
    "Twice-daily entry and lift checks on OC1 and OC6 force a genuine AM/PM staggered presence — a single straight shift cannot satisfy the frequency wording.",
    "The periodic tail is the audit exposure: quarterly chute sanitisation across five OCs, quarterly vents/high dusting/plant rooms, monthly lift tracks, bi-annual car park scrub, annual fire stairs and carpet shampoos.",
    "Car park high-pipe dusting requires high ladder hire at additional cost — billable extra, quote before scheduling.",
    "OC2 Retail Lots (84 h/week) is explicitly optional and not included — a standing upsell.",
    "Each OC schedule is a sample: a complete revised, fine-tuned schedule is contractually due within the first 3 months.",
    "Boom gate / door quarterly PM commences at the end of the DLP period — date not yet set."
  ]
};
