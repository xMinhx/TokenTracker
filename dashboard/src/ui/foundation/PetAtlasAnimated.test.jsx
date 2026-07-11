import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PetAtlasAnimated, petAtlasRowForState } from "./PetAtlasAnimated.jsx";

describe("PetAtlasAnimated", () => {
  it("maps live data states to distinct atlas actions", () => {
    expect(petAtlasRowForState("working-thinking")).toBe("review");
    expect(petAtlasRowForState("working-juggling")).toBe("running");
    expect(petAtlasRowForState("working-overheated")).toBe("failed");
    expect(petAtlasRowForState("happy")).toBe("jumping");
    expect(petAtlasRowForState("sleeping")).toBe("waiting");
  });

  it("loads the selected character's independent sprite atlas", () => {
    const { container } = render(<PetAtlasAnimated character="byte" state="happy" size={208} />);
    const sprite = container.firstElementChild;
    expect(sprite).toHaveStyle({
      width: "192px",
      height: "208px",
      backgroundImage: "url(/pets/byte/spritesheet.webp)",
      backgroundSize: "800% 900%",
    });
  });
});
