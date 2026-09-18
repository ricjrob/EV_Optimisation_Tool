import math
import random
import statistics

from .BayCalculator import BayCalculator
from .DayProfile import DayProfile
from .PowerResult import ChargerConfig, ChargerSimulationResult, PeakPowerNeeds


def _percentile(data: list[float], pct: float) -> float:
    if not data:
        return 0.0
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * (pct / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_data[int(k)]
    return sorted_data[int(f)] * (c - k) + sorted_data[int(c)] * (k - f)


class PowerCalculator:
    """Calculates peak power requirements and simulates charger power capping and dynamic load balancing."""

    @staticmethod
    def calculate_peak_power_needs(
        calculator: BayCalculator | None = None,
        concurrent_bays: int = 1,
        num_samples: int = 10000,
    ) -> PeakPowerNeeds:
        calc = calculator or BayCalculator()
        bays = max(1, int(concurrent_bays))

        # Sample realistic instantaneous single-vehicle power draws, weighted by
        # time spent at each SOC, rather than each vehicle's theoretical peak_kw.
        single_powers = [
            calc.sample_instantaneous_power_kw() for _ in range(num_samples)
        ]
        single_p90 = _percentile(single_powers, 90.0)
        single_p95 = _percentile(single_powers, 95.0)
        single_p99 = _percentile(single_powers, 99.0)

        if bays == 1:
            concurrent_p90 = single_p90
            concurrent_p95 = single_p95
            concurrent_p99 = single_p99
        else:
            concurrent_per_bay_powers = []
            for _ in range(num_samples):
                group_sum = sum(
                    calc.sample_instantaneous_power_kw() for _ in range(bays)
                )
                concurrent_per_bay_powers.append(group_sum / bays)

            concurrent_p90 = _percentile(concurrent_per_bay_powers, 90.0)
            concurrent_p95 = _percentile(concurrent_per_bay_powers, 95.0)
            concurrent_p99 = _percentile(concurrent_per_bay_powers, 99.0)

        return PeakPowerNeeds(
            p90_kw=round(concurrent_p90, 1),
            p95_kw=round(concurrent_p95, 1),
            p99_kw=round(concurrent_p99, 1),
            single_vehicle_p90_kw=round(single_p90, 1),
            single_vehicle_p95_kw=round(single_p95, 1),
            single_vehicle_p99_kw=round(single_p99, 1),
            concurrent_bays=bays,
            mean_kw=round(statistics.mean(single_powers), 1),
        )

    @classmethod
    def simulate_charger_config(
        cls,
        profile: DayProfile,
        charger_config: ChargerConfig,
        simulation_runs: int = 10,
        calculator: BayCalculator | None = None,
    ) -> ChargerSimulationResult:
        calc = calculator or BayCalculator()
        runs = max(1, int(simulation_runs))

        run_results = [
            cls._simulate_one_day(profile, charger_config, calc) for _ in range(runs)
        ]

        total_sessions_avg = round(
            statistics.mean(r["total_sessions"] for r in run_results)
        )
        delayed_sessions_avg = statistics.mean(
            r["delayed_sessions"] for r in run_results
        )
        delayed_pct_avg = (
            (delayed_sessions_avg / total_sessions_avg * 100.0)
            if total_sessions_avg > 0
            else 0.0
        )
        avg_unconstrained_dwell = statistics.mean(
            r["avg_unconstrained_dwell"] for r in run_results
        )
        avg_constrained_dwell = statistics.mean(
            r["avg_constrained_dwell"] for r in run_results
        )
        avg_dwell_extension = statistics.mean(
            r["avg_dwell_extension"] for r in run_results
        )
        avg_extension_for_delayed = statistics.mean(
            r["avg_extension_for_delayed"] for r in run_results
        )
        max_dwell_extension = max(r["max_dwell_extension"] for r in run_results)
        power_capped_minutes = statistics.mean(
            r["power_capped_minutes"] for r in run_results
        )
        total_energy_kwh = statistics.mean(r["total_energy_kwh"] for r in run_results)
        peak_power_kw = max(r["peak_power_kw"] for r in run_results)

        return ChargerSimulationResult(
            num_chargers=charger_config.num_chargers,
            max_kw_per_charger=charger_config.max_kw_per_charger,
            bays_per_charger=charger_config.bays_per_charger,
            total_bays=charger_config.total_bays,
            total_sessions=total_sessions_avg,
            delayed_sessions=round(delayed_sessions_avg, 1),
            delayed_sessions_pct=round(delayed_pct_avg, 1),
            avg_unconstrained_dwell_min=round(avg_unconstrained_dwell, 1),
            avg_constrained_dwell_min=round(avg_constrained_dwell, 1),
            avg_dwell_extension_min=round(avg_dwell_extension, 1),
            avg_extension_for_delayed_min=round(avg_extension_for_delayed, 1),
            max_dwell_extension_min=round(max_dwell_extension, 1),
            power_capped_minutes=round(power_capped_minutes, 1),
            total_energy_kwh=round(total_energy_kwh, 1),
            peak_power_kw=round(peak_power_kw, 1),
        )

    @classmethod
    def _simulate_one_day(
        cls,
        profile: DayProfile,
        charger_config: ChargerConfig,
        calc: BayCalculator,
    ) -> dict:
        curve = calc.CURVE_PRESETS["dc_fast"]
        total_sessions = profile.get_total_sessions_per_day()
        dist = profile.get_day_profile()

        # Build session arrivals
        sessions_data = []
        for hour, proportion in enumerate(dist):
            count = max(0, round(proportion * total_sessions))
            for _ in range(count):
                arrival_min = hour * 60.0 + random.random() * 60.0
                initial_soc, target_soc = calc._draw_soc_pair_for_curve("dc_fast")
                battery_kwh = calc._sample_battery_kwh(curve)
                peak_kw = calc._sample_peak_kw(curve, battery_kwh)
                buffer_min = calc._draw_buffer_minutes()

                unconstrained_charge_min, energy_kwh = calc._simulate_soc_session(
                    curve,
                    initial_soc,
                    target_soc,
                    battery_kwh=battery_kwh,
                    peak_kw=peak_kw,
                    apply_jitter=False,
                )
                unconstrained_total_dwell = unconstrained_charge_min + buffer_min

                sessions_data.append({
                    "arrival_min": arrival_min,
                    "initial_soc": initial_soc,
                    "target_soc": target_soc,
                    "current_soc": initial_soc,
                    "battery_kwh": battery_kwh,
                    "peak_kw": peak_kw,
                    "efficiency": curve["efficiency"],
                    "buffer_min": buffer_min,
                    "unconstrained_dwell": unconstrained_total_dwell,
                    "unconstrained_charge_min": unconstrained_charge_min,
                    "energy_kwh": energy_kwh,
                    "start_charge_min": None,
                    "finish_charge_min": None,
                    "departure_min": None,
                    "status": "waiting",  # waiting, charging, buffer, finished
                })

        sessions_data.sort(key=lambda s: s["arrival_min"])
        num_sessions = len(sessions_data)
        if num_sessions == 0:
            return {
                "total_sessions": 0,
                "delayed_sessions": 0,
                "avg_unconstrained_dwell": 0.0,
                "avg_constrained_dwell": 0.0,
                "avg_dwell_extension": 0.0,
                "avg_extension_for_delayed": 0.0,
                "max_dwell_extension": 0.0,
                "power_capped_minutes": 0.0,
                "total_energy_kwh": 0.0,
                "peak_power_kw": 0.0,
            }

        num_chargers = charger_config.num_chargers
        bays_per_charger = charger_config.bays_per_charger
        total_bays = charger_config.total_bays
        max_kw_per_charger = charger_config.max_kw_per_charger

        # Bay assignment: mapping bay_id -> charger_id
        # bay_id in 0..total_bays-1; bay b belongs to charger (b // bays_per_charger)
        bay_occupant: list[int | None] = [None] * total_bays

        dt = 0.5  # time step in minutes
        current_time = 0.0
        max_time = (
            24.0 * 60.0 + 360.0
        )  # simulate up to 30 hours to allow trailing sessions to finish

        power_capped_steps = 0
        peak_site_power = 0.0
        queue: list[int] = []
        next_arrival_idx = 0

        while current_time < max_time:
            # 1. Process new arrivals up to current_time
            while (
                next_arrival_idx < num_sessions
                and sessions_data[next_arrival_idx]["arrival_min"] <= current_time
            ):
                queue.append(next_arrival_idx)
                next_arrival_idx += 1

            # 2. Assign queued sessions to free bays, preferring idle chargers
            # first so vehicles avoid doubling up on an already-occupied
            # charger's second socket while other chargers sit empty.
            if queue:
                charger_occupancy = [0] * num_chargers
                for b in range(total_bays):
                    if bay_occupant[b] is not None:
                        charger_occupancy[b // bays_per_charger] += 1

                free_bays = [b for b in range(total_bays) if bay_occupant[b] is None]
                free_bays.sort(
                    key=lambda b: (charger_occupancy[b // bays_per_charger], b)
                )

                for b in free_bays:
                    if not queue:
                        break
                    s_idx = queue.pop(0)
                    bay_occupant[b] = s_idx
                    s = sessions_data[s_idx]
                    # A bay was free, so the vehicle starts at its true arrival
                    # time rather than being snapped forward to this grid tick.
                    s["start_charge_min"] = max(s["arrival_min"], current_time - dt)
                    s["status"] = "charging"
                    charger_occupancy[b // bays_per_charger] += 1

            # 3. Calculate power requests per charger and apply dynamic load balancing
            site_power = 0.0
            any_charger_capped = False

            for c in range(num_chargers):
                charger_bays = range(c * bays_per_charger, (c + 1) * bays_per_charger)
                active_s_indices = [
                    bay_occupant[b]
                    for b in charger_bays
                    if bay_occupant[b] is not None
                    and sessions_data[bay_occupant[b]]["status"] == "charging"
                ]

                req_powers = []
                for s_idx in active_s_indices:
                    s = sessions_data[s_idx]
                    power_frac = calc._power_fraction_at_soc(curve, s["current_soc"])
                    req = max(0.1, s["peak_kw"] * power_frac)
                    req_powers.append(req)

                total_req = sum(req_powers)
                if total_req > max_kw_per_charger:
                    any_charger_capped = True
                    scale = max_kw_per_charger / total_req
                    alloc_powers = [req * scale for req in req_powers]
                    site_power += max_kw_per_charger
                else:
                    alloc_powers = req_powers
                    site_power += total_req

                # Update active charging sessions on charger c
                for s_idx, p_alloc in zip(active_s_indices, alloc_powers):
                    s = sessions_data[s_idx]
                    efficiency = max(0.75, min(0.99, s["efficiency"]))
                    energy_added = p_alloc * efficiency * (dt / 60.0)
                    soc_before = s["current_soc"]
                    s["current_soc"] = soc_before + energy_added / s["battery_kwh"]

                    if s["current_soc"] >= s["target_soc"]:
                        # Interpolate the exact crossing time within this step
                        # instead of snapping to the grid, which would
                        # otherwise add a systematic upward bias to dwell time.
                        soc_gain = s["current_soc"] - soc_before
                        if soc_gain > 1e-9:
                            frac = (s["target_soc"] - soc_before) / soc_gain
                            frac = min(1.0, max(0.0, frac))
                        else:
                            frac = 1.0
                        s["finish_charge_min"] = current_time + frac * dt
                        s["status"] = "buffer"

            if any_charger_capped:
                power_capped_steps += 1

            if site_power > peak_site_power:
                peak_site_power = site_power

            # 4. Advance buffer state & free bays when buffer elapses
            for b in range(total_bays):
                s_idx = bay_occupant[b]
                if s_idx is not None:
                    s = sessions_data[s_idx]
                    if s["status"] == "buffer":
                        # Exact departure time, not snapped to the grid, so
                        # the buffer stage doesn't add quantization bias.
                        exact_departure = s["finish_charge_min"] + s["buffer_min"]
                        if current_time + dt >= exact_departure:
                            s["departure_min"] = exact_departure
                            s["status"] = "finished"
                            bay_occupant[b] = None

            # Check if all sessions finished
            if (
                next_arrival_idx >= num_sessions
                and not queue
                and all(b is None for b in bay_occupant)
            ):
                break

            current_time += dt

        # Evaluate session dwell times
        delayed_count = 0
        extensions = []
        delayed_extensions = []
        unconstrained_dwells = []
        constrained_dwells = []
        total_energy = 0.0

        for s in sessions_data:
            dep = s["departure_min"] or current_time
            actual_dwell = max(s["unconstrained_dwell"], dep - s["arrival_min"])
            unconstrained_dwells.append(s["unconstrained_dwell"])
            constrained_dwells.append(actual_dwell)

            ext = actual_dwell - s["unconstrained_dwell"]
            extensions.append(ext)
            total_energy += s["energy_kwh"]

            if ext > dt:  # beyond one sim timestep of quantization noise
                delayed_count += 1
                delayed_extensions.append(ext)

        avg_unconstrained = statistics.mean(unconstrained_dwells)
        avg_constrained = statistics.mean(constrained_dwells)
        avg_ext = statistics.mean(extensions)
        avg_ext_delayed = (
            statistics.mean(delayed_extensions) if delayed_extensions else 0.0
        )
        max_ext = max(extensions) if extensions else 0.0

        return {
            "total_sessions": num_sessions,
            "delayed_sessions": delayed_count,
            "avg_unconstrained_dwell": avg_unconstrained,
            "avg_constrained_dwell": avg_constrained,
            "avg_dwell_extension": avg_ext,
            "avg_extension_for_delayed": avg_ext_delayed,
            "max_dwell_extension": max_ext,
            "power_capped_minutes": power_capped_steps * dt,
            "total_energy_kwh": total_energy,
            "peak_power_kw": peak_site_power,
        }
