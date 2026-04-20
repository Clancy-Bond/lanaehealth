"use client";

/**
 * MFN parity: meal-header `LOG` link opens a dropdown menu.
 *
 * Reference: s3.amazonaws.com/img.mynetdiary.com/help/web/web_create_custom_food_and_recipe.jpg
 *
 * Menu contents (exact MFN order):
 *   Same [Meal]
 *   Recent Meal
 *   Quick
 *   Search
 *   Create ▸ (Custom Food | Recipe from [Meal] Foods | Recipe from Scratch)
 *   MyFoods ▸
 *   Meal Planner
 *
 * Each option routes into an existing LanaeHealth surface:
 *   Same / Recent    -> /calories/search?view=recent
 *   Quick            -> /log?meal=X (quick-log by calories)
 *   Search           -> /calories/search?view=search
 *   Create           -> /calories/custom-foods/new / /calories/recipes/new
 *   MyFoods          -> /calories/search?view=custom
 *   Meal Planner     -> /calories/search?view=my-meals
 */

import { useEffect, useRef, useState } from "react";

type Meal = "breakfast" | "lunch" | "dinner" | "snack";

export function MealLogDropdown({ meal }: { meal: Meal }) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<"create" | "myfoods" | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  const mealLabel = meal.charAt(0).toUpperCase() + meal.slice(1);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSubmenu(null);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--accent-sage)",
          background: "transparent",
          border: "none",
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          cursor: "pointer",
          padding: 0,
        }}
      >
        LOG
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            minWidth: 190,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderRadius: 8,
            boxShadow: "var(--shadow-md)",
            padding: 4,
            zIndex: 30,
            marginTop: 4,
          }}
        >
          <Item href={`/calories/search?view=recent&meal=${meal}`} label={`Same ${mealLabel}`} />
          <Item href={`/calories/search?view=recent&meal=${meal}`} label="Recent Meal" />
          <Item href={`/log?meal=${meal}`} label="Quick" />
          <Item href={`/calories/search?view=search&meal=${meal}`} label="Search" />
          <NestItem
            label="Create"
            onMouseEnter={() => setSubmenu("create")}
            onMouseLeave={() => setSubmenu(null)}
            active={submenu === "create"}
          >
            {submenu === "create" && (
              <SubMenu>
                <Item href={`/calories/custom-foods/new?meal=${meal}`} label="Custom Food" />
                <Item href={`/calories/recipes/new?meal=${meal}`} label={`Recipe from ${mealLabel} Foods`} />
                <Item href="/calories/recipes/new" label="Recipe from Scratch" />
              </SubMenu>
            )}
          </NestItem>
          <NestItem
            label="MyFoods"
            onMouseEnter={() => setSubmenu("myfoods")}
            onMouseLeave={() => setSubmenu(null)}
            active={submenu === "myfoods"}
          >
            {submenu === "myfoods" && (
              <SubMenu>
                <Item href={`/calories/search?view=custom&meal=${meal}`} label="Custom Foods" />
                <Item href={`/calories/search?view=my-recipes&meal=${meal}`} label="My Recipes" />
                <Item href={`/calories/search?view=favorites&meal=${meal}`} label="Favorites" />
                <Item href={`/calories/search?view=frequent&meal=${meal}`} label="Frequent" />
              </SubMenu>
            )}
          </NestItem>
          <Item href={`/calories/search?view=my-meals&meal=${meal}`} label="Meal Planner" />
        </div>
      )}
    </div>
  );
}

function Item({ href, label }: { href: string; label: string }) {
  return (
    <a
      role="menuitem"
      href={href}
      style={{
        display: "block",
        padding: "8px 12px",
        fontSize: 13,
        color: "var(--text-primary)",
        textDecoration: "none",
        borderRadius: 6,
      }}
    >
      {label}
    </a>
  );
}

function NestItem({
  label,
  active,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  label: string;
  active: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{ position: "relative" }}
    >
      <div
        role="menuitem"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          fontSize: 13,
          color: "var(--text-primary)",
          borderRadius: 6,
          background: active ? "var(--accent-sage-muted)" : "transparent",
          cursor: "default",
        }}
      >
        <span>{label}</span>
        <span aria-hidden style={{ fontSize: 11, color: "var(--text-muted)" }}>
          &rsaquo;
        </span>
      </div>
      {children}
    </div>
  );
}

function SubMenu({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="menu"
      style={{
        position: "absolute",
        top: 0,
        left: "100%",
        marginLeft: 4,
        minWidth: 220,
        background: "var(--bg-card)",
        border: "1px solid var(--border-light)",
        borderRadius: 8,
        boxShadow: "var(--shadow-md)",
        padding: 4,
        zIndex: 31,
      }}
    >
      {children}
    </div>
  );
}
