const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const expectedRenderer = process.env.NATIONLAB_RENDERER || "webgl";
  const browser = await chromium.launch({
    ...(fs.existsSync("/usr/bin/chromium")
      ? { executablePath: "/usr/bin/chromium" }
      : {}),
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader", ...(expectedRenderer === "2d" ? ["--disable-webgl"] : [])],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const room = () =>
    page.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            "nationlab-room-" +
              (() => {const s = JSON.parse(localStorage.getItem("nationlab-session")); return (s.serverId ? s.serverId + "--" : "") + s.code;})(),
          ),
        ).state,
    );
  async function tile(x, y) {
    await page.locator(".island-canvas").first().scrollIntoViewIfNeeded();
    const canvas = page.locator(".island-canvas").first();
    await page.waitForFunction(() => !!document.querySelector(".island-canvas")?.getAttribute("data-tile-centers"));
    const centers = JSON.parse(await canvas.getAttribute("data-tile-centers"));
    const point = centers[`${x},${y}`];
    assert.ok(point, `projected tile ${x},${y} exists`);
    const r = await canvas.boundingBox();
    await page.mouse.click(r.x + r.width * point[0], r.y + r.height * point[1]);
  }
  async function choose(id) {
    await page.getByLabel("체험 역할").selectOption("demo-" + id);
    if (await page.getByRole("button", {name: "메뉴 · 지도", exact:true}).count()) await page.getByRole("button", {name:"메뉴 · 지도",exact:true}).click();
    await page.getByRole("button", { name: "우리 섬", exact: true }).click();
  }
  try {
    await page.goto(process.env.NATIONLAB_URL || "http://127.0.0.1:3000/?legacy=1");
    await page
      .getByRole("button", { name: "혼자 체험하기", exact: true })
      .click();
    await page.locator(".big-code").waitFor();
    assert.match(await page.locator(".big-code").innerText(), /^\d{4}$/);
    await page.getByRole("button", { name: "1라운드 회의 시작" }).click();
    await page.getByRole("button", { name: "활동 시작", exact: true }).click();
    await choose("hualian");
    await page.waitForFunction((renderer) => document.querySelector(".island-canvas")?.getAttribute("data-renderer") === renderer, expectedRenderer);
    const w = await room();
    const node = Object.values(w.countries.hualian.nodes).find(
      (n) => n.good === "iron",
    );
    await tile(node.x, node.y);
    // One resource tap walks to it and harvests without a second action button.
    await page.waitForFunction((id) => {
      const session = JSON.parse(localStorage.getItem("nationlab-session"));
      const w = JSON.parse(
        localStorage.getItem("nationlab-room-" + (session.serverId ? session.serverId + "--" : "") + session.code),
      ).state;
      return !w.countries.hualian.nodes[id];
    }, node.id);
    assert.equal((await room()).players["demo-hualian"].stamina, 14);
    const stones = Object.values((await room()).countries.hualian.nodes)
      .filter((n) => n.good === "stone")
      .slice(0, 2);
    for (const stone of stones) {
      await tile(stone.x, stone.y);
      await page.waitForFunction((id) => {
        const s = JSON.parse(localStorage.getItem("nationlab-session"));
        return !JSON.parse(localStorage.getItem("nationlab-room-" + (s.serverId ? s.serverId + "--" : "") + s.code))
          .state.countries.hualian.nodes[id];
      }, stone.id);
    }
    const bench = (await room()).countries.hualian.facilities.bench;
    await tile(bench.x, bench.y);
    await page
      .locator(".recipe-card")
      .filter({ has: page.getByText("벽돌 1개", { exact: true }) })
      .getByRole("button", { name: "만들기", exact: true })
      .click();
    const site = Object.values((await room()).countries.hualian.sites).find(
      (s) => s.good === "brick",
    );
    await tile(site.x, site.y);
    await page.getByRole("button", { name: "벽돌 놓기", exact: true }).click();
    await page.waitForFunction((id) => {
      const s = JSON.parse(localStorage.getItem("nationlab-session"));
      return !!JSON.parse(localStorage.getItem("nationlab-room-" + (s.serverId ? s.serverId + "--" : "") + s.code)).state.countries.hualian.sites[id].unit;
    }, site.id);
    assert.ok((await room()).countries.hualian.sites[site.id].unit);
    assert.equal(
      (await room()).countries.hualian.sites[site.id].unit.sources.hualian
        .stone,
      2,
    );

    await page.getByRole("button", { name: "조합", exact: true }).click();
    await page
      .getByText("용광로가 있는 나라: 히노미", { exact: false })
      .waitFor();
    await page.getByRole("button", { name: "교역", exact: true }).click();
    await page
      .getByText(
        "1라운드는 국경이 닫혀 있어요. 2라운드부터 교역할 수 있어요.",
        { exact: true },
      )
      .waitFor();
    await page.getByRole("button", { name: "교사 화면", exact: true }).click();
    await page.getByRole("button", { name: "정산으로 넘어가기" }).click();
    await choose("hualian");
    await page
      .getByRole("textbox", {
        name: "다른 나라와 교류할 수 없어서 어떤 점이 불편했나요?",
      })
      .fill("석유와 용광로가 없어서 철판을 만들 수 없었어요.");
    await page.getByRole("button", { name: "성찰 제출", exact: true }).click();
    await page.getByRole("button", { name: "교사 화면", exact: true }).click();
    await page.getByRole("button", { name: "2라운드 회의 시작" }).click();
    await page.waitForFunction(() => {
      const s = JSON.parse(localStorage.getItem("nationlab-session"));
      return JSON.parse(localStorage.getItem("nationlab-room-" + (s.serverId ? s.serverId + "--" : "") + s.code)).state.round === 2;
    });
    let second = await room();
    assert.equal(second.players["demo-hualian"].stamina, 15);
    assert.equal(second.players["demo-sahar"].stamina, 0);
    await page.getByRole("button", { name: "활동 시작", exact: true }).click();
    await choose("hualian");
    await tile(17, 9);
    await page.getByLabel("우리가 줄 것 품목").selectOption("iron");
    await page.getByLabel("우리가 줄 것 수량").fill("1");
    await page.getByLabel("받고 싶은 것 G").fill("1");
    await page
      .getByRole("button", { name: "교역 제안 보내기", exact: true })
      .click();
    await page.getByRole("button", { name: "동의", exact: true }).click();
    await choose("sahar");
    await page.getByRole("button", { name: "교역", exact: true }).click();
    await page.getByRole("button", { name: "동의", exact: true }).click();
    await page.getByText("체결", { exact: true }).waitFor();
    second = await room();
    assert.equal(second.countries.sahar.stock.iron.length, 1);
    assert.equal(second.countries.hualian.stock.iron.length, 0);
    assert.equal(second.trades.length, 1);
    await page.reload();
    await page.getByLabel("체험 역할").waitFor();
    assert.equal((await room()).trades.length, 1);
    await choose("hualian");
    await page
      .getByRole("button", { name: "원산지 보기", exact: true })
      .click();
    await page.locator(".map-card").screenshot({
      path: `/workspace/onboarding/nationlab-island-${expectedRenderer}.png`,
    });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.screenshot({
      path: `/workspace/onboarding/nationlab-tablet-${expectedRenderer}.png`,
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    const small = await page
      .locator("button:visible")
      .evaluateAll((buttons) =>
        buttons
          .filter((b) => !b.disabled && b.getBoundingClientRect().height < 43.5)
          .map((b) => b.textContent),
      );
    assert.deepEqual(small, []);
    await page.getByRole("button", { name: "세계 지도", exact: true }).click();
    assert.equal(await page.locator(".world-island-card").count(), 3);
    await page.waitForFunction((renderer) => document.querySelectorAll(`.world-island-card canvas[data-renderer="${renderer}"]`).length === 3, expectedRenderer);
    await page.locator(".world-grid").screenshot({path: `/workspace/onboarding/nationlab-world-${expectedRenderer}.png`});
    await page.getByRole("button", { name: "교사 화면", exact: true }).click();
    const code = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("nationlab-session")); return (s.serverId ? s.serverId + "--" : "") + s.code; });
    await page
      .getByRole("button", { name: "방 데이터 삭제", exact: false })
      .click();
    await page.getByRole("button", { name: "확인", exact: true }).click();
    await page.waitForFunction((c) => localStorage.getItem("nationlab-room-" + c) === null, code);
    assert.equal(
      await page.evaluate(
        (c) => localStorage.getItem("nationlab-room-" + c),
        code,
      ),
      null,
    );
    await page
      .getByRole("button", { name: "혼자 체험하기", exact: true })
      .waitFor();
    assert.deepEqual(errors, []);
    console.log(
      `PASS (${expectedRenderer}): teacher setup, weighted demo teams, projected map picking, automatic harvesting, crafting, construction provenance, stamina, facility locks, closed border, reflection refill, majority trade, refresh recovery, world map, 44px buttons, tablet layout and room deletion; no page errors.`,
    );
  } catch (e) {
    await page.screenshot({
      path: "/workspace/onboarding/nationlab-browser-failure.png",
      fullPage: true,
    });
    console.error(
      "PAGE:",
      (await page.locator("body").innerText()).slice(-5000),
    );
    throw e;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
