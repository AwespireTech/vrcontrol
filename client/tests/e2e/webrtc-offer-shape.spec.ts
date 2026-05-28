import { test, expect, chromium } from "@playwright/test"

// 驗證 fix 方向：addTransceiver("video", { direction: "recvonly" }) 產生的 offer
// 一定帶 m=video, a=ice-ufrag:, a=ice-pwd:。這是 fix(client) commit 的核心假設，
// 此 test 在 headless Chromium 跑 RTCPeerConnection 確認假設成立。
test("offer with explicit recvonly transceiver carries video + ICE attrs", async () => {
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.setContent("<!doctype html><html><body></body></html>")
  const sdp = await page.evaluate(async () => {
    const peer = new RTCPeerConnection()
    peer.addTransceiver("video", { direction: "recvonly" })
    const offer = await peer.createOffer()
    await peer.setLocalDescription(offer)
    return peer.localDescription?.sdp ?? ""
  })
  await browser.close()
  expect(sdp).toContain("m=video")
  expect(sdp).toMatch(/a=ice-ufrag:/)
  expect(sdp).toMatch(/a=ice-pwd:/)
})
