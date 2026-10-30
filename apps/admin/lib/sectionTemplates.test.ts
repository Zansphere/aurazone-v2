import { describe, it, expect } from "vitest";
import {
  SECTION_TEMPLATES,
  getTemplate,
  getTemplateList,
  getDefaultContent,
} from "./sectionTemplates";

describe("sectionTemplates", () => {
  it("should contain all expected section templates", () => {
    const expectedTypes = [
      "HERO_BANNER",
      "PRODUCT_CAROUSEL",
      "CATEGORY_GRID",
      "STORE_GRID",
      "PROMO_BANNER",
      "TEXT_BLOCK",
      "IMAGE_GALLERY",
      "COUNTDOWN_TIMER",
      "CUSTOM_HTML",
    ];

    expectedTypes.forEach((type) => {
      expect(SECTION_TEMPLATES[type]).toBeDefined();
      expect(SECTION_TEMPLATES[type].label).toBeTruthy();
      expect(SECTION_TEMPLATES[type].fields.length).toBeGreaterThan(0);
    });
  });

  describe("getTemplate", () => {
    it("should return the template definition for a valid type", () => {
      const hero = getTemplate("HERO_BANNER");
      expect(hero).toBeDefined();
      expect(hero?.label).toBe("Hero Banner");
    });

    it("should return undefined for an unknown type", () => {
      expect(getTemplate("NON_EXISTENT")).toBeUndefined();
    });
  });

  describe("getTemplateList", () => {
    it("should return an array of all templates with type property included", () => {
      const list = getTemplateList();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBe(Object.keys(SECTION_TEMPLATES).length);
      expect(list[0]).toHaveProperty("type");
      expect(list[0]).toHaveProperty("label");
      expect(list[0]).toHaveProperty("fields");
    });
  });

  describe("getDefaultContent", () => {
    it("should return empty object for unknown template type", () => {
      expect(getDefaultContent("UNKNOWN")).toEqual({});
    });

    it("should generate default field values according to field types", () => {
      const defaults = getDefaultContent("PRODUCT_CAROUSEL");
      expect(defaults).toBeDefined();
      expect(defaults.autoScroll).toBe(true); // boolean default
      expect(defaults.showPrice).toBe(true); // boolean default
      expect(defaults.maxItems).toBe(12); // parsed number from placeholder
      expect(defaults.heading).toBe(""); // text default
    });

    it("should generate default values for hero banner", () => {
      const defaults = getDefaultContent("HERO_BANNER");
      expect(defaults.overlayOpacity).toBe(0.4);
      expect(defaults.heading).toBe("");
      expect(defaults.imageUrl).toBe("");
    });
  });
});

