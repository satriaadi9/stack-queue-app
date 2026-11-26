import { expect, test, type Page } from "@playwright/test";

/**
 * A fixed house deck so every outcome is exact.
 * Slots: 1:+20  2:x2  3:+1  4:x3  5:-21  6:x5  7:x20  8:/2  9:+10  10:-5  11:x0  12:+5
 */
const SLOTS = "+20,x2,+1,x3,-21,x5,x20,/2,+10,-5,x0,+5";
const code = (extra: object = {}) =>
  Buffer.from(JSON.stringify({ v: 1, n: "E2E", m: null, s: SLOTS, p: 5, sh: 0, ...extra })).toString("base64url");
const DECK = code();
// Admin fee is the default 10% of the wager, so every round costs wager + 10%.

async function sit(page: Page, initials: string, mode: RegExp, wager = 100, deck = DECK) {
  await page.goto(`/?deck=${deck}`);
  await page.getByLabel("Your initials").fill(initials);
  await page.getByRole("button", { name: "Take a seat" }).click();
  await page.waitForURL("**/lobby");
  await page.getByRole("radio", { name: mode }).click();
  await page.getByRole("button", { name: /^Next: Clock & fee/ }).click();
  await page.getByRole("button", { name: /^Next: Wager/ }).click();
  await page.getByRole("button", { name: `Wager ${wager}`, exact: true }).click();
  await page.getByRole("button", { name: /^Next: Luck/ }).click();
  await page.getByRole("button", { name: /Deal me in/ }).click();
  await page.waitForURL("**/play");
}

const card = (page: Page, n: number) => page.getByRole("button", { name: new RegExp(`^Card ${n},`) });
const chips = (page: Page) => page.getByRole("banner").getByText(/^[\d,]+$/);

test("stack pops last-in first and pays exactly", async ({ page }) => {
  await sit(page, "STK", /The Tower/);
  for (const n of [1, 2, 3]) {
    await card(page, n).click();
    await page.waitForTimeout(500);
  }
  await page.getByRole("button", { name: /^Deal 3 cards/ }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /^Pop/ }).click();
    await page.waitForTimeout(550);
  }
  // pops +1, x2, +20 → ((100+1)*2)+20 = 222
  await expect(page.getByRole("dialog")).toContainText("Cashed out");
  await expect(chips(page)).toHaveText("1,112"); // 1000 − 100 − 10 fee + 222
  // What-if shows queue order: (100+20)*2+1 = 241
  await expect(page.getByRole("dialog")).toContainText("241");
});

test("queue dequeues first-in first", async ({ page }) => {
  await sit(page, "QUE", /The Conveyor/);
  for (const n of [1, 2, 3]) {
    await card(page, n).click();
    await page.waitForTimeout(500);
  }
  await page.getByRole("button", { name: /^Deal 3 cards/ }).click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /^Dequeue/ }).click();
    await page.waitForTimeout(550);
  }
  // +20, x2, +1 → 241
  await expect(chips(page)).toHaveText("1,131");
});

test("a bust loses the wager", async ({ page }) => {
  await sit(page, "BST", /The Tower/, 10);
  for (const n of [1, 3, 5]) {
    await card(page, n).click();
    await page.waitForTimeout(500);
  }
  await page.getByRole("button", { name: /^Deal 3 cards/ }).click();
  await page.getByRole("button", { name: /^Pop/ }).click(); // −21 on a pot of 10
  await expect(page.getByRole("dialog")).toContainText("Bust", { timeout: 5000 });
  await expect(chips(page)).toHaveText("989"); // 1000 − 10 − 1 fee
});

test("recursion returns through the frames", async ({ page }) => {
  await sit(page, "REC", /The Rabbit Hole/);
  // depth 1 offers slots 1–3; take +20 and return immediately (no overflow risk)
  await page.getByRole("button", { name: "Choose card 1" }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText(/unwinds to/)).toContainText("120");
  await page.getByRole("button", { name: /^Return/ }).click();
  await expect(page.getByRole("dialog")).toContainText("Returned", { timeout: 5000 });
  await expect(chips(page)).toHaveText("1,010");
});

test("refresh mid-round resumes the same round", async ({ page }) => {
  await sit(page, "RLD", /The Tower/);
  await card(page, 4).click();
  await page.waitForTimeout(500);
  await card(page, 7).click();
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.getByText("push(#7)")).toBeVisible();
  await expect(card(page, 4)).toHaveCount(0); // still in the stack, not back on the board
  await expect(chips(page)).toHaveText("890");
});

