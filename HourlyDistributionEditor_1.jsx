import { useState, useMemo, useRef, useCallback } from "react";
import { RotateCcw, Moon, Briefcase, ShoppingBag, Copy, Link2, Link2Off } from "lucide-react";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function hourLabel(h) {
  const period = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}${period}`;
}

const PRESETS = {
  flat: { label: "Flat", icon: null, values: HOURS.map(() => 1) },
  office: {
    label: "9-to-5",
    icon: Briefcase,
    values: [0,0,0,0,0,1,3,8,14,10,8,9,10,9,8,10,12,9,5,2,1,0,0,0],
  },
  retail: {
    label: "Retail",
    icon: ShoppingBag,
    values: [0,0,0,0,0,0,1,2,4,7,9,11,12,12,11,12,13,12,10,7,4,2,1,0],
  },
  overnight: {
    label: "Overnight",
    icon: Moon,
    values: [10,9,8,7,6,4,3,2,2,3,4,5,5,5,5,5,5,6,7,8,9,10,11,11],
  },
};

function normalizeToSum(values, targetSum) {
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return values.map(() => targetSum / values.length);
  return values.map((v) => (v / sum) * targetSum);
}

export default function HourlyDistributionEditor() {
  const [mode, setMode] = useState("sessions"); // "sessions" | "proportion"
  const [linked, setLinked] = useState(true); // same curve every day
  const [activeDay, setActiveDay] = useState("Mon");
  const [ghostDay, setGhostDay] = useState(null); // day to show as faint overlay
  const [copySource, setCopySource] = useState("");
  const [dayValues, setDayValues] = useState(() => {
    const init = {};
    DAYS.forEach((d) => {
      init[d] = PRESETS.office.values.slice();
    });
    return init;
  });
  const [dragging, setDragging] = useState(false);
  const [editingHour, setEditingHour] = useState(null);
  const [editingText, setEditingText] = useState("");
  const trackRef = useRef(null);
  const dragIndexRef = useRef(null);

  const values = dayValues[activeDay];

  // setter that respects "linked" mode — writes to all days if linked, else just active day
  function setValues(updater) {
    setDayValues((prev) => {
      const newActiveValues =
        typeof updater === "function" ? updater(prev[activeDay]) : updater;
      if (linked) {
        const next = {};
        DAYS.forEach((d) => (next[d] = newActiveValues.slice()));
        return next;
      }
      return { ...prev, [activeDay]: newActiveValues };
    });
  }

  function toggleLinked() {
    if (!linked) {
      // turning linking back on: snapshot the active day's curve onto every day
      const snapshot = dayValues[activeDay].slice();
      const next = {};
      DAYS.forEach((d) => (next[d] = snapshot.slice()));
      setDayValues(next);
    }
    setLinked((l) => !l);
  }

  function copyDayInto(sourceDay, targetDay) {
    setDayValues((prev) => ({ ...prev, [targetDay]: prev[sourceDay].slice() }));
  }

  const total = useMemo(() => values.reduce((a, b) => a + b, 0), [values]);
  const max = useMemo(() => Math.max(...values, mode === "proportion" ? 1 : 1), [values, mode]);

  const ghostValues = ghostDay && dayValues[ghostDay] ? dayValues[ghostDay] : null;
  const ghostTotal = ghostValues ? ghostValues.reduce((a, b) => a + b, 0) : 0;
  const ghostDisplay = useMemo(() => {
    if (!ghostValues) return null;
    if (mode === "proportion") {
      if (ghostTotal === 0) return ghostValues.map(() => 0);
      return ghostValues.map((v) => (v / ghostTotal) * 100);
    }
    return ghostValues;
  }, [ghostValues, mode, ghostTotal]);

  const displayValues = useMemo(() => {
    if (mode === "proportion") {
      if (total === 0) return values.map(() => 0);
      return values.map((v) => (v / total) * 100);
    }
    return values;
  }, [values, mode, total]);

  const proportionOk = mode !== "proportion" || Math.abs(total - 100 * (total === 0 ? 0 : 1)) < 0.01 || true;

  function switchMode(next) {
    if (next === mode) return;
    if (next === "proportion") {
      // convert current session counts to proportions (percent), keep relative shape
      const sum = values.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        setValues(values.map((v) => (v / sum) * 100));
      }
    } else {
      // proportion -> sessions: ask nothing, just treat percentages as a weight
      // keep numbers as-is; user can rescale via "Set total"
    }
    setMode(next);
  }

  function setHourValue(i, raw) {
    const v = Math.max(0, isNaN(parseFloat(raw)) ? 0 : parseFloat(raw));
    setValues((prev) => {
      const next = prev.slice();
      next[i] = v;
      return next;
    });
  }

  function applyPreset(key) {
    const preset = PRESETS[key];
    if (mode === "proportion") {
      const sum = preset.values.reduce((a, b) => a + b, 0);
      setValues(preset.values.map((v) => (v / sum) * 100));
    } else {
      setValues(preset.values.slice());
    }
  }

  function resetFlat() {
    if (mode === "proportion") {
      setValues(HOURS.map(() => 100 / 24));
    } else {
      setValues(HOURS.map(() => 0));
    }
  }

  function normalizeProportions() {
    setValues((prev) => normalizeToSum(prev, 100));
  }

  // dragging logic for bars
  const handlePointer = useCallback(
    (clientX, clientY) => {
      if (!trackRef.current || dragIndexRef.current === null) return;
      const track = trackRef.current;
      const rect = track.children[dragIndexRef.current]?.getBoundingClientRect();
      const colWrap = track.children[dragIndexRef.current];
      if (!colWrap) return;
      const wrapRect = colWrap.getBoundingClientRect();
      const barAreaHeight = wrapRect.height;
      const fromBottom = wrapRect.bottom - clientY;
      const ratio = Math.min(1, Math.max(0, fromBottom / barAreaHeight));
      const scaleMax = mode === "proportion" ? Math.max(max, 20) : Math.max(max, 5);
      const newVal = ratio * scaleMax;
      setHourValue(dragIndexRef.current, newVal.toFixed(mode === "proportion" ? 2 : 0));
    },
    [max, mode]
  );

  function startDrag(i, e) {
    dragIndexRef.current = i;
    setDragging(true);
    handlePointer(e.clientX, e.clientY);
  }

  function onMouseMove(e) {
    if (!dragging) return;
    handlePointer(e.clientX, e.clientY);
  }
  function endDrag() {
    setDragging(false);
    dragIndexRef.current = null;
  }

  const sumLabel =
    mode === "proportion"
      ? `${total.toFixed(1)}%`
      : `${Math.round(total).toLocaleString()} sessions`;

  const sumOk = mode === "proportion" ? Math.abs(total - 100) < 0.5 : true;

  return (
    <div
      style={{
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        background: "#fafaf9",
        border: "1px solid #e7e5e4",
        borderRadius: 16,
        padding: 24,
        maxWidth: 880,
        margin: "0 auto",
        color: "#1c1917",
        userSelect: dragging ? "none" : "auto",
      }}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: -0.2 }}>
            Hourly distribution
          </div>
          <div style={{ fontSize: 13, color: "#78716c", marginTop: 2 }}>
            Drag bars or edit numbers for each hour
          </div>
        </div>

        {/* mode toggle */}
        <div
          style={{
            display: "flex",
            background: "#f1f0ef",
            borderRadius: 10,
            padding: 3,
            border: "1px solid #e7e5e4",
          }}
        >
          {["sessions", "proportion"].map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "7px 14px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: mode === m ? "#1c1917" : "transparent",
                color: mode === m ? "#fafaf9" : "#57534e",
                transition: "all 120ms ease",
              }}
            >
              {m === "sessions" ? "Sessions" : "Proportion (%)"}
            </button>
          ))}
        </div>
      </div>

      {/* Day tabs + linking */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setActiveDay(d)}
              style={{
                border: "1px solid",
                borderColor: activeDay === d ? "#1c1917" : "#e7e5e4",
                background: activeDay === d ? "#1c1917" : "#fff",
                color: activeDay === d ? "#fafaf9" : "#57534e",
                fontSize: 12.5,
                fontWeight: 600,
                padding: "6px 11px",
                borderRadius: 8,
                cursor: "pointer",
                opacity: linked && activeDay !== d ? 0.5 : 1,
              }}
              disabled={false}
            >
              {d}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {!linked && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#78716c" }}>Copy from</span>
              <select
                value={copySource}
                onChange={(e) => {
                  const src = e.target.value;
                  setCopySource(src);
                  if (src) {
                    copyDayInto(src, activeDay);
                    setCopySource("");
                  }
                }}
                onMouseDown={() => {}}
                style={{
                  fontSize: 12,
                  padding: "5px 6px",
                  borderRadius: 6,
                  border: "1px solid #e7e5e4",
                  background: "#fff",
                  color: "#44403c",
                }}
              >
                <option value="">choose day…</option>
                {DAYS.filter((d) => d !== activeDay).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <button
                title="Preview another day as a faint overlay"
                onClick={() =>
                  setGhostDay((g) =>
                    g ? null : DAYS.find((d) => d !== activeDay) || null
                  )
                }
                style={{
                  fontSize: 11.5,
                  padding: "5px 9px",
                  borderRadius: 6,
                  border: "1px solid #e7e5e4",
                  background: ghostDay ? "#f1f0ef" : "#fff",
                  color: "#57534e",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Copy size={11} />
                {ghostDay ? `Comparing: ${ghostDay}` : "Compare"}
              </button>
              {ghostDay && (
                <select
                  value={ghostDay}
                  onChange={(e) => setGhostDay(e.target.value)}
                  style={{
                    fontSize: 12,
                    padding: "5px 6px",
                    borderRadius: 6,
                    border: "1px solid #e7e5e4",
                    background: "#fff",
                    color: "#44403c",
                  }}
                >
                  {DAYS.filter((d) => d !== activeDay).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <button
            onClick={toggleLinked}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              fontWeight: 600,
              padding: "7px 12px",
              borderRadius: 8,
              border: "1px solid",
              borderColor: linked ? "#1c1917" : "#e7e5e4",
              background: linked ? "#1c1917" : "#fff",
              color: linked ? "#fafaf9" : "#57534e",
              cursor: "pointer",
            }}
          >
            {linked ? <Link2 size={13} /> : <Link2Off size={13} />}
            {linked ? "Same every day" : "Customized by day"}
          </button>
        </div>
      </div>

      {/* Presets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {Object.entries(PRESETS)
          .filter(([k]) => k !== "flat")
          .map(([key, p]) => {
            const Icon = p.icon;
            return (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12.5,
                  fontWeight: 500,
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid #e7e5e4",
                  background: "#fff",
                  color: "#44403c",
                  cursor: "pointer",
                }}
              >
                {Icon && <Icon size={13} />}
                {p.label}
              </button>
            );
          })}
        <button
          onClick={resetFlat}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12.5,
            fontWeight: 500,
            padding: "6px 12px",
            borderRadius: 999,
            border: "1px solid #e7e5e4",
            background: "#fff",
            color: "#44403c",
            cursor: "pointer",
          }}
        >
          <RotateCcw size={13} />
          Reset
        </button>
        {mode === "proportion" && (
          <button
            onClick={normalizeProportions}
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              padding: "6px 12px",
              borderRadius: 999,
              border: "1px solid #1c1917",
              background: "#1c1917",
              color: "#fafaf9",
              cursor: "pointer",
              marginLeft: "auto",
            }}
          >
            Normalize to 100%
          </button>
        )}
      </div>

      {/* Chart */}
      <div
        ref={trackRef}
        style={{
          display: "flex",
          alignItems: "flex-end",
          height: 180,
          gap: 3,
          padding: "0 2px",
          marginBottom: 8,
          background:
            "repeating-linear-gradient(to top, transparent, transparent 44px, #eeece9 44px, #eeece9 45px)",
        }}
      >
        {HOURS.map((h) => {
          const v = displayValues[h];
          const scaleMax =
            mode === "proportion" ? Math.max(max * (100 / (total || 1)), 8) : Math.max(max, 5);
          const pct = scaleMax > 0 ? Math.min(100, (v / scaleMax) * 100) : 0;
          const isPeak = v === Math.max(...displayValues) && v > 0;
          const ghostV = ghostDisplay ? ghostDisplay[h] : null;
          const ghostPct =
            ghostV != null && scaleMax > 0 ? Math.min(100, (ghostV / scaleMax) * 100) : 0;
          return (
            <div
              key={h}
              style={{
                flex: 1,
                height: "100%",
                display: "flex",
                alignItems: "flex-end",
                position: "relative",
                cursor: "ns-resize",
              }}
              onMouseDown={(e) => startDrag(h, e)}
              title={`${hourLabel(h)}: ${
                mode === "proportion" ? v.toFixed(1) + "%" : Math.round(v)
              }`}
            >
              {ghostDisplay && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 1,
                    right: 1,
                    height: `${ghostPct}%`,
                    borderRadius: "3px 3px 0 0",
                    border: "1.5px dashed #a8a29e",
                    background: "transparent",
                    pointerEvents: "none",
                  }}
                />
              )}
              <div
                style={{
                  width: "100%",
                  height: `${pct}%`,
                  minHeight: v > 0 ? 2 : 0,
                  borderRadius: "3px 3px 0 0",
                  background: isPeak
                    ? "#ea580c"
                    : "linear-gradient(to top, #44403c, #78716c)",
                  transition: dragging ? "none" : "height 150ms ease",
                  position: "relative",
                  zIndex: 1,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* hour labels */}
      <div style={{ display: "flex", gap: 3, padding: "0 2px", marginBottom: 18 }}>
        {HOURS.map((h) => (
          <div
            key={h}
            style={{
              flex: 1,
              textAlign: "center",
              fontSize: 9.5,
              color: "#a8a29e",
              fontWeight: 500,
            }}
          >
            {h % 3 === 0 ? hourLabel(h) : ""}
          </div>
        ))}
      </div>

      {/* numeric inputs grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: 6,
          marginBottom: 20,
        }}
      >
        {HOURS.map((h) => (
          <div key={h} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <label style={{ fontSize: 9.5, color: "#a8a29e", textAlign: "center" }}>
              {hourLabel(h)}
            </label>
            <input
              type="number"
              min={0}
              step={mode === "proportion" ? 0.1 : 1}
              value={
                editingHour === h
                  ? editingText
                  : mode === "proportion"
                  ? Number(displayValues[h].toFixed(1))
                  : Math.round(values[h])
              }
              onFocus={() => {
                setEditingHour(h);
                setEditingText(
                  String(mode === "proportion" ? displayValues[h].toFixed(1) : values[h])
                );
              }}
              onChange={(e) => setEditingText(e.target.value)}
              onBlur={() => {
                if (mode === "proportion") {
                  // editing percentage directly: rescale all values so this hour matches typed %, keep others' relative shape
                  const typed = Math.max(0, parseFloat(editingText) || 0);
                  setValues((prev) => {
                    const sum = prev.reduce((a, b) => a + b, 0);
                    const others = sum - prev[h];
                    const remainingPct = 100 - typed;
                    const next = prev.slice();
                    if (others > 0 && remainingPct >= 0) {
                      const scale = remainingPct / 100 / (others / sum);
                      for (let i = 0; i < 24; i++) {
                        if (i === h) continue;
                        next[i] = prev[i] * scale * (sum / sum); // proportional rescale
                      }
                      next[h] = (typed / 100) * sum;
                    } else {
                      next[h] = typed;
                    }
                    return next;
                  });
                } else {
                  setHourValue(h, editingText);
                }
                setEditingHour(null);
              }}
              style={{
                width: "100%",
                fontSize: 11.5,
                padding: "4px 2px",
                textAlign: "center",
                border: "1px solid #e7e5e4",
                borderRadius: 6,
                outline: "none",
                background: "#fff",
              }}
            />
          </div>
        ))}
      </div>

      {/* footer summary */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: 14,
          borderTop: "1px solid #e7e5e4",
          fontSize: 13,
        }}
      >
        <span style={{ color: "#78716c" }}>
          {mode === "proportion" ? "Total across 24 hours" : "Total sessions"}
        </span>
        <span
          style={{
            fontWeight: 700,
            color: mode === "proportion" && !sumOk ? "#dc2626" : "#1c1917",
          }}
        >
          {sumLabel}
          {mode === "proportion" && !sumOk && (
            <span style={{ fontWeight: 500, fontSize: 12, marginLeft: 8, color: "#dc2626" }}>
              (doesn't sum to 100 — normalize to fix)
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
