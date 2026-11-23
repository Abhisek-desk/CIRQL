import { describe, it, expect } from "vitest";
import { request, app } from "../helpers/testApp.js";

describe("CIRQL Express Application", () => {

  it("should initialize the Express application", () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe("function");
  });

  it("should return the API welcome response", async () => {
    const response = await request(app).get("/");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      message: "Welcome to CIRQL API",
    });
  });

  it("should return 404 for an unknown API route", async () => {
    const response = await request(app).get(
      "/api/this-route-does-not-exist"
    );

    expect(response.status).toBe(404);
  });

});
