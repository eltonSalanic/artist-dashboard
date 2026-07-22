import {
  applyMention,
  collectMentionIds,
  findMentionQuery,
  linkifyMentions,
  matchMembers,
  MENTION_HREF,
} from "./mentions";

const members = [
  { id: "u1", displayName: "sam" },
  { id: "u2", displayName: "sam.jones" },
  { id: "u3", displayName: "alex" },
];

describe("findMentionQuery", () => {
  it("detects a mention token at the caret", () => {
    const text = "hey @sa";
    expect(findMentionQuery(text, text.length)).toEqual({
      start: 4,
      query: "sa",
    });
  });

  it("returns the empty query right after the @", () => {
    const text = "ping @";
    expect(findMentionQuery(text, text.length)).toEqual({
      start: 5,
      query: "",
    });
  });

  it("ignores an @ glued to a preceding word (an email)", () => {
    const text = "mail me at sam@band.com";
    expect(findMentionQuery(text, text.length)).toBeNull();
  });

  it("stops at whitespace before the caret", () => {
    const text = "@sam and then";
    expect(findMentionQuery(text, text.length)).toBeNull();
  });
});

describe("matchMembers", () => {
  it("prefix-matches case-insensitively", () => {
    expect(matchMembers(members, "sa").map((m) => m.id)).toEqual(["u1", "u2"]);
  });

  it("returns nothing when no name starts with the query", () => {
    expect(matchMembers(members, "zzz")).toEqual([]);
  });
});

describe("applyMention", () => {
  it("replaces the token and moves the caret past the inserted name", () => {
    const text = "hey @sa";
    const result = applyMention(text, 4, text.length, "sam");
    expect(result.text).toBe("hey @sam ");
    expect(result.caret).toBe("hey @sam ".length);
  });
});

describe("collectMentionIds", () => {
  it("collects ids for names actually present in the body", () => {
    expect(collectMentionIds("yo @sam and @alex", members).sort()).toEqual([
      "u1",
      "u3",
    ]);
  });

  it("prefers the longest matching name so @sam.jones wins over @sam", () => {
    expect(collectMentionIds("cc @sam.jones", members)).toEqual(["u2"]);
  });

  it("de-duplicates a name mentioned twice", () => {
    expect(collectMentionIds("@sam @sam", members)).toEqual(["u1"]);
  });

  it("does not treat an email as a mention", () => {
    expect(collectMentionIds("write sam@band.com", members)).toEqual([]);
  });
});

describe("linkifyMentions", () => {
  it("rewrites a mention into a mention-href markdown link", () => {
    expect(linkifyMentions("hi @sam", members)).toBe(
      `hi [@sam](${MENTION_HREF}u1)`,
    );
  });

  it("leaves ordinary text untouched", () => {
    expect(linkifyMentions("no mentions here", members)).toBe(
      "no mentions here",
    );
  });
});
