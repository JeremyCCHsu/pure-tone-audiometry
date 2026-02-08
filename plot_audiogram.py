import json
import matplotlib.pyplot as plt
import sys
import os
import argparse

def analyze_and_plot(json_file, output_file='results.png'):
    if not os.path.exists(json_file):
        print(f"File not found: {json_file}")
        return

    try:
        with open(json_file, 'r') as f:
            data = json.load(f)
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return

    results = data.get('results', [])
    timestamp = data.get('timestamp', 'Unknown Date')

    # --- Process Data ---

    # Identify all frequencies tested across the session to handle missing data
    all_freqs = sorted(list(set(r['frequency'] for r in results)))

    # 1. Filter events
    # Left
    left_hits = [r for r in results if r['ear'] == 'left' and r['responseDetected']]
    left_misses = [r for r in results if r['ear'] == 'left' and not r['responseDetected']]

    # Right
    right_hits = [r for r in results if r['ear'] == 'right' and r['responseDetected']]
    right_misses = [r for r in results if r['ear'] == 'right' and not r['responseDetected']]

    # 2. Calculate Thresholds (Min dB heard per frequency)
    def get_thresholds(hits):
        thresh_map = {}
        for h in hits:
            freq = h['frequency']
            db = h['db']
            if freq not in thresh_map or db < thresh_map[freq]:
                thresh_map[freq] = db

        # Fill missing frequencies with nan
        curve = []
        for f in all_freqs:
            if f in thresh_map:
                curve.append((f, thresh_map[f]))
            else:
                curve.append((f, float('nan')))
        return curve

    left_curve = get_thresholds(left_hits)
    right_curve = get_thresholds(right_hits)

    # --- Plotting ---
    plt.figure(figsize=(12, 8))

    # Plot Threshold Lines
    if left_curve:
        lx, ly = zip(*left_curve)
        plt.plot(lx, ly, color='blue', linestyle='-', linewidth=2, alpha=0.6, label='Left Threshold')

    if right_curve:
        rx, ry = zip(*right_curve)
        plt.plot(rx, ry, color='red', linestyle='-', linewidth=2, alpha=0.6, label='Right Threshold')

    # Plot Scatter Points (All events)
    # Left Hits per protocol (Blue Circles) but requested style in web was Circle for Left Threshold?
    # Web: Left Threshold (Blue Rect/Circle), Right Threshold (Red Circle).
    # Web: Left Hits (Blue Circle), Right Hits (Red Circle).
    # Web: Misses (Crosses).

    # Scatter - Left Hits
    if left_hits:
        lhx = [r['frequency'] for r in left_hits]
        lhy = [r['db'] for r in left_hits]
        plt.scatter(lhx, lhy, color='blue', marker='o', s=50, alpha=0.3, label='Left Hit')

    # Scatter - Right Hits
    if right_hits:
        rhx = [r['frequency'] for r in right_hits]
        rhy = [r['db'] for r in right_hits]
        plt.scatter(rhx, rhy, color='red', marker='o', s=50, alpha=0.3, label='Right Hit')

    # Scatter - Left Misses
    if left_misses:
        lmx = [r['frequency'] for r in left_misses]
        lmy = [r['db'] for r in left_misses]
        plt.scatter(lmx, lmy, color='blue', marker='x', s=50, label='Left Miss')

    # Scatter - Right Misses
    if right_misses:
        rmx = [r['frequency'] for r in right_misses]
        rmy = [r['db'] for r in right_misses]
        plt.scatter(rmx, rmy, color='red', marker='x', s=50, label='Right Miss')

    # --- Formatting ---
    plt.title(f"Hearing Test Audiogram\n{timestamp}", fontsize=14)
    plt.xlabel("Frequency (Hz)", fontsize=12)
    plt.ylabel("Volume (dB relative to baseline)", fontsize=12)

    # Set X-Axis to Logarithmic Scale (Standard for Audiograms)
    plt.xscale('log')

    # Define standard audiometric frequencies for ticks
    ticks = [125, 250, 500, 1000, 2000, 4000, 8000]
    # Add any extra high frequencies if present in data
    for f in all_freqs:
        if f > 8000 or (f > 4000 and f < 8000 and f not in ticks):
            ticks.append(f)
    ticks = sorted(list(set(ticks)))

    plt.xticks(ticks, [str(t) if t < 1000 else f"{t/1000:.1f}k".replace(".0k", "k") for t in ticks])
    plt.grid(True, which="both", ls="-", alpha=0.2)

    # Invert Y Axis (Hearing Loss is traditionally Down)
    plt.gca().invert_yaxis()

    # Set Y limits slightly padded
    if results:
        all_db = [r['db'] for r in results]
        min_db = min(all_db)
        max_db = max(all_db)
        plt.ylim(max_db + 10, min_db - 10) # Remember inverted

    plt.legend()
    plt.tight_layout()

    # Save
    plt.savefig(output_file)
    print(f"Audiogram saved to: {output_file}")

    # --- Plotting Response Time ---
    plt.figure(figsize=(12, 8))

    # Extract Reaction Times
    if left_hits:
        l_freqs = [r['frequency'] for r in left_hits if 'reactionTime' in r]
        l_rts = [r['reactionTime'] for r in left_hits if 'reactionTime' in r]
        if l_freqs:
            plt.scatter(l_freqs, l_rts, color='blue', marker='o', s=50, alpha=0.6, label='Left Ear')

    if right_hits:
        r_freqs = [r['frequency'] for r in right_hits if 'reactionTime' in r]
        r_rts = [r['reactionTime'] for r in right_hits if 'reactionTime' in r]
        if r_freqs:
            plt.scatter(r_freqs, r_rts, color='red', marker='o', s=50, alpha=0.6, label='Right Ear')

    plt.title(f"Response Time vs Frequency\n{timestamp}", fontsize=14)
    plt.xlabel("Frequency (Hz)", fontsize=12)
    plt.ylabel("Response Time (ms)", fontsize=12)

    plt.xscale('log')
    plt.xticks(ticks, [str(t) if t < 1000 else f"{t/1000:.1f}k".replace(".0k", "k") for t in ticks])
    plt.grid(True, which="both", ls="-", alpha=0.2)

    plt.ylim(bottom=0)

    plt.legend()
    plt.tight_layout()

    # Construct output filename for reaction time
    base, ext = os.path.splitext(output_file)
    output_rt = f"{base}_reaction_time{ext}"

    plt.savefig(output_rt)
    print(f"Response time plot saved to: {output_rt}")

    # Show (only if interactive)
    # plt.show() # Commented out to avoid blocking if running in script mode without display

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Plot audiogram from hearing test results JSON.')
    parser.add_argument('input_file', help='Path to the input JSON file')
    parser.add_argument('-o', '--output', default='results_hearing_curve.png', help='Path to the output image file (default: results.png)')

    args = parser.parse_args()

    analyze_and_plot(args.input_file, args.output)
