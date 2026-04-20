# MyNetDiary primitives observed

From `docs/reference/mynetdiary/frames/full-tour/frame_{0100,0300}.png`. MFN is consulted for food-tracking UX patterns only.

## Portion chip strip

Horizontal row of small rounded pills each showing a portion size ("2 fl oz", "2.25 fl oz", "cup", "tbsp"). Tapping a chip sets the portion; the selected chip gets a filled background. This is the primary interaction for logging a food item.

Our v2 equivalent uses the `SegmentedControl` primitive for the common case (≤ 5 options) and a dedicated portion-picker sheet for the long case. The food-section session owns the dedicated picker.

## Meal header

Thin bar at the top of a meal group: meal name ("Breakfast") + total cals + context chevron. Background is a muted tint so the individual food rows read more clearly.

Use `ListRow` with `leading` = meal icon and `trailing` = total cals for a parallel in v2.

## Food detail card

The "FDA Nutrition Facts" style card (macros pie chart + table). This is a section-specific primitive and is not lifted into the foundation primitives set. The food-section session will define it.

## Barcode scan UI

Full-screen camera with a tab row at the top (Search / Scan / Favs / Calories / Staples / Custom). The scan mode is the active tab. Green corners around a scan area. Bottom has "Hold at least 6" away" + "Avoid glare and shadows." instructions.

We do not lift the scan UI into foundation; the food-section session owns it.

## Tab row (sub-tabs inside a section)

MFN uses a second level of tabs inside a section: below the top app bar, a horizontal row of 5-6 tabs. The active tab has a white fill on the green row. This pattern is captured by our `SegmentedControl` primitive, with the food-section session configuring it for 5-6 tabs.
