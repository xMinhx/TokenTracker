import XCTest

final class WeeklyLimitResetDetectorTests: XCTestCase {

    private let detector = WeeklyLimitResetDetector()   // defaults: high 50, drop 30, cooldown 3600

    private func reading(_ pct: Double) -> [(provider: String, windowKey: String, usedPercent: Double)] {
        [("codex", "codex.primary", pct)]
    }

    func testFirstObservationRecordsBaselineWithoutEvent() {
        let (events, snap) = detector.evaluate(readings: reading(90), snapshot: .init(), now: 1000)
        XCTAssertTrue(events.isEmpty, "first observation should never celebrate")
        XCTAssertEqual(snap.lastPercent["codex.primary"], 90)
    }

    func testHighThenResetFires() {
        let (_, baseline) = detector.evaluate(readings: reading(90), snapshot: .init(), now: 1000)
        let (events, _) = detector.evaluate(readings: reading(4), snapshot: baseline, now: 2000)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events.first?.provider, "codex")
        XCTAssertEqual(events.first?.previousPercent, 90)
    }

    func testLowUsageRolloverDoesNotFire() {
        // Was only at 20% → not "constrained", so the reset isn't worth celebrating.
        let (_, baseline) = detector.evaluate(readings: reading(20), snapshot: .init(), now: 1000)
        let (events, _) = detector.evaluate(readings: reading(0), snapshot: baseline, now: 2000)
        XCTAssertTrue(events.isEmpty)
    }

    func testSmallDropDoesNotFire() {
        // 90 → 75 is normal fluctuation, not a rollover.
        let (_, baseline) = detector.evaluate(readings: reading(90), snapshot: .init(), now: 1000)
        let (events, _) = detector.evaluate(readings: reading(75), snapshot: baseline, now: 2000)
        XCTAssertTrue(events.isEmpty)
    }

    func testCooldownSuppressesRepeat() {
        let (_, baseline) = detector.evaluate(readings: reading(90), snapshot: .init(), now: 1000)
        let (firstEvents, afterFirst) = detector.evaluate(readings: reading(2), snapshot: baseline, now: 2000)
        XCTAssertEqual(firstEvents.count, 1)

        // Climb high again and reset within the cooldown window → suppressed.
        let (_, climbed) = detector.evaluate(readings: reading(95), snapshot: afterFirst, now: 2500)
        let (repeatEvents, _) = detector.evaluate(readings: reading(1), snapshot: climbed, now: 3000)
        XCTAssertTrue(repeatEvents.isEmpty, "within cooldown the same window must not re-fire")
    }

    func testReadingsExtractionFromResponse() throws {
        // Minimal response: Codex at 80% primary, Claude errored (must be skipped).
        let json = """
        {
          "fetched_at": "2026-06-14T00:00:00Z",
          "claude": { "configured": true, "error": "boom" },
          "codex": { "configured": true, "error": null, "primary_window": { "used_percent": 80, "reset_at": 1000, "limit_window_seconds": 18000 } },
          "cursor": { "configured": false, "error": null },
          "gemini": { "configured": false, "error": null },
          "kiro": { "configured": false, "error": null },
          "antigravity": { "configured": false, "error": null }
        }
        """
        let response = try JSONDecoder().decode(UsageLimitsResponse.self, from: Data(json.utf8))
        let readings = response.limitWindowReadings()
        XCTAssertEqual(readings.count, 1)
        XCTAssertEqual(readings.first?.windowKey, "codex.primary")
        XCTAssertEqual(readings.first?.usedPercent, 80)
    }
}
