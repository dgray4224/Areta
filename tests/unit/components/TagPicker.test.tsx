import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TagPicker } from "@/platform/ui/TagPicker";

describe("TagPicker", () => {
  it("adds a suggestion to value when clicked", () => {
    const onChange = vi.fn();
    render(<TagPicker suggestions={["Vegan", "Vegetarian"]} value={[]} onChange={onChange} />);

    fireEvent.click(screen.getByText("Vegan"));

    expect(onChange).toHaveBeenCalledWith(["Vegan"]);
  });

  it("removes a selected suggestion when clicked again", () => {
    const onChange = vi.fn();
    render(
      <TagPicker suggestions={["Vegan", "Vegetarian"]} value={["Vegan"]} onChange={onChange} />
    );

    fireEvent.click(screen.getByText("Vegan"));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("adds a custom tag on Enter", () => {
    const onChange = vi.fn();
    render(<TagPicker suggestions={["Vegan"]} value={[]} onChange={onChange} placeholder="Add" />);

    const input = screen.getByPlaceholderText("Add");
    fireEvent.change(input, { target: { value: "Keto" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(["Keto"]);
  });

  it("typing an existing suggestion toggles it instead of duplicating", () => {
    const onChange = vi.fn();
    render(<TagPicker suggestions={["Vegan"]} value={[]} onChange={onChange} placeholder="Add" />);

    const input = screen.getByPlaceholderText("Add");
    fireEvent.change(input, { target: { value: "vegan" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith(["Vegan"]);
  });

  it("removes a custom tag via its × chip", () => {
    const onChange = vi.fn();
    render(<TagPicker suggestions={["Vegan"]} value={["Keto"]} onChange={onChange} />);

    fireEvent.click(screen.getByText("Keto ×"));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});
