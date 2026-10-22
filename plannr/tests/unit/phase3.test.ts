import { test } from "node:test";
import assert from "node:assert/strict";
import { exampleDesigns, parseDesignProposal } from "@/lib/house-style/designs";
import { isFontName } from "@/lib/house-style/fonts";
import { DEFAULT_HOUSE_STYLE, isCoverBlock, isHexColor, toDesignBlocks, toHouseStyle, VARIANT_BLOCKS } from "@/lib/house-style/types";
import { DEFAULT_PLAN_CONFIG, firmReportSections } from "@/lib/plan/types";

test("firm default report sections: known keys in report order, Plannr defaults when unset", () => {
  assert.deepEqual(firmReportSections(null), DEFAULT_PLAN_CONFIG.reportSections);
  assert.deepEqual(firmReportSections(["toelichting", "onzin", "samenvatting"]), ["samenvatting", "toelichting"]);
  assert.deepEqual(firmReportSections([]), []);
});

test("design blocks: stored blocks win, missing ones follow the lay-out variant", () => {
  assert.deepEqual(toDesignBlocks(null, "modern"), VARIANT_BLOCKS.modern);
  assert.deepEqual(toDesignBlocks({ cover: "licht", opener: "x" }, "klassiek"), { cover: "licht", opener: "lijn", panel: "papier" });
  const hs = toHouseStyle({ layout_variant: "minimalistisch", ontwerp: { panel: "tint" } });
  assert.deepEqual(hs.blocks, { cover: "zijbalk", opener: "hoofdstuk", panel: "tint" });
  assert.deepEqual(toHouseStyle(null).blocks, VARIANT_BLOCKS.klassiek);
});

const proposal = {
  designs: [
    { name: "Rustig goud", rationale: "Past bij het logo.", primaryColor: "#1f3a5f", secondaryColor: "#5B7DB1", accentColor: "#C9A227", fontHeading: "Merriweather", fontBody: "Inter", cover: "licht", opener: "nummer", panel: "kader" },
    { name: "Zakelijk", rationale: "Strak.", primaryColor: "#0E2A47", secondaryColor: "#3D6A9E", accentColor: "#E0B54A", fontHeading: "Montserrat", fontBody: "Lato", cover: "zijbalk", opener: "lijn", panel: "papier" },
    { name: "Warm", rationale: "Uitnodigend.", primaryColor: "#5A2E2E", secondaryColor: "#9C6B5B", accentColor: "#D9A441", fontHeading: "Playfair Display", fontBody: "Source Sans 3", cover: "kleurvlak", opener: "balk", panel: "tint" },
  ],
};

test("AI design proposal: validated against the catalogue, colours upper-cased", () => {
  const designs = parseDesignProposal(proposal)!;
  assert.equal(designs.length, 3);
  assert.equal(designs[0].primaryColor, "#1F3A5F");
  assert.deepEqual(designs[0].blocks, { cover: "licht", opener: "nummer", panel: "kader" });
  assert.equal(parseDesignProposal({ designs: [{ ...proposal.designs[0], fontBody: "Comic Sans" }] }), null, "unknown font refused");
  assert.equal(parseDesignProposal({ designs: [{ ...proposal.designs[0], cover: "foto" }] }), null, "unknown block refused");
  assert.equal(parseDesignProposal({ designs: [{ ...proposal.designs[0], accentColor: "gold" }] }), null, "colour must be hex");
  assert.equal(parseDesignProposal({ designs: [] }), null);
  assert.equal(parseDesignProposal({ designs: [...proposal.designs, proposal.designs[0]] })!.length, 3, "at most three");
});

test("example designs without AI: three valid, different designs from the current colours", () => {
  const designs = exampleDesigns(DEFAULT_HOUSE_STYLE);
  assert.equal(designs.length, 3);
  assert.equal(new Set(designs.map((d) => d.blocks.cover)).size, 3);
  for (const d of designs) {
    assert.ok([d.primaryColor, d.secondaryColor, d.accentColor].every(isHexColor), d.name);
    assert.ok(isFontName(d.fontHeading) && isFontName(d.fontBody), d.name);
    assert.ok(isCoverBlock(d.blocks.cover));
  }
});