test("double-click cannot pop twice", async ({ page }) => {
  await sit(page, "DBL", /The Tower/);
  for (const n of [9, 12, 3]) {
    await card(page, n).click();
    await page.waitForTimeout(500);
  }
  await page.getByRole("button", { name: /^Deal 3 cards/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /^Pop/ }).dblclick();
  await page.waitForTimeout(600);
  await expect(page.getByText(/^pop\(\)$/)).toHaveCount(1);
});

test("host builds a shareable deck", async ({ page }) => {
  await page.goto("/host");
  await page.getByPlaceholder(/Data Structures/).fill("Week 6");
  await page.getByRole("button", { name: "Slot 1: random" }).click();
  await page.getByLabel("Custom operation").fill("x7");
  await page.getByRole("button", { name: /^Set/ }).click();
  await expect(page.getByRole("button", { name: /Slot 1: ×7/ })).toBeVisible();
  await expect(page.getByAltText("QR code for this deck")).toBeVisible();
  await page.getByRole("button", { name: "Play it here" }).click();
  await expect(page.getByText("House deck loaded · Week 6")).toBeVisible();
});

test("cashing out early turns the unopened cards face up", async ({ page }) => {
  await sit(page, "LFT", /The Tower/);
  for (const n of [1, 2, 3]) {
    await card(page, n).click();
    await page.waitForTimeout(500);
  }
  await page.getByRole("button", { name: /^Deal 3 cards/ }).click();
  await page.getByRole("button", { name: /^Pop/ }).click(); // +1
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Cash out 101/ }).click();
  await expect(page.getByRole("img", { name: /^Card 2: ×2/ })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Card 1: \+20/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("Left unopened");
  await expect(page.getByRole("dialog")).toContainText("222"); // (101 × 2) + 20
});

test("clocks pick cards and cash out when time runs out", async ({ page }) => {
  await sit(page, "CLK", /The Tower/, 100, code({ t: [3, 3] }));
  await expect(page.getByRole("timer")).toContainText("Pick cards");
  // Pick clock: 3 random cards get pushed and dealt.
  await expect(page.getByRole("button", { name: /^Pop/ })).toBeEnabled({ timeout: 6000 });
  await expect(page.getByText(/picked #\d+, #\d+, #\d+ for you/)).toBeVisible();
  // Open clock: cash out at the untouched pot of 100.
  await expect(page.getByRole("dialog")).toContainText("The clock ran out", { timeout: 8000 });
  await expect(chips(page)).toHaveText("990"); // 1000 − 110 + 100
});

test("surprise me draws a table at random", async ({ page }) => {
  await sit(page, "RND", /Surprise me/);
  await expect(page.getByText("Drawn at random")).toBeVisible();
});

test("the wager can be typed and respects the fee", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your initials").fill("TYP");
  await page.getByRole("button", { name: "Take a seat" }).click();
  await page.waitForURL("**/lobby");
  await expect(page.getByRole("heading", { name: "Choose your table" })).toBeVisible();
  await expect(page.getByLabel("Or type your own amount")).toHaveCount(0); // one step at a time
  await page.getByRole("button", { name: /^Next: Clock & fee/ }).click();
  await expect(page.getByRole("heading", { name: "Clock" })).toBeVisible();
  await page.getByRole("button", { name: /^Next: Wager/ }).click();
  const input = page.getByLabel("Or type your own amount");
  await input.fill("1000");
  await expect(page.getByText("the most you can wager is 909")).toBeVisible();
  await input.fill("137");
  await expect(page.getByText("137 wager + 14 admin fee")).toBeVisible();
  await page.getByRole("button", { name: /^Next: Luck/ }).click();
  await expect(page.getByRole("button", { name: "Deal me in · 151" })).toBeEnabled();
  await expect(page.getByRole("complementary", { name: "Round summary" })).toContainText("151"); // you pay
  // Completed steps stay reachable from the progress bar.
  await page.getByRole("navigation", { name: "Progress" }).getByRole("button", { name: /Table/ }).click();
  await expect(page.getByRole("heading", { name: "Choose your table" })).toBeVisible();
});


test("new players can start with custom chips", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/New players start with\s*1,000\s*chips/)).toBeVisible();
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("radio", { name: /^5,000/ }).click();
  await expect(page.getByText(/New players start with\s*5,000\s*chips/)).toBeVisible();
  await page.getByRole("radio", { name: "Custom" }).click();
  await page.getByLabel("Chips for each new player").fill("5");
  await expect(page.getByLabel("Chips for each new player")).toHaveAttribute("aria-invalid", "true"); // below 10
  await page.getByLabel("Chips for each new player").fill("1234");
  await page.getByLabel("Your initials").fill("CUS");
  await page.getByRole("button", { name: "Take a seat" }).click();
  await page.waitForURL("**/lobby");
  await expect(chips(page)).toHaveText("1,234");
});

