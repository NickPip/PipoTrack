import { describe, it, expect } from "vitest";
import { parseSylectusEmail } from "./parser";

// Minimal HTML structure that matches what parseSylectusEmail expects: bold
// labels followed by their values, plus Pick-Up / Delivery blocks.
const SAMPLE_HTML = `
<html>
<body>
  <div>Bid on Order #4225</div>
  <table>
    <tr><td>2 STOPS, 206 MILES</td></tr>
    <tr><td>
      <div>Pick-Up</div>
      <div>1200 Fulton Ave, Atlanta, GA 30318</div>
      <div>05/28/26 09:00 EST</div>
    </td></tr>
    <tr><td>
      <div>Delivery</div>
      <div>450 Brickell Ave, Miami, FL 33131</div>
      <div>05/29/26 14:30 EST</div>
    </td></tr>
  </table>
  <p><b>Broker Company:</b> Coyote Logistics</p>
  <p><b>Broker Name:</b> Jane Doe</p>
  <p><b>Broker Phone:</b> +1 555 123 4567</p>
  <p><b>Email:</b> jane@coyote.com</p>
  <p><b>Posted Amount:</b> $1,850.00</p>
  <p><b>Vehicle required:</b> Sprinter Van</p>
  <p><b>Weight:</b> 4,200 lbs</p>
  <p><b>Pieces:</b> 3</p>
  <p><b>Dimensions:</b> 48L x 40W x 60H</p>
</body>
</html>
`;

describe("parseSylectusEmail", () => {
  it("extracts broker reference from 'Bid on Order #' line", () => {
    const r = parseSylectusEmail(SAMPLE_HTML);
    expect(r.brokerReference).toBe("4225");
  });

  it("extracts labelled fields (broker, contact, phone, email)", () => {
    const r = parseSylectusEmail(SAMPLE_HTML);
    expect(r.broker).toBe("Coyote Logistics");
    expect(r.brokerContact).toBe("Jane Doe");
    expect(r.brokerPhone).toBe("+1 555 123 4567");
    expect(r.brokerEmail).toBe("jane@coyote.com");
  });

  it("parses rate, weight, miles, pieces from labelled values", () => {
    const r = parseSylectusEmail(SAMPLE_HTML);
    expect(r.rate).toBe(1850);
    expect(r.weight).toBe(4200);
    expect(r.miles).toBe(206);
    expect(r.pieces).toBe(3);
    expect(r.vehicleRequired).toBe("Sprinter Van");
  });

  it("parses freight dimensions (LxWxH)", () => {
    const r = parseSylectusEmail(SAMPLE_HTML);
    expect(r.dimensionL).toBe(48);
    expect(r.dimensionW).toBe(40);
    expect(r.dimensionH).toBe(60);
  });

  it("extracts pickup + delivery addresses and ZIPs", () => {
    const r = parseSylectusEmail(SAMPLE_HTML);
    expect(r.pickupAddress).toBe("1200 Fulton Ave, Atlanta, GA 30318");
    expect(r.pickupZip).toBe("30318");
    expect(r.deliveryAddress).toBe("450 Brickell Ave, Miami, FL 33131");
    expect(r.deliveryZip).toBe("33131");
  });

  it("parses pickup + delivery dates", () => {
    const r = parseSylectusEmail(SAMPLE_HTML);
    expect(r.pickupDate).toBeInstanceOf(Date);
    expect(r.deliveryDate).toBeInstanceOf(Date);
    // 05/28/26 → year 2026
    expect(r.pickupDate?.getUTCFullYear()).toBe(2026);
    expect(r.pickupDate?.getUTCMonth()).toBe(4); // May (0-indexed)
    expect(r.pickupDate?.getUTCDate()).toBe(28);
  });

  it("returns nulls when fields are absent", () => {
    const r = parseSylectusEmail("<html><body><p>Empty</p></body></html>");
    expect(r.brokerReference).toBe(null);
    expect(r.broker).toBe(null);
    expect(r.rate).toBe(null);
    expect(r.miles).toBe(null);
    expect(r.pickupAddress).toBe(null);
    expect(r.deliveryAddress).toBe(null);
    expect(r.dimensionL).toBe(null);
  });

  it("falls back to text-based parsing when HTML pickup/delivery missing", () => {
    const htmlNoTable = `<html><body><p><b>Broker Company:</b> X</p></body></html>`;
    const text = [
      "Pick-Up",
      "100 Main St, Springfield, IL 62701",
      "05/30/26 08:00 EST",
      "",
      "Delivery",
      "200 Oak Ave, Madison, WI 53703",
      "05/31/26 16:00 EST",
    ].join("\n");
    const r = parseSylectusEmail(htmlNoTable, text);
    expect(r.pickupAddress).toBe("100 Main St, Springfield, IL 62701");
    expect(r.deliveryAddress).toBe("200 Oak Ave, Madison, WI 53703");
    expect(r.pickupZip).toBe("62701");
    expect(r.deliveryZip).toBe("53703");
  });
});
