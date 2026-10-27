import "@testing-library/jest-dom";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ItemLinks } from "./item-links";

const mockAdd = jest.fn();
const mockRemove = jest.fn();
const mockQuery = {
  data: [] as Array<{
    id: string;
    title: string;
    url: string;
    createdById: string;
  }>,
  isPending: false,
  isError: false,
  isSuccess: true,
  isFetching: false,
  refetch: jest.fn(),
  add: { mutateAsync: mockAdd, isPending: false },
  remove: { mutate: mockRemove, isPending: false },
};

jest.mock("@artist/api-client", () => ({
  ApiError: class extends Error {},
  useItemLinks: () => mockQuery,
  useMe: () => ({ data: { user: { id: "me" } } }),
  usePermissions: () => ({ can: (action: string) => action === "link.add" }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockQuery.data = [];
  mockQuery.isError = false;
  mockQuery.isSuccess = true;
  mockQuery.add.isPending = false;
});
afterEach(cleanup);

function startAdding() {
  render(<ItemLinks boardId="board" kind="TASK" parentId="task" />);
  fireEvent.click(screen.getByRole("button", { name: "Add a link" }));
}

it("normalizes a pasted spreadsheet URL and closes only after saving", async () => {
  mockAdd.mockResolvedValue({ id: "link" });
  startAdding();
  expect(screen.getByLabelText("Name (optional)")).toHaveFocus();
  fireEvent.change(screen.getByLabelText("Name (optional)"), {
    target: { value: "  Band budget  " },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /URL/ }), {
    target: { value: "docs.google.com/spreadsheets/d/123#gid=12" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));
  await waitFor(() =>
    expect(mockAdd).toHaveBeenCalledWith({
      title: "Band budget",
      url: "https://docs.google.com/spreadsheets/d/123#gid=12",
    }),
  );
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Save link" }),
    ).not.toBeInTheDocument(),
  );
});

it("keeps the draft after a failed save and allows retry", async () => {
  mockAdd
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ id: "link" });
  startAdding();
  fireEvent.change(screen.getByLabelText("Name (optional)"), {
    target: { value: "Shared drive" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /URL/ }), {
    target: { value: "https://drive.google.com/drive/folders/123" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Could not save the link. Try again.",
  );
  expect(screen.getByLabelText("Name (optional)")).toHaveValue("Shared drive");
  expect(screen.getByRole("textbox", { name: /URL/ })).toHaveValue(
    "https://drive.google.com/drive/folders/123",
  );
  fireEvent.click(screen.getByRole("button", { name: "Save link" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Save link" }),
    ).not.toBeInTheDocument(),
  );
  expect(mockAdd).toHaveBeenCalledTimes(2);
});

it.each(["", "javascript:alert(1)", "not a url"])(
  "shows validation and focuses the URL for invalid input %s",
  async (url) => {
    startAdding();
    fireEvent.change(screen.getByRole("textbox", { name: /URL/ }), {
      target: { value: url },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save link" }));
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(screen.getByRole("textbox", { name: /URL/ })).toHaveFocus();
    expect(mockAdd).not.toHaveBeenCalled();
  },
);

it("opens saved links in a new tab and only offers members removal of their own links", () => {
  mockQuery.data = [
    {
      id: "mine",
      title: "Drive",
      url: "https://drive.google.com/drive/folders/123",
      createdById: "me",
    },
    {
      id: "theirs",
      title: "Setlist",
      url: "https://docs.google.com/document/d/123",
      createdById: "other",
    },
  ];
  render(<ItemLinks boardId="board" kind="EVENT" parentId="show" />);
  const link = screen.getByRole("link", { name: "Drive (opens in a new tab)" });
  expect(link).toHaveAttribute("href", mockQuery.data[0].url);
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(
    screen.getByRole("button", { name: "Remove link Drive" }),
  ).toBeVisible();
  expect(
    screen.queryByRole("button", { name: "Remove link Setlist" }),
  ).not.toBeInTheDocument();
});