test("all players can be reset from home", async ({ page }) => {
  for (const who of ["ONE", "TWO"]) {
    await page.goto("/");
    await page.getByLabel("Your initials").fill(who);
    await page.getByRole("button", { name: "Take a seat" }).click();
    await page.waitForURL("**/lobby");
  }
  await page.goto("/");
  const regulars = page.getByRole("region", { name: "Regulars on this device" });
  await expect(regulars.getByRole("button", { name: /^ONE/ })).toBeVisible();
  await page.getByRole("button", { name: "Reset all players" }).click();
  await page.getByRole("button", { name: "Keep them" }).click();
  await expect(regulars.getByRole("button", { name: /^TWO/ })).toBeVisible();
  await page.getByRole("button", { name: "Reset all players" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("Delete all 2 players");
  await page.getByRole("button", { name: "Delete everyone" }).click();
  await expect(page.getByText("Regulars on this device")).toHaveCount(0);
  await page.goto("/regulars");
  await expect(page.getByText(/Nobody.s played here yet/)).toBeVisible();
});

test("a luck charm is paid up front and shown on the table", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Your initials").fill("LUK");
  await page.getByRole("button", { name: "Take a seat" }).click();
  await page.waitForURL("**/lobby");
  await page.getByRole("radio", { name: /The Tower/ }).click();
  await page.getByRole("button", { name: /^Next: Clock & fee/ }).click();
  await page.getByRole("button", { name: /^Next: Wager/ }).click();
  await page.getByRole("button", { name: "Wager 100", exact: true }).click();
  await page.getByRole("button", { name: /^Next: Luck/ }).click();
  await expect(page.getByRole("radio", { name: /^No charm/ })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: /^Gold charm/ }).click();
  await expect(page.getByRole("complementary", { name: "Round summary" })).toContainText("Gold charm");
  await page.getByRole("button", { name: "Deal me in · 150" }).click();
  await page.waitForURL("**/play");
  await expect(page.getByText(/Gold charm ·/)).toBeVisible();
  await expect(chips(page)).toHaveText("850"); // 1000 − 100 − 10 fee − 40 charm
});

test("a fully set house deck has no luck to buy", async ({ page }) => {
  await page.goto(`/?deck=${DECK}`);
  await page.getByLabel("Your initials").fill("NOL");
  await page.getByRole("button", { name: "Take a seat" }).click();
  await page.waitForURL("**/lobby");
  await page.getByRole("button", { name: /^Next: Clock & fee/ }).click();
  await page.getByRole("button", { name: /^Next: Wager/ }).click();
  await page.getByRole("button", { name: /^Next: Luck/ }).click();
  await expect(page.getByText(/no luck to buy/)).toBeVisible();
  await expect(page.getByRole("radio", { name: /Gold charm/ })).toHaveCount(0);
});

test("the host deck link sets the starting chips", async ({ page }) => {
  await page.goto("/host");
  await page.getByRole("radiogroup", { name: "Starting chips" }).getByRole("radio", { name: "2,500" }).click();
  await page.getByRole("button", { name: "Play it here" }).click();
  await expect(page.getByText(/New players start with\s*2,500\s*chips/)).toBeVisible();
  await expect(page.getByText(/set by the house deck/)).toBeVisible();
  await page.getByLabel("Your initials").fill("HST");
  await page.getByRole("button", { name: "Take a seat" }).click();
  await page.waitForURL("**/lobby");
  await expect(chips(page)).toHaveText("2,500");
});

test("the table explains what each card colour means", async ({ page }) => {
  await sit(page, "CLR", /The Tower/);
  const legend = page.getByRole("group", { name: "Card colours" });
  await legend.getByRole("button", { name: /Teal/ }).click();
  await expect(page.getByRole("tooltip")).toContainText("Rare");
  await expect(page.getByRole("tooltip")).toContainText("×1.4");
  await legend.getByRole("button", { name: /Gold/ }).click();
  await expect(page.getByRole("tooltip")).toContainText("shot at ×3");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(card(page, 1)).toHaveAttribute("title", /back: /);
});
