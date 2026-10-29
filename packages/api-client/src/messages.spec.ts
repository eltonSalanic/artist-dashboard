import { ApiError, NetworkError } from "./client";
import {
  MESSAGES,
  authErrorMessage,
  isNotFound,
  isReportedByServer,
  isUnexpectedError,
  toUserMessage,
} from "./messages";

describe("toUserMessage", () => {
  it("says offline for a network failure", () => {
    expect(toUserMessage(new NetworkError(new TypeError("x")))).toBe(
      MESSAGES.offline,
    );
  });

  it("shows the first validation issue with its field", () => {
    const error = new ApiError(400, "Validation failed", {
      issues: [{ path: "items.0.dueDate", message: "Invalid date" }],
    });
    expect(toUserMessage(error)).toBe("Due date: Invalid date");
  });

  it("keeps a specific server message", () => {
    expect(
      toUserMessage(new ApiError(409, "That person is already a board member")),
    ).toBe("That person is already a board member");
  });

  it("replaces server faults and Nest defaults with plain copy", () => {
    expect(toUserMessage(new ApiError(500, "Internal server error"))).toBe(
      MESSAGES.server,
    );
    expect(toUserMessage(new ApiError(401, "Unauthorized"))).toBe(
      MESSAGES.sessionExpired,
    );
    expect(toUserMessage(new ApiError(403, "Forbidden resource"))).toBe(
      MESSAGES.forbidden,
    );
    expect(toUserMessage(new ApiError(404, "Cannot GET /x"))).toBe(
      MESSAGES.notFound,
    );
    expect(toUserMessage(new ApiError(429, "ThrottlerException"))).toBe(
      MESSAGES.rateLimited,
    );
  });

  it("trusts a message the API coded itself, even on a 5xx", () => {
    const error = new ApiError(502, "Couldn't send the invite email.", {
      code: "INVITE_EMAIL_FAILED",
    });
    expect(toUserMessage(error)).toBe("Couldn't send the invite email.");
  });

  it("uses the caller fallback for anything else", () => {
    expect(toUserMessage(new Error("boom"), "Upload failed")).toBe(
      "Upload failed",
    );
    expect(toUserMessage("weird")).toBe(MESSAGES.generic);
  });
});

describe("error classification", () => {
  it('only a 404 is "not found"', () => {
    expect(isNotFound(new ApiError(404, "x"))).toBe(true);
    expect(isNotFound(new ApiError(500, "x"))).toBe(false);
    expect(isNotFound(new NetworkError(null))).toBe(false);
  });

  it("reports bugs and server faults, not user or network errors", () => {
    expect(isUnexpectedError(new Error("bug"))).toBe(true);
    expect(isUnexpectedError(new ApiError(503, "x"))).toBe(true);
    expect(isUnexpectedError(new ApiError(400, "x"))).toBe(false);
    expect(isUnexpectedError(new NetworkError(null))).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("maps known Better Auth codes", () => {
    expect(
      authErrorMessage({
        code: "INVALID_EMAIL_OR_PASSWORD",
        status: 401,
        message: "Invalid email or password",
      }),
    ).toBe("That email and password don't match. Try again.");
  });

  it("explains a failed invite code", () => {
    expect(
      authErrorMessage({ code: "INVALID_OTP", status: 400, message: "Invalid OTP" }),
    ).toMatch(/^That code doesn't work/);
  });

  it("passes on the API's own wording for a refused account change", () => {
    expect(
      authErrorMessage({
        code: "AUTH_REJECTED",
        status: 400,
        message: "You already have a password. Sign in with it.",
      }),
    ).toBe("You already have a password. Sign in with it.");
  });

  it("treats an unreachable server as offline", () => {
    expect(authErrorMessage({ status: 0, message: "fetch failed" })).toBe(
      MESSAGES.offline,
    );
  });

  it("never shows the raw text for an unknown error", () => {
    expect(authErrorMessage({ message: "raw thing" }, "Sign in failed")).toBe(
      "Sign in failed",
    );
  });
});
